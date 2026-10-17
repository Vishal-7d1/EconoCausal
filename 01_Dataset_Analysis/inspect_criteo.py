"""
Inspect the Criteo Uplift dataset (Member 1)  --  version 2

Run from inside the 01_Dataset_Analysis folder (needs internet the first time):
    python inspect_criteo.py

What it does:
  1. Streams the full Criteo v2.1 file from a public GitHub copy and keeps a random
     10% sample (about 1.4 million rows). It does NOT store the huge file.
  2. Saves the sample to data/raw/criteo_sample_10pct.csv (git-ignored, never uploaded).
  3. Prints shape, types, missing values, treatment ratio, outcome rates and uplift.

Why a random sample and not the first rows?
  The file is ordered: its first rows are ALL treated users. A random sample is needed
  for a fair control/treatment comparison.

The first run downloads a few hundred MB, so it can take several minutes.
Later runs reuse the saved sample and are instant.

If you already have the CSV:  python inspect_criteo.py path\\to\\file.csv
"""
import os
import sys
import pandas as pd

URLS = [
    "https://github.com/jszymon/uplift_sklearn_data/releases/download/Criteo/criteo-research-uplift-v2.1.csv.gz",
    "http://go.criteo.net/criteo-research-uplift-v2.1.csv.gz",   # official source
]
RAW_DIR = os.path.join("data", "raw")
SAMPLE = os.path.join(RAW_DIR, "criteo_sample_10pct.csv")
FRACTION = 0.10
SEED = 42


def stream_sample(url):
    parts, total = [], 0
    for chunk in pd.read_csv(url, compression="gzip", chunksize=500_000):
        total += len(chunk)
        parts.append(chunk.sample(frac=FRACTION, random_state=SEED))
        print(f"  read {total:,} rows...", end="\r")
    print(f"\n  finished: {total:,} rows read")
    return pd.concat(parts, ignore_index=True), total


def load():
    if len(sys.argv) > 1:
        print("Loading local file:", sys.argv[1])
        return pd.read_csv(sys.argv[1])
    if os.path.exists(SAMPLE):
        print("Using saved sample:", SAMPLE)
        return pd.read_csv(SAMPLE)
    os.makedirs(RAW_DIR, exist_ok=True)
    for url in URLS:
        print("Downloading from", url)
        try:
            df, total = stream_sample(url)
            df.to_csv(SAMPLE, index=False)
            print("Saved", len(df), "rows to", SAMPLE)
            return df
        except Exception as e:
            print("  failed:", type(e).__name__, str(e)[:150])
    sys.exit("All download sources failed. Check your internet connection and try again.")


def summarise(df):
    print("\nShape:", df.shape)
    print("\nColumn types:\n", df.dtypes)
    print("\nMissing values:", int(df.isna().sum().sum()))
    print("Duplicate rows:", int(df.duplicated().sum()),
          "(duplicates are expected here: users are anonymous, so identical rows can be different people)")
    print("\nTreatment counts (1 = shown ad, 0 = control):\n", df["treatment"].value_counts())
    print("Treatment ratio: {:.3f}  (expected about 0.85)".format(df["treatment"].mean()))
    print("\nOutcome rates by treatment group:")
    rates = df.groupby("treatment")[["visit", "conversion", "exposure"]].mean()
    print(rates.round(5))
    for y in ["visit", "conversion"]:
        diff = rates.loc[1, y] - rates.loc[0, y]
        print("Average uplift on {}: {:+.3%} (valid as a causal effect because treatment was randomised)".format(y, diff))
    print("\nOverall visit rate: {:.4f} (expected about 0.047)".format(df["visit"].mean()))
    print("Overall conversion rate: {:.5f} (expected about 0.0029)".format(df["conversion"].mean()))
    print("\nFeature summary (f0 to f11):")
    print(df[[f"f{i}" for i in range(12)]].describe().T.round(2))


if __name__ == "__main__":
    summarise(load())
