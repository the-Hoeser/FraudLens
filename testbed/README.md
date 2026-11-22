# API Test Bench

A lightweight browser page for testing the FastAPI backend without the Lovable agent. Connect to the API URL, load real model metrics, validate the ULB CSV with streaming browser reads, submit the CSV, and poll the live analysis job.

This page accepts up to 300 MiB client-side. The API host must also accept the request size. Do not assume a Vercel Function can proxy a 150.8 MB CSV; use the Render web service described in the repository root Blueprint instead.
