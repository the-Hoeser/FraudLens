from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from ..config import FEATURE_COLUMNS, MODEL_DIR

DATASET_NAME = "ULB Credit Card Fraud Detection"
DATASET_URL = "https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud"
LIMITATIONS = [
    "The dataset covers only two days of European cardholder activity in September 2013.",
    "V1-V28 are PCA-transformed anonymized components; their original business meanings are not available.",
    "The observed fraud prevalence is approximately 0.172%; precision and recall depend on threshold and deployment prevalence.",
    "This educational model is not validated for live payment decisions or modern fraud patterns.",
]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def confusion_at_threshold(y_true: np.ndarray, probability: np.ndarray, threshold: float) -> dict[str, int]:
    tn, fp, fn, tp = confusion_matrix(y_true, probability >= threshold, labels=[0, 1]).ravel()
    return {"tp": int(tp), "fp": int(fp), "tn": int(tn), "fn": int(fn)}


def threshold_stats(y_true: np.ndarray, probability: np.ndarray, threshold: float) -> dict[str, float | int]:
    pred = probability >= threshold
    return {
        "threshold": float(threshold),
        "precision": float(precision_score(y_true, pred, zero_division=0)),
        "recall": float(recall_score(y_true, pred, zero_division=0)),
        "f1": float(f1_score(y_true, pred, zero_division=0)),
        **confusion_at_threshold(y_true, probability, threshold),
    }


def train(dataset_path: Path, model_dir: Path = MODEL_DIR, random_state: int = 42) -> dict:
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}. See docs/DATASET.md.")
    df = pd.read_csv(dataset_path)
    required = [*FEATURE_COLUMNS, "Class"]
    missing = [column for column in required if column not in df.columns]
    unexpected = [column for column in df.columns if column not in required]
    if missing or unexpected:
        raise ValueError(f"Dataset schema mismatch. Missing={missing}; unexpected={unexpected}")
    if df[required].isna().any().any():
        raise ValueError("Dataset contains missing values; clean/review it before training.")
    if not df["Class"].isin([0, 1]).all() or df["Class"].nunique() != 2:
        raise ValueError("Class must contain both 0 and 1.")

    X = df[FEATURE_COLUMNS].astype(float)
    y = df["Class"].astype(int).to_numpy()
    X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.30, random_state=random_state, stratify=y)
    X_valid, X_test, y_valid, y_test = train_test_split(X_temp, y_temp, test_size=0.50, random_state=random_state, stratify=y_temp)

    candidates = {
        "logistic_regression": Pipeline([
            ("scaler", StandardScaler()),
            ("classifier", LogisticRegression(class_weight="balanced", max_iter=1500, solver="lbfgs", random_state=random_state)),
        ]),
        "random_forest": RandomForestClassifier(
            n_estimators=100, max_depth=16, min_samples_leaf=2,
            class_weight="balanced_subsample", n_jobs=-1, random_state=random_state,
        ),
    }
    candidate_thresholds = np.unique(np.r_[np.linspace(0.01, 0.99, 99), 0.5])
    fitted = {}
    comparison = []
    for algorithm, estimator in candidates.items():
        estimator.fit(X_train, y_train)
        valid_probability = estimator.predict_proba(X_valid)[:, 1]
        valid_pr_auc = float(average_precision_score(y_valid, valid_probability))
        curve = [threshold_stats(y_valid, valid_probability, float(t)) for t in candidate_thresholds]
        best = max(curve, key=lambda point: (point["f1"], point["precision"], point["threshold"]))
        fitted[algorithm] = {"estimator": estimator, "curve": curve, "best": best}
        comparison.append({
            "algorithm": algorithm, "validation_pr_auc": valid_pr_auc,
            "best_validation_precision": float(best["precision"]),
            "best_validation_recall": float(best["recall"]),
            "best_validation_f1": float(best["f1"]),
            "selected_threshold": float(best["threshold"]),
        })

    selected = max(comparison, key=lambda entry: (entry["validation_pr_auc"], entry["best_validation_f1"], entry["best_validation_precision"]))
    algorithm = str(selected["algorithm"])
    estimator = fitted[algorithm]["estimator"]
    curve = fitted[algorithm]["curve"]
    threshold = float(fitted[algorithm]["best"]["threshold"])

    test_probability = estimator.predict_proba(X_test)[:, 1]
    test_pred = test_probability >= threshold
    metrics = {
        "precision": float(precision_score(y_test, test_pred, zero_division=0)),
        "recall": float(recall_score(y_test, test_pred, zero_division=0)),
        "f1": float(f1_score(y_test, test_pred, zero_division=0)),
        "pr_auc": float(average_precision_score(y_test, test_probability)),
        "roc_auc": float(roc_auc_score(y_test, test_probability)),
        "support_positive": int((y_test == 1).sum()),
        "support_negative": int((y_test == 0).sum()),
    }
    matrix = confusion_at_threshold(y_test, test_probability, threshold)
    trained_at = datetime.now(timezone.utc).isoformat()
    dataset_hash = sha256_file(dataset_path)
    version_prefix = "lr" if algorithm == "logistic_regression" else "rf"
    version = f"{version_prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{dataset_hash[:8]}"
    model_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(estimator, model_dir / "model.joblib")
    model_info = {
        "name": "fraudlens-baseline", "version": version, "algorithm": algorithm,
        "training_run_id": f"run-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{dataset_hash[:8]}",
        "trained_at": trained_at,
        "dataset": {"name": DATASET_NAME, "source_url": DATASET_URL, "rows": int(len(df)), "positive_rate": float(y.mean()), "sha256": dataset_hash},
        "feature_schema": FEATURE_COLUMNS, "threshold": threshold,
        "threshold_selection": "Maximum F1 on stratified validation split; test split evaluated once after selection.",
        "class_imbalance_strategy": "class_weight=balanced or balanced_subsample; no resampling.",
        "model_comparison": comparison,
        "limitations": LIMITATIONS,
        "split": {"train_rows": len(X_train), "validation_rows": len(X_valid), "test_rows": len(X_test), "random_state": random_state},
    }
    report = {
        "status": "evaluated", "model": model_info, "split": "test", "threshold": threshold,
        "metrics": metrics, "confusion_matrix": matrix,
        "threshold_curve_split": "validation", "threshold_curve": curve,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }
    (model_dir / "model_info.json").write_text(json.dumps(model_info, indent=2))
    (model_dir / "metrics.json").write_text(json.dumps(report, indent=2))
    (model_dir / "threshold_curve.json").write_text(json.dumps(curve, indent=2))
    (model_dir / "model_comparison.json").write_text(json.dumps(comparison, indent=2))
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and evaluate the FraudLens baseline model.")
    parser.add_argument("--data", type=Path, default=Path("data/raw/creditcard.csv"))
    parser.add_argument("--model-dir", type=Path, default=MODEL_DIR)
    parser.add_argument("--random-state", type=int, default=42)
    args = parser.parse_args()
    report = train(args.data, args.model_dir, args.random_state)
    print(json.dumps({
        "model_version": report["model"]["version"], "dataset_rows": report["model"]["dataset"]["rows"],
        "fraud_rate": report["model"]["dataset"]["positive_rate"], "threshold": report["threshold"],
        "test_metrics": report["metrics"], "confusion_matrix": report["confusion_matrix"],
    }, indent=2))


if __name__ == "__main__":
    main()
