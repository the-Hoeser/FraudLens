#!/usr/bin/env bash
set -euo pipefail
# Requires Kaggle terms acceptance and ~/.kaggle/kaggle.json or KAGGLE_USERNAME/KAGGLE_KEY.
mkdir -p backend/data/raw
python -m pip install --upgrade kaggle
kaggle datasets download -d mlg-ulb/creditcardfraud -p backend/data/raw --unzip
python scripts/verify_dataset.py backend/data/raw/creditcard.csv
