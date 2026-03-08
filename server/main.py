import asyncio
import base64
import json
import logging
import os
import uuid
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from google.adk.agents import LiveRequestQueue
from google.adk.agents.run_config import RunConfig
from google.adk.runners import InMemoryRunner
from google.genai import types
from google.genai.types import Blob, Content, Part
from starlette.websockets import WebSocketDisconnect

from clearright_agent.agent import root_agent

load_dotenv()

logging.basicConfig(level=logging.INFO)

# In-memory document store: document_id -> extracted text content
document_store: dict[str, str] = {}

app = FastAPI(title="ClearRight API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Document Upload Endpoint
# ---------------------------------------------------------------------------

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Accepts a PDF or image file. Extracts text using Gemini and returns a
    document_id that can be passed to the WebSocket session.
    """
    allowed_types = {
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Please upload a PDF or image.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > 20 * 1024 * 1024:  # 20MB limit
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 20MB.")

    try:
        from google import genai as google_genai

        use_vertexai = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").lower() in ("1", "true")
        if use_vertexai:
            client = google_genai.Client(
                vertexai=True,
                project=os.getenv("GOOGLE_CLOUD_PROJECT"),
                location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1"),
            )
        else:
            client = google_genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

        extraction_prompt = """Please extract and transcribe ALL text content from this document completely and accurately.
        Preserve the structure and layout as much as possible.
        Include all dates, names, amounts, addresses, and legal terms exactly as written.
        Do not summarize — provide the full text."""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=file_bytes, mime_type=file.content_type),
                extraction_prompt,
            ],
        )

        extracted_text = response.text
        document_id = str(uuid.uuid4())
        document_store[document_id] = extracted_text

        logging.info(f"Document uploaded and processed: {document_id} ({len(extracted_text)} chars)")

        # Generate document analysis
        analysis = None
        try:
            analysis_prompt = """Analyze this legal document and return ONLY a valid JSON object with this exact structure (no markdown fences, no extra text):
{
  "doc_type": "document type in 2-4 words (e.g. Lease Agreement, Employment Contract, Terms of Service)",
  "risk_level": "high or medium or low",
  "key_points": ["most important thing to know, 1 sentence", "second important thing, 1 sentence"],
  "suggested_questions": ["specific question about this document?", "another specific question?", "third question?", "fourth question?"]
}"""
            analysis_response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    f"Here is the full text of a legal document:\n\n{extracted_text[:8000]}",
                    analysis_prompt,
                ],
            )
            raw = analysis_response.text.strip()
            if raw.startswith("```"):
                parts = raw.split("```")
                raw = parts[1] if len(parts) > 1 else raw
                if raw.startswith("json"):
                    raw = raw[4:]
            analysis = json.loads(raw.strip())
        except Exception as e:
            logging.warning(f"Document analysis failed (non-fatal): {e}")

        return {
            "document_id": document_id,
            "filename": file.filename,
            "char_count": len(extracted_text),
            "preview": extracted_text[:200] + "..." if len(extracted_text) > 200 else extracted_text,
            "analysis": analysis,
        }

    except Exception as e:
        logging.error(f"Document processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")


# ---------------------------------------------------------------------------
# Agent Session Management
# ---------------------------------------------------------------------------

async def start_agent_session(user_id: str):
    """Starts an ADK agent session."""

    runner = InMemoryRunner(
        app_name=os.getenv("APP_NAME", "clearright"),
        agent=root_agent,
    )

    session = await runner.session_service.create_session(
        app_name=os.getenv("APP_NAME", "clearright"),
        user_id=user_id,
    )

    live_request_queue = LiveRequestQueue()

    run_config = RunConfig(
        streaming_mode="bidi",
        response_modalities=[types.Modality.AUDIO],
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_HIGH,
                end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
                prefix_padding_ms=100,
                silence_duration_ms=200,
            )
        ),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=os.getenv("AGENT_VOICE", "Aoede")
                )
            ),
            language_code=os.getenv("AGENT_LANGUAGE", "en-US"),
        ),
    )

    live_events = runner.run_live(
        session=session,
        live_request_queue=live_request_queue,
        run_config=run_config,
    )
    return live_events, live_request_queue


# ---------------------------------------------------------------------------
# WebSocket Messaging
# ---------------------------------------------------------------------------

async def agent_to_client_messaging(websocket: WebSocket, live_events):
    """Streams agent events back to the client."""
    try:
      async for event in live_events:
        try:
            # DEBUG
            if event.content:
                logging.info(f"[EVENT] author={event.author} partial={event.partial} turn_complete={event.turn_complete} role={getattr(event.content,'role',None)} parts={[(p.text[:60] if p.text else ('AUDIO' if p.inline_data else ('FC:'+p.function_call.name if p.function_call else ('FR:'+p.function_response.name if p.function_response else '?')))) for p in event.content.parts]}")
            else:
                logging.info(f"[EVENT] author={event.author} partial={event.partial} turn_complete={event.turn_complete} content=None")

            message_to_send = {
                "author": event.author or "agent",
                "is_partial": event.partial or False,
                "turn_complete": event.turn_complete or False,
                "interrupted": event.interrupted or False,
                "parts": [],
                "input_transcription": None,
                "output_transcription": None,
            }

            if not event.content:
                if message_to_send["turn_complete"] or message_to_send["interrupted"]:
                    await websocket.send_text(json.dumps(message_to_send))
                continue

            transcription_text = "".join(
                part.text for part in event.content.parts if part.text
            )

            if getattr(event.content, "role", None) == "user":
                if transcription_text:
                    message_to_send["input_transcription"] = {
                        "text": transcription_text,
                        "is_final": not event.partial,
                    }

            else:  # role == "model" or role is None (native audio model)
                if transcription_text:
                    message_to_send["parts"].append({"type": "text", "data": transcription_text})

                for part in event.content.parts:
                    if part.inline_data and part.inline_data.mime_type.startswith("audio/pcm"):
                        encoded_audio = base64.b64encode(part.inline_data.data).decode("ascii")
                        message_to_send["parts"].append({"type": "audio/pcm", "data": encoded_audio})

                    elif part.function_call:
                        message_to_send["parts"].append({
                            "type": "function_call",
                            "data": {"name": part.function_call.name, "args": part.function_call.args or {}},
                        })

                    elif part.function_response:
                        message_to_send["parts"].append({
                            "type": "function_response",
                            "data": {"name": part.function_response.name, "response": part.function_response.response or {}},
                        })

            if (
                message_to_send["parts"]
                or message_to_send["turn_complete"]
                or message_to_send["interrupted"]
                or message_to_send["input_transcription"]
                or message_to_send["output_transcription"]
            ):
                await websocket.send_text(json.dumps(message_to_send))

        except Exception as e:
            logging.error(f"Error in agent_to_client_messaging: {e}")
    except Exception as e:
        logging.warning(f"Live event stream ended: {e}")


async def client_to_agent_messaging(websocket: WebSocket, live_request_queue: LiveRequestQueue):
    """Receives client messages and forwards to the agent."""
    while True:
        try:
            message_json = await websocket.receive_text()
            message = json.loads(message_json)
            mime_type = message["mime_type"]

            if mime_type == "text/plain":
                content = Content(role="user", parts=[Part(text=message["data"])])
                live_request_queue.send_content(content=content)

            elif mime_type == "audio/pcm":
                decoded_data = base64.b64decode(message["data"])
                live_request_queue.send_realtime(Blob(data=decoded_data, mime_type=mime_type))

            elif mime_type == "image/jpeg":
                decoded_data = base64.b64decode(message["data"])
                live_request_queue.send_realtime(Blob(data=decoded_data, mime_type=mime_type))

            else:
                logging.warning(f"Unsupported mime type: {mime_type}")

        except WebSocketDisconnect:
            logging.info("Client disconnected.")
            break
        except Exception as e:
            logging.error(f"Error in client_to_agent_messaging: {e}")


# ---------------------------------------------------------------------------
# WebSocket Endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    document_id: Optional[str] = None,
):
    """
    Main WebSocket endpoint for live voice + vision conversation with Clara.
    Optionally accepts a document_id to pre-load a previously uploaded document.
    """
    await websocket.accept()

    document_context = None
    if document_id and document_id in document_store:
        document_context = document_store[document_id]
        logging.info(f"Session {user_id} loaded document {document_id}")

    live_events, live_request_queue = await start_agent_session(user_id)

    if document_context:
        # First send the document text so Clara has full context
        live_request_queue.send_content(content=Content(
            role="user",
            parts=[Part(text=f"[DOCUMENT UPLOADED BY USER]\n\n{document_context}")],
        ))
        # Then prompt Clara to greet and summarise
        live_request_queue.send_content(content=Content(
            role="user",
            parts=[Part(text=(
                "Please greet me briefly, confirm you've read my document, "
                "and tell me the single most important thing I should know about it."
            ))],
        ))
    else:
        # No document — just have Clara introduce herself
        live_request_queue.send_content(content=Content(
            role="user",
            parts=[Part(text="Hello, please introduce yourself briefly.")],
        ))

    agent_to_client_task = asyncio.create_task(agent_to_client_messaging(websocket, live_events))
    client_to_agent_task = asyncio.create_task(client_to_agent_messaging(websocket, live_request_queue))

    await asyncio.wait([agent_to_client_task, client_to_agent_task], return_when=asyncio.FIRST_COMPLETED)

    agent_to_client_task.cancel()
    client_to_agent_task.cancel()
    live_request_queue.close()
    logging.info(f"Client {user_id} disconnected")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ClearRight API"}
