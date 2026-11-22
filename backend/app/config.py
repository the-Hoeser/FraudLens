from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except ImportError:
    pass

APP_VERSION = "0.1.0"
FEATURE_COLUMNS = ["Time", *[f"V{i}" for i in range(1, 29)], "Amount"]
ALLOWED_COLUMNS = {*FEATURE_COLUMNS, "Class"}
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(300 * 1024 * 1024)))
MAX_UPLOAD_ROWS = int(os.getenv("MAX_UPLOAD_ROWS", "300000"))
MODEL_DIR = Path(os.getenv("MODEL_DIR", "./artifacts")).resolve()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fraudlens.db")
DEFAULT_THRESHOLD = 0.5


def cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [item.strip() for item in raw.split(",") if item.strip()]
