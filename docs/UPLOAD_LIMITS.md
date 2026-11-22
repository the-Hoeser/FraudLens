# CSV upload limits

## Current limits

- FastAPI server: 300 MiB (314,572,800 bytes) and 300,000 data rows.
- Validation: 50,000-row Pandas chunks after the multipart upload has been streamed to a temporary file.
- Persistence: 2,000 transaction records per database batch.
- Lovable browser UI: still has the original 10 MiB / 50,000-row check until the patch is applied to the exported frontend source and synced back to Lovable.

## Apply the frontend patch

```bash
python scripts/patch_lovable_uploads.py /path/to/exported-lovable-project
```

The patch changes the browser-side cap to 300 MiB / 300,000 rows and validates using `File.stream()` rather than reading the whole CSV into one JS string.

## Important

The 300 MiB number is an application-level cap, not a promise that every hosting proxy accepts that request size. Verify the deployed service with the 150.8 MB benchmark CSV. Vercel Functions impose a much smaller ingress limit; do not place this large-file API route behind a standard Vercel Function. A long-running API host such as Render is the intended target. Training directly from a local/server disk copy is preferred over browser-uploading the training dataset.
