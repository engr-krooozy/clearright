FROM python:3.11-slim

WORKDIR /app

RUN pip install uv

# Install dependencies only (no local package build)
COPY pyproject.toml .
RUN uv pip install --system \
    "pydantic>=2.11.7" \
    "python-dotenv>=1.1.1" \
    "uvicorn>=0.35.0" \
    "fastapi>=0.116.1" \
    "google-genai>=1.36.0" \
    "google-adk>=1.14.1" \
    "python-multipart>=0.0.20"

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
