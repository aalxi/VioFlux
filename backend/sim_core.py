import numpy as np
from typing import Dict, List, Tuple

# ---------- epigenetic response curves ----------

def hill(x: float, EC50: float, h: float) -> float:
    # safe Hill term for x in [0,1]
    x = np.clip(x, 0.0, 1.0)
    return (x**h) / (x**h + EC50**h)

def fold_change(module_row: Dict, level: float) -> float:
    mtype = module_row["type"].strip().lower()
    EC50 = float(module_row.get("EC50", 0.5) or 0.5)
    hval = float(module_row.get("h", 2.0) or 2.0)
    leak = float(module_row.get("leak", 0.0) or 0.0)

    if mtype == "activator":
        Amax = float(module_row.get("A_max", 3.0) or 3.0)
        return 1.0 + (Amax - 1.0) * hill(level, EC50, hval)

    if mtype == "repressor":
        min_fold = float(module_row.get("min_fold", 0.2) or 0.2)  # residual when fully repressed
        return min_fold + (1.0 - min_fold) / (1.0 + (level / EC50) ** hval) + leak

    if mtype == "binary":
        # treat >=0.5 as ON (1.0), else OFF (~leak)
        return (1.0 if level >= 0.5 else 0.0) + leak

    # default neutral
    return 1.0

# ---------- core pathway math ----------

def softmin(vals: np.ndarray, p: float = 6.0) -> float:
    # smooth approx of min(vals); p in [4..8] works well
    vals = np.clip(vals, 1e-9, None)
    return (np.sum(vals ** (-p))) ** (-1.0 / p)

def compute_activities(
    baseline_k: np.ndarray,
    folds: np.ndarray
) -> np.ndarray:
    # effective step capacities (dimensionless)
    return baseline_k * folds

def imbalance_penalty(a: np.ndarray, Fcore: float, s: float = 2.0, alpha: float = 0.15) -> float:
    # penalize large upstream build-ups relative to core flux
    r = np.clip(a / (Fcore + 1e-9), 0.0, None)
    excess = np.maximum(0.0, r - s)
    return float(np.exp(-alpha * np.sum(excess)))

def burden_penalty(a: np.ndarray, burden_w: np.ndarray, gamma: float = 0.05) -> Tuple[float, float]:
    # proteome cost penalty ~ quadratic around "all 1x"
    phi = float(np.sum(burden_w * a))
    N = len(a)
    penalty = 1.0 / (1.0 + gamma * (phi - N) ** 2)
    return phi, float(penalty)

def violacein_rules(a_map: Dict[str, float]) -> Tuple[float, bool, List[str]]:
    """
    Encodes paper-backed heuristics:
      - VioE is the gate: if it's too low, flux collapses to CPA → zero product.
      - Low VioC leads to chromoviridans shunt; we model as a fractional 'leak'.
    Returns: (leak_fraction, hard_zero, notes[])
    """
    notes = []
    # 1) VioE gating
    if a_map.get("VioE", 0.0) < 0.10:
        notes.append("VioE below 0.10 → pathway diverts to CPA (no violacein).")
        return 0.0, True, notes

    # 2) VioC shunt when relatively weak vs median
    a_vals = np.array(list(a_map.values()), dtype=float)
    median = float(np.median(a_vals)) + 1e-9
    rC = a_map.get("VioC", median) / median
    leak = max(0.0, min(0.5, 0.6 - min(rC, 1.0))) * 0.7  # up to 35% leak if VioC is very weak
    if leak > 0:
        notes.append("Low VioC relative to others → chromoviridans shunt risk.")
    return float(leak), False, notes

def simulate_yield(
    genes: List[str],
    baseline_k: np.ndarray,
    burden_w: np.ndarray,
    module_rows: Dict[str, Dict],
    chosen_modules: List[str],
    levels: List[float],
    supply_cap: float = 2.0,
    p_softmin: float = 6.0,
    gamma_burden: float = 0.05,
    imb_s: float = 2.0,
    imb_alpha: float = 0.15
) -> Dict:
    """
    Core forward pass:
      1) module(level) → fold-change per gene
      2) activities a_i = k_i * fold_i
      3) soft-min bottleneck flux (respect supply cap)
      4) penalties: imbalance, burden; violacein-specific leak/gate
    Returns dict with yield, flux snapshot, per-gene sensitivities, notes.
    """
    folds = np.array([fold_change(module_rows[m], l) for m, l in zip(chosen_modules, levels)], dtype=float)
    a = compute_activities(baseline_k, folds)

    # soft-min bottleneck and supply cap
    Fcore = softmin(a, p_softmin)
    F = min(Fcore, supply_cap)

    # penalties
    P = imbalance_penalty(a, Fcore, s=imb_s, alpha=imb_alpha)
    phi, Q = burden_penalty(a, burden_w, gamma=gamma_burden)

    # violacein-specific rules
    a_map = {g: float(ai) for g, ai in zip(genes, a)}
    leak, hard_zero, rule_notes = violacein_rules(a_map)

    if hard_zero:
        Y = 0.0
        bottleneck_gene = genes[int(np.argmin(a))]
        return {
            "yield": 0.0,
            "flux": {"Fcore": float(Fcore), "F": 0.0, "bottleneck_gene": bottleneck_gene},
            "sensitivities": [[g, 0.0] for g in genes],
            "burden": {"phi": phi, "penalty": Q},
            "imbalance_penalty": P,
            "notes": rule_notes
        }

    Y = F * P * (1.0 - leak) * Q  # dimensionless score

    # finite-difference sensitivities (log-space, central)
    sens = []
    for i, g in enumerate(genes):
        ai = a[i]
        eps = 0.05  # ~5% multiplicative nudge
        a_up = a.copy(); a_up[i] = ai * (1.0 + eps)
        a_dn = a.copy(); a_dn[i] = max(1e-9, ai * (1.0 - eps))

        Fcore_up = softmin(a_up, p_softmin); F_up = min(Fcore_up, supply_cap)
        P_up = imbalance_penalty(a_up, Fcore_up, s=imb_s, alpha=imb_alpha)
        phi_up, Q_up = burden_penalty(a_up, burden_w, gamma=gamma_burden)
        a_map_up = {gg: float(aa) for gg, aa in zip(genes, a_up)}
        leak_up, hard_zero_up, _ = violacein_rules(a_map_up)
        Y_up = 0.0 if hard_zero_up else F_up * P_up * (1.0 - leak_up) * Q_up

        Fcore_dn = softmin(a_dn, p_softmin); F_dn = min(Fcore_dn, supply_cap)
        P_dn = imbalance_penalty(a_dn, Fcore_dn, s=imb_s, alpha=imb_alpha)
        phi_dn, Q_dn = burden_penalty(a_dn, burden_w, gamma=gamma_burden)
        a_map_dn = {gg: float(aa) for gg, aa in zip(genes, a_dn)}
        leak_dn, hard_zero_dn, _ = violacein_rules(a_map_dn)
        Y_dn = 0.0 if hard_zero_dn else F_dn * P_dn * (1.0 - leak_dn) * Q_dn

        deriv = (Y_up - Y_dn) / (np.log(ai * (1.0 + eps)) - np.log(max(1e-9, ai * (1.0 - eps))))
        sens.append([g, float(max(0.0, deriv))])  # positive influence only for UI bars

    # normalize sensitivities to 0..1
    smax = max(1e-9, max(v for _, v in sens))
    sens = [[g, float(v / smax)] for g, v in sens]

    bottleneck_gene = genes[int(np.argmin(a))]
    return {
        "yield": float(Y),
        "flux": {"Fcore": float(Fcore), "F": float(F), "bottleneck_gene": bottleneck_gene},
        "sensitivities": sens,
        "burden": {"phi": float(phi), "penalty": float(Q)},
        "imbalance_penalty": float(P),
        "notes": rule_notes
    }
