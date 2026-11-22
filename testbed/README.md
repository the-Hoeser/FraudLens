# API Test Bench

A standalone browser tool for testing FraudLens API health, model metrics, large CSV validation, upload, job progress and prediction results. This page uses streaming browser validation with an application-level limit of 300 MiB and 300,000 rows.

## Enable the test page

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions** and save.
3. Open **Actions → Deploy API test bench to GitHub Pages → Run workflow**.
4. When the run succeeds, open https://the-hoeser.github.io/FraudLens/.

The workflow is manual because the first automatic attempt showed the repository's Pages site is not yet enabled and the GitHub Actions integration cannot create it without the repository setting being enabled.

## Use it

Enter the deployed FastAPI base URL, click Connect, then choose the Kaggle `creditcard.csv`. The page validates the schema in chunks, submits to `POST /api/analyze`, and polls the job status.

This testbench can send requests up to 300 MiB, but the API host's reverse proxy / ingress limit must also accept the file. It does not test real model performance unless a trained model is present on the API.
