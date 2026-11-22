from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from ..config import FEATURE_COLUMNS, MODEL_DIR


class ModelBundle:
    def __init__(self, model_dir: Path = MODEL_DIR):
        self.model_dir = model_dir
        self.model: Any | None = None
        self.model_info: dict[str, Any] | None = None
        self.metrics: dict[str, Any] | None = None
        self.reload()

    def reload(self) -> None:
        model_path = self.model_dir / "model.joblib"
        info_path = self.model_dir / "model_info.json"
        metrics_path = self.model_dir / "metrics.json"
        self.model = joblib.load(model_path) if model_path.exists() else None
        self.model_info = json.loads(info_path.read_text()) if info_path.exists() else None
        self.metrics = json.loads(metrics_path.read_text()) if metrics_path.exists() else None

    @property
    def is_loaded(self) -> bool:
        return self.model is not None and self.model_info is not None

    @property
    def version(self) -> str | None:
        return str(self.model_info["version"]) if self.model_info else None

    @property
    def threshold(self) -> float:
        return float(self.model_info.get("threshold", 0.5)) if self.model_info else 0.5

    def predict_proba(self, frame: pd.DataFrame) -> np.ndarray:
        if not self.is_loaded:
            raise RuntimeError("No trained model artifact is available.")
        X = frame.loc[:, FEATURE_COLUMNS].astype(float)
        return self.model.predict_proba(X)[:, 1]

    def explain(self, row: pd.Series, top_n: int = 5) -> dict[str, Any]:
        if not self.is_loaded:
            return {"method": "none", "summary": "No trained model is loaded.", "top_features": []}
        classifier = self.model.named_steps.get("classifier") if hasattr(self.model, "named_steps") else self.model
        scaler = self.model.named_steps.get("scaler") if hasattr(self.model, "named_steps") else None
        if not hasattr(classifier, "coef_"):
            return {"method": "none", "summary": "Feature-level explanation is not available for this model.", "top_features": []}
        vector_frame = pd.DataFrame([row.loc[FEATURE_COLUMNS].astype(float).to_dict()], columns=FEATURE_COLUMNS)
        vector = vector_frame.to_numpy()[0]
        transformed = scaler.transform(vector_frame)[0] if scaler is not None else vector
        contributions = transformed * classifier.coef_[0]
        order = np.argsort(np.abs(contributions))[::-1][:top_n]
        top = [
            {"feature": FEATURE_COLUMNS[i], "value": float(vector[i]), "contribution": float(contributions[i])}
            for i in order
        ]
        lead = top[0]["feature"] if top else "the supplied features"
        return {
            "method": "logistic_regression_coefficients",
            "summary": f"Relative model contributions are led by {lead}; this is a model explanation, not proof of fraud.",
            "top_features": top,
        }
