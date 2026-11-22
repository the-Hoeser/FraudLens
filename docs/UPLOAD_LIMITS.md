# CSV upload limits

| Layer | Limit | State |
|---|---:|---|
| FastAPI app | 300 MiB / 300,000 rows | Configured |
| GitHub frontend source | 300 MiB / 300,000 rows | Uses File.stream() |
| Static test bench | 300 MiB / 300,000 rows | Uses File.stream() |
| Hosted Lovable preview | 10 MiB / 50,000 rows | Not synced yet |
| Deployed API proxy | Not verified | Service still needs deployment |

## Apply to the hosted Lovable project

The updated UI source is under `frontend/`. The hosted Lovable project still reports the original source commit and 10 MiB limit. Link the GitHub repository and `main` branch in Lovable Project Settings → Git, synchronize the source, then verify the hosted Analyze page. The standalone script `scripts/patch_lovable_uploads.py` can also patch an exported copy of the older Lovable source.

## Backend

The FastAPI route accepts up to 300 MiB and 300,000 rows at the application layer. Upload requests are streamed to a temporary file and validated in 50,000-row chunks. Results are persisted in 2,000-row database batches.

A hosting proxy may impose a lower limit. The deployed host must be tested using the 150.8 MB ULB benchmark CSV. Until that test succeeds, treat 300 MiB as the application setting, not a verified end-to-end guarantee.

Use the Render web service rather than a Vercel Function for this upload route. The test bench can be statically hosted; the API should run as a long-lived web service.
