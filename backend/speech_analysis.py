from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from speechbrain.inference import Inference
import torchaudio
import string
import os
import tempfile 

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading SpeechBrain model...")
asr_model = Inference.from_pretrained(
    model_path="speechbrain/asr/whisper/whisper-medium"
)

def calculate_wpm(text, duration_seconds):
    if duration_seconds <= 0:
        return 0
    translator = str.maketrans('', '', string.punctuation)
    clean_text = text.translate(translator)
    word_count = len(clean_text.split())
    return (word_count / duration_seconds) * 60

@app.post("/analyze-speed")
async def analyze_speed(file: UploadFile = File(...)):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            temp_path = tmp_file.name

        info = torchaudio.info(temp_path)
        duration_seconds = info.num_frames / info.sample_rate

        output = asr_model.transcribe_file(temp_path)
        text = output.get('text', '') if isinstance(output, dict) else output

        wpm = calculate_wpm(text, duration_seconds)

        os.remove(temp_path)

        return {
            "success": True,
            "wpm": round(wpm, 2),
            "word_count": len(text.split()),
            "duration_seconds": round(duration_seconds, 2),
            "transcription": text[:200] + "..." if len(text) > 200 else text
        }

    except Exception as e:
        return {"success": False, "error": str(e)}