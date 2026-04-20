# VioFlux

**Epigenetic flux simulator for the violacein biosynthesis pathway**
*1st place — [TurbioHacks Global Bio × AI Hackathon](https://devpost.com/software/vioflux)*

---

## Biology

Violacein is a bisindole pigment from *Chromobacterium violaceum* with antibiotic and anticancer activity. Its biosynthesis proceeds through a five-enzyme linear chain:

```
L-Trp ──(VioA,VioB)──► IPA imine ──(VioE)──► protodeoxyviolaceinic acid
       ──(VioD)──► protoviolaceinic acid ──(VioC)──► violacein
```

Two competing branches set hard performance ceilings:
- **CPA diversion** — when VioE activity is very low, the IPA imine dimerizes spontaneously to chromopyrrolic acid (CPA), yielding zero violacein
- **Chromoviridans shunt** — when VioC is weak relative to the rest of the pathway, flux diverts to deoxyviolacein / chromoviridans

VioFlux simulates how epigenetic perturbations (CRISPRa, CRISPRi, methylation locks) propagate through this chain and affect yield, accounting for both the bottleneck structure and metabolic/proteome costs.

---

## Model

This is a **steady-state, dimensionless flux model**, not an ODE. The yield score `Y` is a relative titer estimate under a given epigenetic configuration.

### 1 — Epigenetic module response

Each gene is assigned a module at a "level" (0–1, representing inducer or guide-RNA strength). The module maps level → fold-change over baseline:

| Module | Formula | Boundaries |
|--------|---------|------------|
| **CRISPRa** (activator) | `1 + (A_max−1) × Hill(level, EC₅₀, h)` | level=0 → 1×; level=1 → A_max× |
| **CRISPRi** (repressor) | `(min_fold+leak) + (1−min_fold−leak) / (1+(level/EC₅₀)^h)` | level=0 → 1×; level→∞ → min_fold+leak |
| **Methylation** (binary) | `1.0 if level ≥ 0.5 else leak` | ON: full expression; OFF: only constitutive leak |
| **Neutral** | `1.0` | no effect |

Parameters (A_max, min_fold, EC₅₀, h, leak) are stored in `epi-sim/data/epigenetic_modules.csv`.

### 2 — Effective enzyme activities

`a_i = k_i × F_i`, where `k_i` is the baseline activity weight from `violacein_pathway.tsv`.

### 3 — Bottleneck flux (soft-min)

Pathway flux is limited by the slowest enzyme. A differentiable proxy for `min(a)`:

```
F_core = ( mean_i( a_i^(−p) ) )^(−1/p)      p = 6  (→ min as p → ∞)
F      = min(F_core, supply_cap)
```

The N-normalized power mean is used so equal activities yield `F_core = 1.0` at baseline (unnormalized versions carry an artifact scaling of `N^(1/p)`).

### 4 — Penalty terms

Two multiplicative penalties discount raw flux:

- **Imbalance penalty `P`** — large upstream activities relative to `F_core` signal metabolic buildup and potential toxicity:
  `P = exp(−α × Σ max(0, a_i/F_core − s))`

- **Burden penalty `Q`** — over-expressing all enzymes strains the *E. coli* proteome:
  `Q = 1 / 1 + γ × (∑ w_i × a_i − N)²)`

### 5 — Violacein-specific gating rules

- `a[VioE] < 0.10` → hard zero (CPA diversion; no violacein produced)
- VioC weak relative to pathway median → fractional shunt toward chromoviridans (up to 35% flux loss)

### Final yield

```
Y = F × P × (1 − shunt_leak) × Q
```

Gene **activities** are shown normalized to the pathway maximum. The Streamlit app additionally computes log-space finite-difference elasticities (analogous to MCA flux control coefficients) per gene.

---

## Repository structure

```
VioFlux/
├── epi-sim/
│   ├── app.py                      # Streamlit UI
│   ├── sim_core.py                 # Simulation engine
│   ├── data_io.py                  # Data loaders
│   └── data/
│       ├── violacein_pathway.tsv   # Gene order, baseline k, burden weights
│       └── epigenetic_modules.csv  # Module response-curve parameters
├── web-interface/
│   └── index.html                  # Self-contained browser interface (no backend)
└── requirements.txt
```

> `web-interface/VioFlux/` is an accidental nested duplicate from an upload and can be deleted.

---

## Quick start

**Streamlit app (full simulation + sensitivity analysis):**
```bash
pip install -r requirements.txt
cd epi-sim
streamlit run app.py
```

**Web interface (no install, fully offline):**
```
open web-interface/index.html
```
The web interface runs the same core simulation engine in JavaScript — identical math to `sim_core.py`.

---

## Data formats

**`violacein_pathway.tsv`**

| Column | Description |
|--------|-------------|
| `gene` | Gene name (VioA–VioC) |
| `step_order` | Reaction order in the chain (1–5) |
| `baseline_k` | Baseline enzyme activity (dimensionless) |
| `burden_w` | Proteome burden weight |

**`epigenetic_modules.csv`**

| Column | Description |
|--------|-------------|
| `module` | Module key (used in UI selectors) |
| `type` | `activator` / `repressor` / `binary` |
| `A_max` | Max fold-activation (activator only) |
| `min_fold` | Residual expression under full repression |
| `EC50` | Half-maximal inducer concentration (0–1 normalized scale) |
| `h` | Hill coefficient (cooperativity) |
| `leak` | Constitutive transcription leak |

To sub in a new pathway, replace the TSV and CSV — no code changes required.

---

## Limitations

- **Parameters are illustrative, not calibrated.** All baseline k values are 1.0; real enzyme rates differ by orders of magnitude and are organism- and condition-dependent.
- **No dynamics.** This is a steady-state score. Gene expression lag, intermediate accumulation, and feedback are not modeled.
- **Sensitivities are finite-difference approximations**, not formal MCA flux control coefficients — the summation theorem is not enforced.
- **Grid search fixes modules to CRISPRa.** The Streamlit grid sweeps expression levels across `{low, mid, high}` for each gene but does not sweep over module types.
- **VioE and VioC thresholds are heuristic.** The CPA diversion cutoff and chromoviridans shunt fraction are biologically motivated but not fit to experimental data.
