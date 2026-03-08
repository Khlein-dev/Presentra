import os
import io
import wave
import numpy as np
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from speechbrain.inference import EncoderDecoderASR
from pydub import AudioSegment

app = FastAPI()

# Allow React to communicate with Python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load SpeechBrain Model (This happens once at startup)
# 'asr-wav-en-cv' is a lightweight English model
print("Loading SpeechBrain model...")
asr_model = EncoderDecoderASR.from_hparams(
    source="speechbrain/asr-wav-en-cv",
    savedir="pretrained_models/asr-wav-en-cv"
)
print("Model loaded successfully.")

def calculate_wpm(text, duration_seconds):
    if not text or duration_seconds <= 0:
        return 0
    words = text.split()
    word_count = len(words)
    wpm = (word_count / duration_seconds) * 60
    return round(wpm, 2)

def get_feedback(wpm):
    if wpm < 100:
        return "Too Slow"
    elif wpm > 150:
        return "Too Fast"
    else:
        return "Normal Pace"

@app.post("/analyze")
async def analyze_speech(file: UploadFile = File(...)):
    # Read audio bytes
    audio_bytes = await file.read()
    
    # Convert WebM/MP4 (from browser) to WAV (required by SpeechBrain)
    # We use pydub to handle the conversion
    audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
    wav_buffer = io.BytesIO()
    audio.export(wav_buffer, format="wav")
    wav_buffer.seek(0)

    # Calculate duration
    duration = len(audio) / 1000.0

    # Run ASR (Automatic Speech Recognition)
    # SpeechBrain returns a list of tokens
    predicted_tokens = asr_model.transcribe_file(wav_buffer)
    
    # predicted_tokens is usually a list like ['hello', 'world']
    # We join them to get a string
    text = " ".join(predicted_tokens) if isinstance(predicted_tokens, list) else predicted_tokens

    # Calculate WPM
    wpm = calculate_wpm(text, duration)
    feedback = get_feedback(wpm)

    return {
        "text": text,
        "wpm": wpm,
        "feedback": feedback,
        "duration": duration
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)