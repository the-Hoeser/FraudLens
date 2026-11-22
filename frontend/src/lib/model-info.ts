/** Static, factual reference content about the dataset and planned pipeline (not results). */
export const DATASET_FACTS = {
  name: "ULB Credit Card Fraud Detection",
  sourceUrl: "https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud",
  rows: 284_807,
  frauds: 492,
  positiveRate: 492 / 284_807,
  period: "Two days in September 2013",
  origin: "Transactions by European cardholders, released by the Machine Learning Group of Université Libre de Bruxelles (ULB) with Worldline",
  license: "Open Database License (ODbL) — accept the terms on Kaggle before downloading",
} as const;

export const FEATURE_DICTIONARY = [
  { name: "Time", type: "float", description: "Seconds elapsed since the first transaction in the dataset. Not a wall-clock time." },
  { name: "V1 … V28", type: "float", description: "Principal components from a PCA transform applied by the dataset authors to protect confidentiality. The original features are not disclosed." },
  { name: "Amount", type: "float", description: "Transaction amount (currency not stated). Not PCA-transformed." },
  { name: "Class", type: "0 / 1", description: "Target label: 1 = fraud, 0 = legitimate. Used for training/evaluation only, never as an input." },
] as const;

export const KNOWN_LIMITATIONS = [
  "The dataset is anonymized (PCA) and covers two days of European card transactions in 2013 — it is not representative of all real-world fraud, regions, channels or time periods.",
  "Extreme class imbalance (~0.17% fraud) means accuracy is misleading; precision, recall, F1 and PR-AUC are the primary metrics.",
  "V1–V28 have no human-readable meaning, so explanations describe components, not real behaviours.",
  "Scores are not calibrated probabilities until a calibration step is added and validated.",
  "Concept drift: fraud patterns change over time; a model trained on 2013 data will degrade on new data.",
  "This is an educational project. It must not be used to make real decisions about people or payments.",
] as const;

export const PIPELINE_STEPS = [
  { title: "Reproducible data loading", detail: "Schema check, SHA-256 of the source file, fixed random seed." },
  { title: "Stratified split", detail: "Train 60% / validation 20% / test 20%, preserving the fraud rate. Splits are checked to be disjoint." },
  { title: "Leakage prevention", detail: "Scaler and any resampling are fit on the training fold only; Class is never a feature; test data is touched once." },
  { title: "Baseline", detail: "Logistic Regression with standardization and class_weight='balanced'." },
  { title: "Imbalance handling", detail: "Class weights by default; optional random undersampling applied to the training fold only." },
  { title: "Stronger models", detail: "Random Forest (balanced_subsample) and optional XGBoost (scale_pos_weight)." },
  { title: "Threshold tuning", detail: "Pick the decision threshold on the validation split (max F1, optional precision floor) — never on test." },
  { title: "Final evaluation", detail: "Precision, recall, F1, PR-AUC, ROC-AUC and confusion matrix on the held-out test split, once." },
  { title: "Later enhancements", detail: "Probability calibration, SHAP-style explanations, drift monitoring, time-based splits." },
] as const;