from pathlib import Path
import pandas as pd

DATA_DIR = Path(__file__).parent / "data"

def load_pathway(path: Path | str = DATA_DIR / "violacein_pathway.tsv"):
    df = pd.read_csv(path, sep="\t")
    required = {"gene", "step_order", "baseline_k", "burden_w"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns in pathway file: {missing}")
    df = df.sort_values("step_order").reset_index(drop=True)
    return df

def load_modules(path: Path | str = DATA_DIR / "epigenetic_modules.csv"):
    df = pd.read_csv(path)
    required = {"module", "type", "EC50", "h", "leak"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns in modules file: {missing}")
    df = df.set_index("module")
    # convert numerics; tolerate blanks
    for col in ["A_max", "min_fold", "EC50", "h", "leak"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df
