# backend/app/api/audio.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from openai import AsyncOpenAI
import os

router = APIRouter(prefix="/audio", tags=["audio"])
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...), force_english: bool = True):
    """
    Mic audio -> text
    - Accepts webm/ogg/mp4/wav/mp3.
    - ALWAYS returns English text by default (Whisper translations).
    """
    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise ValueError("Empty audio")

        filename = file.filename or "audio.webm"
        content_type = file.content_type or "audio/webm"

        if force_english:
            # Force English output even if speech isn't English
            r = await client.audio.translations.create(
                model="whisper-1",
                file=(filename, audio_bytes, content_type),
                temperature=0,
            )
        else:
            # English speech -> English text (fine if you truly speak English)
            r = await client.audio.transcriptions.create(
                model="whisper-1",
                file=(filename, audio_bytes, content_type),
                language="en",
                temperature=0,
                prompt="Transcribe clear English with punctuation.",
            )

        return {"text": (r.text or "").strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")
