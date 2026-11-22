from __future__ import annotations

import csv
import math
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd

from ..config import ALLOWED_COLUMNS, FEATURE_COLUMNS, MAX_UPLOAD_BYTES, MAX_UPLOAD_ROWS

CHUNK_ROWS = 50_000
MAX_REPORTED_ISSUES = 50


@dataclass
class ValidationIssue:
    row: int | None
    column: str | None
    message: str


@dataclass
class ValidationResult:
    valid: bool
    headers: list[str] = field(default_factory=list)
    row_count: int = 0
    has_label_column: bool = False
    errors: list[ValidationIssue] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    frame: pd.DataFrame | None = None

    def public_errors(self) -> list[dict[str, Any]]:
        return [issue.__dict__ for issue in self.errors]


def _add_error(result: ValidationResult, row: int | None, column: str | None, message: str) -> None:
    if len(result.errors) < MAX_REPORTED_ISSUES:
        result.errors.append(ValidationIssue(row, column, message))


def validate_csv_file(path: Path) -> ValidationResult:
    """Validate a CSV incrementally, then return a normalized feature frame."""
    result = ValidationResult(valid=False)
    if not path.exists() or path.stat().st_size == 0:
        _add_error(result, None, None, "The file is empty.")
        return result
    if path.stat().st_size > MAX_UPLOAD_BYTES:
        _add_error(result, None, None, f"File is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MiB.")
        return result

    try:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.reader(handle)
            headers = [value.strip() for value in next(reader)]
    except (UnicodeDecodeError, csv.Error, StopIteration) as exc:
        _add_error(result, None, None, f"Could not read CSV header: {exc or 'missing header'}.")
        return result

    result.headers = headers
    result.has_label_column = "Class" in headers
    if not headers:
        _add_error(result, None, None, "The file has no columns.")
        return result
    if len(set(headers)) != len(headers):
        _add_error(result, None, None, "Duplicate column names are not allowed.")
    missing = [column for column in FEATURE_COLUMNS if column not in headers]
    unexpected = [column for column in headers if column not in ALLOWED_COLUMNS]
    if missing:
        _add_error(result, None, None, f"Missing required column(s): {', '.join(missing)}.")
    if unexpected:
        _add_error(result, None, None, "Unexpected column(s): " + ", ".join(unexpected) + ". Only the anonymized feature schema is accepted; remove personal/payment data.")
    if result.errors:
        return result

    canonical_columns = [*FEATURE_COLUMNS, *(["Class"] if result.has_label_column else [])]
    chunks: list[pd.DataFrame] = []
    row_offset = 0
    try:
        reader = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8-sig", chunksize=CHUNK_ROWS, on_bad_lines="error")
        for raw_chunk in reader:
            chunk_start = row_offset
            row_offset += len(raw_chunk)
            if row_offset > MAX_UPLOAD_ROWS:
                _add_error(result, None, None, f"Too many rows ({row_offset}+). The limit is {MAX_UPLOAD_ROWS:,}.")
                return result
            if set(raw_chunk.columns) != set(headers):
                _add_error(result, None, None, "CSV rows do not match the header column count.")
                return result
            chunk = raw_chunk.loc[:, canonical_columns].copy()
            for column in canonical_columns:
                numeric = pd.to_numeric(chunk[column], errors="coerce")
                bad = numeric.isna() | ~numeric.map(lambda value: math.isfinite(float(value)) if pd.notna(value) else False)
                if bad.any():
                    local_index = int(bad[bad].index[0])
                    _add_error(result, chunk_start + local_index + 1, column, "Missing, non-numeric, or non-finite value.")
                chunk[column] = numeric
            for column in ("Time", "Amount"):
                negative = chunk[column] < 0
                if negative.any():
                    local_index = int(negative[negative].index[0])
                    _add_error(result, chunk_start + local_index + 1, column, "Values must be >= 0.")
            if result.has_label_column:
                invalid_label = ~chunk["Class"].isin([0, 1])
                if invalid_label.any():
                    local_index = int(invalid_label[invalid_label].index[0])
                    _add_error(result, chunk_start + local_index + 1, "Class", "Class must contain only 0 or 1.")
            chunks.append(chunk)
            if len(result.errors) >= MAX_REPORTED_ISSUES:
                return result
    except (UnicodeDecodeError, pd.errors.ParserError, ValueError) as exc:
        _add_error(result, None, None, f"Could not parse CSV: {str(exc)[:200]}.")
        return result

    result.row_count = row_offset
    if row_offset == 0:
        _add_error(result, None, None, "The file has a header but no data rows.")
        return result
    if result.has_label_column:
        result.warnings.append("The Class column is ignored for prediction (to prevent label leakage) and retained only for offline comparison.")
    result.valid = not result.errors
    if result.valid:
        result.frame = pd.concat(chunks, ignore_index=True).loc[:, canonical_columns]
    return result


def validate_csv_bytes(content: bytes) -> ValidationResult:
    if len(content) > MAX_UPLOAD_BYTES:
        result = ValidationResult(valid=False)
        _add_error(result, None, None, f"File is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MiB.")
        return result
    with tempfile.NamedTemporaryFile(suffix=".csv") as handle:
        handle.write(content)
        handle.flush()
        return validate_csv_file(Path(handle.name))
