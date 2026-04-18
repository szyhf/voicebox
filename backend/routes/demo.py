"""
Demo API endpoints for the voice cloning educational tool.

Provides step-by-step endpoints that expose intermediate results
(preprocessed waveform, mel spectrogram, speaker embedding)
for visualization in the demo web UI.

Uses Qwen3-TTS engine only. Assumes models are pre-downloaded.
"""

import asyncio
import hashlib
import tempfile
import uuid
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from ..utils.audio import load_audio, normalize_audio, save_audio

router = APIRouter(prefix="/demo", tags=["demo"])

# ---------------------------------------------------------------------------
# In-memory session store (demo is single-user, no DB needed)
# ---------------------------------------------------------------------------
_session: dict[str, str] = {}  # key -> file path


def _store_file(path: str) -> str:
    key = hashlib.md5(path.encode()).hexdigest()[:12]
    _session[key] = path
    return key


def _get_file(key: str) -> str:
    if key not in _session:
        raise HTTPException(404, "Audio file not found. Please start from step 1.")
    p = Path(_session[key])
    if not p.exists():
        raise HTTPException(404, f"File {key} no longer exists on disk.")
    return str(p)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class PreprocessRequest(BaseModel):
    audio_path: str

class PreprocessResponse(BaseModel):
    original_rms: float
    normalized_rms: float
    original_peak: float
    normalized_peak: float
    duration: float
    sample_rate: int
    original_waveform: list[float]
    normalized_waveform: list[float]
    processed_audio_path: str

class SpectrogramRequest(BaseModel):
    audio_path: str

class SpectrogramResponse(BaseModel):
    mel_spectrogram: list[list[float]]
    n_mels: int
    n_frames: int
    hop_length: int

class EmbedRequest(BaseModel):
    audio_path: str
    reference_text: str

class TensorInfo(BaseModel):
    key: str
    shape: list[int]
    values: list[float]
    stats: dict[str, float]

class EmbedResponse(BaseModel):
    prompt_keys: list[str]
    tensors: list[TensorInfo]

class GenerateRequest(BaseModel):
    text: str
    audio_path: str
    reference_text: str
    effects: Optional[dict] = None

class GenerateResponse(BaseModel):
    audio_url: str
    duration: float


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    """Upload an audio file for processing. Returns a server-side path."""
    suffix = Path(file.filename or "audio.webm").suffix
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False, dir=tempfile.gettempdir())
    try:
        total = 0
        while chunk := await file.read(1024 * 1024):
            total += len(chunk)
            if total > 50 * 1024 * 1024:
                Path(tmp.name).unlink(missing_ok=True)
                raise HTTPException(413, "File too large (max 50 MB)")
            tmp.write(chunk)
        tmp.close()
    except Exception:
        Path(tmp.name).unlink(missing_ok=True)
        raise

    key = _store_file(tmp.name)
    return {"audio_path": tmp.name, "key": key}


@router.post("/preprocess", response_model=PreprocessResponse)
async def preprocess(req: PreprocessRequest):
    """Load, normalize, and return waveform data for visualization."""
    try:
        audio, sr = load_audio(req.audio_path)
        original_rms = float(np.sqrt(np.mean(audio**2)))
        original_peak = float(np.abs(audio).max())

        normalized = normalize_audio(audio)
        normalized_rms = float(np.sqrt(np.mean(normalized**2)))
        normalized_peak = float(np.abs(normalized).max())

        # Save processed audio
        out_path = str(Path(tempfile.gettempdir()) / f"demo_preprocessed_{uuid.uuid4().hex[:8]}.wav")
        save_audio(normalized, out_path, sr)
        _store_file(out_path)

        # Downsample waveforms for frontend (target ~2000 points)
        step = max(1, len(audio) // 2000)
        original_waveform = audio[::step].tolist()
        normalized_waveform = normalized[::step].tolist()

        duration = len(normalized) / sr

        return PreprocessResponse(
            original_rms=original_rms,
            normalized_rms=normalized_rms,
            original_peak=original_peak,
            normalized_peak=normalized_peak,
            duration=duration,
            sample_rate=sr,
            original_waveform=original_waveform,
            normalized_waveform=normalized_waveform,
            processed_audio_path=out_path,
        )
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/spectrogram", response_model=SpectrogramResponse)
async def compute_spectrogram(req: SpectrogramRequest):
    """Compute mel spectrogram from audio file."""
    try:
        audio, sr = load_audio(req.audio_path)

        import librosa

        n_mels = 80
        hop_length = 256

        mel = librosa.feature.melspectrogram(
            y=audio, sr=sr, n_mels=n_mels, hop_length=hop_length
        )
        mel_db = librosa.power_to_db(mel, ref=np.max)

        # Downsample time axis if too many frames (>600)
        n_frames = mel_db.shape[1]
        if n_frames > 600:
            step = n_frames // 600
            mel_db = mel_db[:, ::step]
            n_frames = mel_db.shape[1]

        return SpectrogramResponse(
            mel_spectrogram=mel_db.tolist(),
            n_mels=n_mels,
            n_frames=n_frames,
            hop_length=hop_length,
        )
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/embed", response_model=EmbedResponse)
async def extract_embedding(req: EmbedRequest):
    """Extract voice prompt from audio using Qwen3-TTS."""
    try:
        from ..backends import get_tts_backend_for_engine, load_engine_model

        engine = "qwen"
        backend = get_tts_backend_for_engine(engine)
        await load_engine_model(engine, "1.7B")

        voice_prompt_items, was_cached = await backend.create_voice_prompt(
            req.audio_path,
            req.reference_text,
            use_cache=True,
        )

        # voice_prompt_items is a List[VoiceClonePromptItem] (dataclass)
        # Each item has: ref_code, ref_spk_embedding, x_vector_only_mode, icl_mode, ref_text
        import torch

        tensors = []
        prompt_keys = []

        # Handle both list and dict return types
        items = voice_prompt_items if isinstance(voice_prompt_items, list) else [voice_prompt_items]

        for i, item in enumerate(items):
            if hasattr(item, '__dataclass_fields__'):
                # VoiceClonePromptItem dataclass
                for field_name in item.__dataclass_fields__:
                    val = getattr(item, field_name)
                    key = field_name
                    prompt_keys.append(key)

                    if isinstance(val, torch.Tensor):
                        flat = val.flatten().detach().cpu().float().numpy()
                        values = flat[:512].tolist()
                        stats = {
                            "mean": float(flat.mean()),
                            "std": float(flat.std()),
                            "min": float(flat.min()),
                            "max": float(flat.max()),
                        }
                        tensors.append(TensorInfo(
                            key=key,
                            shape=list(val.shape),
                            values=values,
                            stats=stats,
                        ))
                    elif val is not None and not isinstance(val, (bool, str)):
                        # numeric value
                        tensors.append(TensorInfo(
                            key=key,
                            shape=[],
                            values=[float(val)],
                            stats={"mean": float(val), "std": 0.0, "min": float(val), "max": float(val)},
                        ))
            elif isinstance(item, dict):
                for key, val in item.items():
                    prompt_keys.append(key)
                    if isinstance(val, torch.Tensor):
                        flat = val.flatten().detach().cpu().float().numpy()
                        values = flat[:512].tolist()
                        stats = {
                            "mean": float(flat.mean()),
                            "std": float(flat.std()),
                            "min": float(flat.min()),
                            "max": float(flat.max()),
                        }
                        tensors.append(TensorInfo(
                            key=key,
                            shape=list(val.shape),
                            values=values,
                            stats=stats,
                        ))

        return EmbedResponse(
            prompt_keys=prompt_keys,
            tensors=tensors,
        )
    except Exception as e:
        raise HTTPException(400, str(e))


@router.post("/generate", response_model=GenerateResponse)
async def generate_speech(req: GenerateRequest):
    """Generate speech using Qwen3-TTS with optional effects."""
    try:
        from ..backends import get_tts_backend_for_engine, load_engine_model

        engine = "qwen"
        backend = get_tts_backend_for_engine(engine)
        await load_engine_model(engine, "1.7B")

        # Create voice prompt
        voice_prompt, _ = await backend.create_voice_prompt(
            req.audio_path,
            req.reference_text,
            use_cache=True,
        )

        # Generate
        audio, sample_rate = await backend.generate(
            text=req.text,
            voice_prompt=voice_prompt,
            language="zh",
            seed=42,
        )

        duration = len(audio) / sample_rate

        # Apply effects if specified
        if req.effects:
            from ..utils.effects import apply_effects

            effects_chain = []
            pitch = req.effects.get("pitch", 0)
            reverb_pct = req.effects.get("reverb", 0)
            gain_db = req.effects.get("gain", 0)

            if pitch != 0:
                effects_chain.append({
                    "type": "pitch_shift",
                    "enabled": True,
                    "params": {"semitones": float(pitch)},
                })
            if reverb_pct > 0:
                effects_chain.append({
                    "type": "reverb",
                    "enabled": True,
                    "params": {
                        "room_size": reverb_pct / 100,
                        "damping": 0.5,
                        "wet_level": reverb_pct / 200,
                        "dry_level": 1.0 - reverb_pct / 200,
                        "width": 1.0,
                    },
                })
            if gain_db != 0:
                effects_chain.append({
                    "type": "gain",
                    "enabled": True,
                    "params": {"gain_db": float(gain_db)},
                })

            if effects_chain:
                audio = apply_effects(audio, sample_rate, effects_chain)

        # Save
        filename = f"demo_gen_{uuid.uuid4().hex[:8]}.wav"
        out_dir = Path(tempfile.gettempdir())
        out_path = out_dir / filename
        save_audio(audio, str(out_path), sample_rate)

        return GenerateResponse(
            audio_url=f"/demo/audio/{filename}",
            duration=duration,
        )
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/audio/{filename}")
async def serve_demo_audio(filename: str):
    """Serve a generated demo audio file."""
    from fastapi.responses import FileResponse

    path = Path(tempfile.gettempdir()) / filename
    if not path.exists():
        raise HTTPException(404, "Audio file not found")
    return FileResponse(
        str(path),
        media_type="audio/wav",
        filename=filename,
    )
