FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY backend/artifacts ./artifacts
ENV DATABASE_URL=sqlite:///./fraudlens.db
ENV MODEL_DIR=./artifacts
ENV MAX_UPLOAD_BYTES=314572800
ENV MAX_UPLOAD_ROWS=300000
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
