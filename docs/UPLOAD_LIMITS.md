# CSV upload limits

| Layer | Limit | Status |
|---|---:|---|
| Frontend browser validator | 300 MiB / 300,000 rows | Streaming `File.stream()` |
| FastAPI app | 300 MiB / 300,000 rows | Streaming multipart-to-disk and chunk validation |
| API hosting proxy | Provider-specific | Must be tested with the benchmark file |

The React frontend is deployed on Vercel but uploads are sent directly from the browser to the FastAPI URL in `VITE_API_BASE_URL`. CSV bodies do not pass through a Vercel Function. Vercel's Function request-body limit therefore does not govern the upload, but the API host's ingress limit does.

Test with the actual 150.8 MB ULB benchmark CSV after the API service is deployed. The application-level limit is not an end-to-end guarantee until that test succeeds.
