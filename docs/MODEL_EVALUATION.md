# Model evaluation protocol

1. Validate the expected feature schema and binary Class label.
2. Split with stratification into 70% train, 15% validation and 15% test.
3. Fit class-weighted Logistic Regression and Random Forest on train only.
4. Select the algorithm by validation PR-AUC; tune the decision threshold using validation F1.
5. Evaluate the selected model once on the held-out test split.
6. Persist precision, recall, F1, PR-AUC, ROC-AUC, confusion matrix, threshold curve and dataset SHA-256.

The test set is never used for model selection, resampling or threshold tuning. Accuracy is not used as the sole metric. No metric is claimed until the real benchmark has been trained and evaluated.
