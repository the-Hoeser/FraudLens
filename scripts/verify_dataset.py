from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

import pandas as pd

EXPECTED_ROWS = 284_807
EXPECTED_FRAUD = 492
EXPECTED_COLUMNS = 31


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate the ULB/Kaggle benchmark file.")
    parser.add_argument("path", type=Path, nargs="?", default=Path("backend/data/raw/creditcard.csv"))
    args = parser.parse_args()
    if not args.path.exists():
        raise SystemExit(f"Dataset not found: {args.path}")
    frame = pd.read_csv(args.path)
    counts = frame["Class"].value_counts().to_dict() if "Class" in frame else {}
    digest = hashlib.sha256()
    with args.path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    report = {
        "file": str(args.path), "rows": int(len(frame)), "columns": int(len(frame.columns)),
        "fraud_rows": int(counts.get(1, 0)), "legitimate_rows": int(counts.get(0, 0)),
        "fraud_rate": float(frame["Class"].mean()) if "Class" in frame else None,
        "sha256": digest.hexdigest(),
    }
    print(report)
    if len(frame) != EXPECTED_ROWS or len(frame.columns) != EXPECTED_COLUMNS or counts.get(1, 0) != EXPECTED_FRAUD:
        raise SystemExit("Integrity check failed: expected 284,807 rows, 31 columns and 492 fraud labels.")
    print("Dataset integrity checks passed.")


if __name__ == "__main__":
    main()
