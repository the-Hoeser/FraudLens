from __future__ import annotations

import argparse
import re
from pathlib import Path

VALIDATOR = Path(__file__).resolve().parents[1] / "frontend/patches/streaming_csv_validator.ts.txt"


def patch_schema(path: Path) -> None:
    source = path.read_text(encoding="utf-8")
    source = source.replace(
        "export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;",
        "export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;",
    )
    source = source.replace(
        "export const MAX_UPLOAD_ROWS = 50_000;",
        "export const MAX_UPLOAD_ROWS = 300_000;",
    )
    addition = VALIDATOR.read_text(encoding="utf-8")
    if "export async function validateCsvFile" not in source:
        source = source.rstrip() + "\n\n" + addition + "\n"
    path.write_text(source, encoding="utf-8")


def patch_analyze(path: Path) -> None:
    source = path.read_text(encoding="utf-8")
    source = source.replace(
        "{ MAX_UPLOAD_BYTES, MAX_UPLOAD_ROWS, validateCsvText, type CsvValidationResult }",
        "{ MAX_UPLOAD_BYTES, MAX_UPLOAD_ROWS, validateCsvFile, type CsvValidationResult }",
    )
    source, replacements = re.subn(
        r"\s*const text = await f\.text\(\);\s*setValidation\(validateCsvText\(text, f\.size\)\);",
        "\n      setValidation(await validateCsvFile(f));",
        source,
        count=1,
    )
    if replacements != 1:
        raise RuntimeError("Could not locate the whole-file browser read in analyze.tsx")
    if "validateCsvText" in source:
        raise RuntimeError("Could not replace the whole-file browser parser in analyze.tsx")
    path.write_text(source, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Patch exported Lovable source for streaming 300 MiB CSV validation.")
    parser.add_argument("project_dir", type=Path, help="Root of an exported/cloned FraudLens Lovable frontend")
    args = parser.parse_args()
    schema = args.project_dir / "src/lib/csv/schema.ts"
    analyze = args.project_dir / "src/routes/analyze.tsx"
    if not schema.exists() or not analyze.exists():
        raise SystemExit("Expected src/lib/csv/schema.ts and src/routes/analyze.tsx in the supplied project directory.")
    patch_schema(schema)
    patch_analyze(analyze)
    print("Patched frontend CSV validation: 300 MiB / 300,000 rows, streamed through File.stream().")


if __name__ == "__main__":
    main()
