"""
Inspect the Criteo Uplift dataset (Member 1).

Run from inside the 01_Dataset_Analysis folder (needs internet the first time):
    pip install scikit-uplift
    python inspect_criteo.py

By default it downloads the 10% sample (about 1.4 million rows) into data/raw/.
That folder is git-ignored, so the big file is never uploaded to GitHub.

If you already have the CSV, run:  python inspect_criteo.py path\\to\\file.csv
"""
import os
import sys
import pandas as pd

RAW_DIR = os.path.join("data", "raw")


def load():
    if len(sys.argv) > 1:
        print("Loading local file:", sys.argv[1])
        return pd.read_csv(sys.argv[1])
    from sklift.datasets import fetch_criteo
    os.makedirs(RAW_DIR, exist_ok=True)
    print("Downloading 10% sample of Criteo Uplift (needs internet)...")
    bunch = fetch_criteo(target_col="all", treatment_col="all",
                         data_home=RAW_DIR, percent10=True)
    df = bunch.data.copy()
    df["treatment"] = bunch.treatment["treatment"].values
    df["exposure"] = bunch.treatment["exposure"].values
    df["visit"] = bunch.target["visit"].values
    df["conversion"] = bunch.target["conversion"].values
    return df


def summarise(df):
    print("\nShape:", df.shape)
    print("\nColumn types:\n", df.dtypes)
    print("\nMissing values:", int(df.isna().sum().sum()))
    print("Duplicate rows:", int(df.duplicated().sum()),
          "(duplicates are expected here: users are anonymous, so identical rows can be different people)")
    print("\nTreatment counts (1 = shown ad, 0 = control):\n", df["treatment"].value_counts())
    print("Treatment ratio: {:.3f}".format(df["treatment"].mean()))
    print("\nOutcome rates by treatment group:")
    rates = df.groupby("treatment")[["visit", "conversion", "exposure"]].mean()
    print(rates.round(5))
    for y in ["visit", "conversion"]:
        diff = rates.loc[1, y] - rates.loc[0, y]
        print("Average uplift on {}: {:+.3%} (valid as a causal effect because treatment was randomised)".format(y, diff))
    print("\nFeature summary (f0 to f11):")
    print(df[[f"f{i}" for i in range(12)]].describe().T.round(2))


if __name__ == "__main__":
    summarise(load())
