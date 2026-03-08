# ClearRight — Know Your Rights

> **Real-time AI legal information assistant. Upload any legal document, talk to Clara, and understand your rights — instantly and for free.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-clearright--ui-emerald?style=for-the-badge)](https://clearright-ui-q63ub5ulzq-uc.a.run.app)
[![Built with ADK](https://img.shields.io/badge/Google%20ADK-Gemini%20Live%20API-blue?style=for-the-badge)](https://google.github.io/adk-docs/)
[![Deployed on Cloud Run](https://img.shields.io/badge/Google%20Cloud%20Run-deployed-orange?style=for-the-badge)](https://cloud.google.com/run)

---

## The Problem

**60 million Americans face civil legal crises every year with no representation.**

Eviction notices. Debt collection letters. Court summons. Insurance denials. Workplace termination letters.

These documents are confusing by design — dense legal language that most people can't parse. A single lawyer consultation costs $200–500/hr. Legal aid organizations have years-long waitlists.

People lose their homes, their wages, and their rights — not because they're wrong, but because they don't understand a letter.

## The Solution

ClearRight puts a knowledgeable, compassionate legal information assistant in your pocket — Clara.

1. **Upload** your legal document (PDF or photo)
2. **Get an instant analysis** — document type, risk level, key points, and suggested questions
3. **Talk** to Clara via voice — ask anything, interrupt anytime
4. **Understand** what it means, what your rights are, and what to do next

No typing. No waiting. No cost.

---

## Features

- **Voice-first conversation** — Powered by Gemini Live API with native audio streaming. Speak naturally, interrupt Clara mid-sentence, and get instant responses.
- **Document analysis** — Upload a PDF or image and Clara reads it in seconds using Gemini's multimodal vision. The UI surfaces document type, risk level (high/medium/low), key points, and AI-generated suggested questions.
- **Real-time legal grounding** — Clara uses the `google_search` tool via ADK to ground responses in current law and cite real sources.
- **Live video/screen context** — Share your camera or screen so Clara can see documents, letters, or web pages in real time.
- **Bidi streaming** — Full bidirectional WebSocket streaming between browser, FastAPI backend, and the Gemini Live API with AudioWorklet-based audio pipeline.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                            ClearRight                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Browser (Next.js)                                                   │
│   │                                                                  │
│   ├── POST /upload ──────────────────────────────────────────────►  │
│   │        Gemini 2.5 Flash (vision extraction + doc analysis)       │
│   │        Returns: doc_type, risk_level, key_points, questions      │
│   │                                                                  │
│   └── WebSocket /ws/{user_id}?document_id=... ────────────────────► │
│            │  audio/pcm (16kHz) + image/jpeg frames                 │
│            │                                                         │
│            ▼                                                         │
│       FastAPI + Google ADK                                           │
│            │                                                         │
│            ├── InMemoryRunner + LiveRequestQueue                     │
│            │                                                         │
│            └── Gemini Live API (gemini-2.5-flash-native-audio)      │
│                     │                                                │
│                     ├── google_search tool (legal grounding)        │
│                     │                                                │
│                     └── audio/pcm (24kHz) ─────────────────────►   │
│                              AudioWorklet playback in browser        │
└─────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|---|---|
| **AI Model (voice)** | `gemini-2.5-flash-native-audio-latest` via Gemini Live API |
| **AI Model (document)** | `gemini-2.5-flash` — vision extraction + structured analysis |
| **Agent Framework** | Google Agent Development Kit (ADK) — bidi streaming |
| **Legal Grounding** | `google_search` tool via ADK |
| **Backend** | Python 3.11 + FastAPI + WebSockets |
| **Frontend** | Next.js 15 + TypeScript + Tailwind CSS |
| **Audio Pipeline** | Web Audio API + AudioWorklet (16kHz in / 24kHz out) |
| **Cloud** | Google Cloud Run (backend + frontend, separate services) |
| **CI/CD** | Automated via `deploy.sh` using Cloud Build + Artifact Registry |

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Google AI Studio API key — get one free at [aistudio.google.com](https://aistudio.google.com/)

### 1. Clone the repo

```bash
git clone https://github.com/engr-krooozy/clearright.git
cd clearright
```

### 2. Configure environment

```bash
cp .env.example server/.env
```

Edit `server/.env` and set your `GOOGLE_API_KEY`:

```env
GOOGLE_API_KEY=your_google_ai_studio_api_key_here
APP_NAME=clearright
AGENT_VOICE=Aoede
AGENT_LANGUAGE=en-US
```

### 3. Run locally

```bash
./run_local.sh
```

This starts:
- **Backend** at `http://localhost:8000`
- **Frontend** at `http://localhost:3000`

### Manual setup (alternative)

**Backend:**
```bash
cd server
pip install fastapi uvicorn google-genai google-adk python-multipart python-dotenv
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
cd client
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

Open `http://localhost:3000` in Chrome or Edge (required for Web Audio API / AudioWorklet support).

---

## Cloud Deployment (Google Cloud Run)

> Fully automated — one script deploys both backend and frontend.

### Prerequisites
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated
- A Google Cloud project with billing enabled

```bash
export GOOGLE_CLOUD_PROJECT=your-project-id
export GOOGLE_API_KEY=your_api_key
./deploy.sh
```

The script automatically:
1. Enables required GCP APIs (Cloud Run, Artifact Registry, Cloud Build, Generative Language)
2. Creates an Artifact Registry Docker repository
3. Builds backend and frontend images via Cloud Build (no local Docker required)
4. Deploys both services to Cloud Run with appropriate resource limits
5. Wires the backend URL into the frontend at build time
6. Prints the live URLs

### Live deployment

| Service | URL |
|---|---|
| Frontend | https://clearright-ui-q63ub5ulzq-uc.a.run.app |
| Backend API | https://clearright-api-q63ub5ulzq-uc.a.run.app/health |

---

## Usage

### With a document (recommended)
1. Open ClearRight in your browser
2. Upload your legal document (PDF or image, up to 20MB)
3. The right panel shows an instant AI analysis: document type, risk level, key points, and 4–5 suggested questions
4. Click **"Talk to Clara about your document"** and choose camera or screen share
5. Start talking — ask anything, interrupt anytime
6. Tap any suggested question to send it to Clara instantly

### Without a document
1. Click **"Talk to Clara"** and choose camera or screen share
2. Describe your situation verbally — Clara asks clarifying questions
3. Hold a physical document up to the camera if needed

### What Clara can help with
- Eviction notices and tenant rights
- Debt collection letters (FDCPA rights)
- Lease agreement review
- Court summons and response deadlines
- Insurance claim denials
- Workplace termination and employment rights
- Immigration document explanations
- Consumer contracts and terms of service

---

## Project Structure

```
clearright/
├── server/                        # FastAPI backend
│   ├── main.py                    # WebSocket + upload + analysis endpoints
│   ├── clearright_agent/
│   │   ├── agent.py               # ADK Agent definition (Clara)
│   │   ├── prompts.py             # Legal information system prompt
│   │   └── tools.py               # Legal search tools
│   ├── pyproject.toml
│   └── Dockerfile
├── client/                        # Next.js frontend
│   ├── src/
│   │   ├── app/page.tsx           # Main UI — orb, upload, controls
│   │   ├── components/
│   │   │   ├── ConversationPanel.tsx  # Document analysis + question chips
│   │   │   ├── DocumentUpload.tsx
│   │   │   └── Toast.tsx
│   │   ├── hooks/
│   │   │   └── useLiveConnection.ts   # WebSocket + audio/video pipeline
│   │   └── utils/encoding.ts
│   └── public/
│       ├── audio-player-worklet.js    # PCM audio playback (24kHz)
│       └── audio-recorder-worklet.js  # PCM audio capture + VAD (16kHz)
├── deploy.sh                      # Automated GCP deployment script
├── run_local.sh                   # Local development runner
└── .env.example                   # Environment variable template
```

---

## Legal Disclaimer

ClearRight provides **general legal information** only — not legal advice. Information provided does not constitute legal advice and does not create an attorney-client relationship. For advice specific to your situation, consult a licensed attorney or contact your local legal aid organization.

**Free legal aid resources:**
- [LawHelp.org](https://www.lawhelp.org) — Find legal aid by state
- [LegalServices.org](https://www.lsc.gov/about-lsc/what-legal-aid/get-legal-help) — Legal Services Corporation
- [ABA Free Legal Answers](https://www.abafreelegalanswers.org)

---

## Built for the Gemini Live Agent Challenge

This project was built for the [Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/) hosted by Google.

**Category:** Live Agents

**Key technologies used:**
- Gemini Live API — native audio bidi streaming
- Google Agent Development Kit (ADK)
- Google Cloud Run
- Gemini 2.5 Flash — multimodal document processing
- `google_search` tool — real-time legal grounding

\#GeminiLiveAgentChallenge
