import streamlit as st
import pandas as pd
import numpy as np

from data_io import load_pathway, load_modules
from sim_core import simulate_yield

st.set_page_config(page_title="Epigenetic Tuning Simulator", layout="wide")

# --- load data ---
pw_df = load_pathway()
modules_df = load_modules()

GENES = pw_df["gene"].tolist()
BASE_K = pw_df["baseline_k"].to_numpy(float)
BURDEN_W = pw_df["burden_w"].to_numpy(float)

MODULE_NAMES = modules_df.index.tolist()
MODULE_ROWS = {m: modules_df.loc[m].to_dict() for m in MODULE_NAMES}

# --- sidebar controls ---
st.sidebar.header("Global Settings")
supply_cap = st.sidebar.slider("Upstream supply cap", 0.5, 3.0, 2.0, 0.1)
gamma_burden = st.sidebar.slider("Burden sensitivity γ", 0.0, 0.15, 0.05, 0.01)
p_softmin = st.sidebar.slider("Soft-min p (higher≈harder min)", 2, 10, 6, 1)

st.title("Violacein Pathway — Epigenetic Tuning (E. coli)")
st.caption("Toggle gene-level epigenetic controls; simulator estimates bottleneck-aware flux and yield.")

# baseline config (all neutral)
default_module = "CRISPRa_Ec"
default_level = 0.5

left, right = st.columns([2, 1])

with left:
    st.subheader("Pathway Schematic / Controls")
    user_mods = []
    user_levels = []

    for g in GENES:
        c1, c2 = st.columns([2, 6])
        with c1:
            st.markdown(f"**{g}**")
            mod = st.selectbox(
                f"Module for {g}",
                MODULE_NAMES,
                index=MODULE_NAMES.index(default_module) if default_module in MODULE_NAMES else 0,
                key=f"mod_{g}",
            )
        with c2:
            lvl = st.slider(f"Activation/Repression Level for {g}", 0.0, 1.0, default_level, 0.05, key=f"lvl_{g}")
        user_mods.append(mod)
        user_levels.append(lvl)

    # run simulation
    out = simulate_yield(
        genes=GENES,
        baseline_k=BASE_K,
        burden_w=BURDEN_W,
        module_rows=MODULE_ROWS,
        chosen_modules=user_mods,
        levels=user_levels,
        supply_cap=float(supply_cap),
        p_softmin=float(p_softmin),
        gamma_burden=float(gamma_burden),
    )

    # grid search (OFF/MED/ON) button
    st.markdown("---")
    if st.button("Run quick grid (OFF/MED/ON per gene)"):
        levels = [0.05, 0.5, 1.0]
        states = []
        # brute force small grid
        for a in levels:
            for b in levels:
                for e in levels:
                    for d in levels:
                        for c in levels:
                            lvls = [a, b, e, d, c]
                            mods = [default_module]*5
                            res = simulate_yield(GENES, BASE_K, BURDEN_W, MODULE_ROWS, mods, lvls, supply_cap, p_softmin, gamma_burden)
                            states.append({
                                "VioA": a, "VioB": b, "VioE": e, "VioD": d, "VioC": c,
                                "Yield": res["yield"],
                                "Bottleneck": res["flux"]["bottleneck_gene"]
                            })
        grid_df = pd.DataFrame(states).sort_values("Yield", ascending=False).reset_index(drop=True)
        st.dataframe(grid_df.head(20), use_container_width=True)
        st.download_button("Download full grid CSV", grid_df.to_csv(index=False), "grid_results.csv", "text/csv")

with right:
    st.subheader("Yield & Flux")
    Y = out["yield"]
    st.metric("Predicted Yield (relative units)", f"{Y:.2f}")
    st.caption(f"Bottleneck: **{out['flux']['bottleneck_gene']}** | F_core={out['flux']['Fcore']:.2f} | Supply cap={supply_cap:.2f}")

    st.subheader("Gene Sensitivity")
    sens_df = pd.DataFrame(out["sensitivities"], columns=["Gene", "Influence (0–1)"])
    st.bar_chart(sens_df.set_index("Gene"))

    st.subheader("Penalties")
    st.write(f"Burden φ = {out['burden']['phi']:.2f} → penalty {out['burden']['penalty']:.2f}")
    st.write(f"Imbalance penalty = {out['imbalance_penalty']:.2f}")
    if out["notes"]:
        st.warning(" • ".join(out["notes"]))
