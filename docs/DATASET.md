# Dataset

Source: https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud

Expected canonical file: `creditcard.csv`

- 284,807 rows
- 492 fraud labels (Class=1)
- 284,315 legitimate labels (Class=0)
- 31 columns: Time, V1–V28, Amount, Class
- Roughly 0.172% positive class

Do not commit the dataset to Git. It is a large file and the Kaggle download requires account terms acceptance. The code expects the CSV under `backend/data/raw/creditcard.csv`. After download, run `python scripts/verify_dataset.py` before training.

The dataset covers two days in September 2013; V1–V28 are anonymized PCA features. It is a teaching benchmark, not representative of all payment systems.
