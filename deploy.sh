#!/bin/bash
# ClearRight — Automated Google Cloud Run Deployment
# Usage: ./deploy.sh
# Requires: gcloud CLI authenticated, Docker

set -e

# ── Configuration ──────────────────────────────────────────────────────────
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project)}
REGION=${GOOGLE_CLOUD_LOCATION:-us-central1}
BACKEND_SERVICE="clearright-api"
FRONTEND_SERVICE="clearright-ui"
ARTIFACT_REPO="clearright"
IMAGE_PREFIX="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}"

if [ -z "${GOOGLE_API_KEY}" ]; then
  echo "❌ GOOGLE_API_KEY is not set. Export it before running this script:"
  echo "   export GOOGLE_API_KEY=your_api_key"
  exit 1
fi

echo "🚀 Deploying ClearRight to Google Cloud"
echo "   Project: ${PROJECT_ID}"
echo "   Region:  ${REGION}"

# ── Enable required APIs ────────────────────────────────────────────────────
echo "📡 Enabling Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  aiplatform.googleapis.com \
  generativelanguage.googleapis.com \
  --project="${PROJECT_ID}"

# ── Create Artifact Registry repository ────────────────────────────────────
echo "📦 Setting up Artifact Registry..."
gcloud artifacts repositories create "${ARTIFACT_REPO}" \
  --repository-format=docker \
  --location="${REGION}" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "   (repository already exists)"

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# ── Build & push backend ────────────────────────────────────────────────────
echo "🔨 Building backend image via Cloud Build..."
BACKEND_IMAGE="${IMAGE_PREFIX}/${BACKEND_SERVICE}:latest"
gcloud builds submit ./server \
  --tag="${BACKEND_IMAGE}" \
  --project="${PROJECT_ID}"

echo "☁️  Deploying backend to Cloud Run..."
gcloud run deploy "${BACKEND_SERVICE}" \
  --image="${BACKEND_IMAGE}" \
  --platform=managed \
  --region="${REGION}" \
  --allow-unauthenticated \
  --port=8000 \
  --memory=1Gi \
  --cpu=1 \
  --timeout=3600 \
  --set-env-vars="APP_NAME=clearright,AGENT_VOICE=Aoede,AGENT_LANGUAGE=en-US,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${REGION},GOOGLE_GENAI_USE_VERTEXAI=0,GOOGLE_API_KEY=${GOOGLE_API_KEY}" \
  --project="${PROJECT_ID}"

BACKEND_URL=$(gcloud run services describe "${BACKEND_SERVICE}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(status.url)")

echo "✅ Backend deployed: ${BACKEND_URL}"

# ── Build & push frontend ───────────────────────────────────────────────────
echo "🔨 Building frontend image via Cloud Build..."
FRONTEND_IMAGE="${IMAGE_PREFIX}/${FRONTEND_SERVICE}:latest"

# Write .env.production so the build arg is available
cat > client/.env.production << EOF
NEXT_PUBLIC_API_URL=${BACKEND_URL}
EOF

gcloud builds submit ./client \
  --tag="${FRONTEND_IMAGE}" \
  --project="${PROJECT_ID}"

echo "☁️  Deploying frontend to Cloud Run..."
gcloud run deploy "${FRONTEND_SERVICE}" \
  --image="${FRONTEND_IMAGE}" \
  --platform=managed \
  --region="${REGION}" \
  --allow-unauthenticated \
  --port=3000 \
  --memory=512Mi \
  --project="${PROJECT_ID}"

FRONTEND_URL=$(gcloud run services describe "${FRONTEND_SERVICE}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(status.url)")

echo ""
echo "🎉 ClearRight deployed successfully!"
echo "   Frontend: ${FRONTEND_URL}"
echo "   Backend:  ${BACKEND_URL}"
echo ""
