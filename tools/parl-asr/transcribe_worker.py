#!/usr/bin/env python3
"""faster-whisper sidecar for parliamentary media ASR.

Reads a job JSON (--job path) and writes transcript.jsonl with summary + segments.
Labeled by the Node orchestrator as octivate_machine_transcript (never Hansard).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def log(msg: str) -> None:
    print(f"[parl-asr] {msg}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job", required=True, help="Path to asr-job.json")
    args = parser.parse_args()

    job_path = Path(args.job)
    job = json.loads(job_path.read_text(encoding="utf-8"))
    video = Path(job["video_path"])
    out_jsonl = Path(job["out_jsonl"])
    model_name = job.get("model") or "base"

    if not video.exists():
        log(f"missing video: {video}")
        return 2

    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        log(f"faster-whisper not installed: {exc}")
        log("pip install -r tools/parl-asr/requirements.txt")
        return 3

    device = "cpu"
    compute_type = "int8"
    try:
        import torch  # type: ignore

        if torch.cuda.is_available():
            device = "cuda"
            compute_type = "float16"
            log("CUDA available — using GPU")
    except Exception:
        pass

    log(f"loading model={model_name} device={device} compute_type={compute_type}")
    model = WhisperModel(model_name, device=device, compute_type=compute_type)

    log(f"transcribing {video}")
    segments_iter, info = model.transcribe(str(video), beam_size=5, vad_filter=True)

    segments = []
    texts = []
    with out_jsonl.open("w", encoding="utf-8") as fh:
        for seg in segments_iter:
            row = {
                "type": "segment",
                "start": float(seg.start),
                "end": float(seg.end),
                "text": (seg.text or "").strip(),
            }
            segments.append(row)
            texts.append(row["text"])
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            log(f"segment {row['start']:.1f}-{row['end']:.1f}s")

        summary = {
            "type": "summary",
            "text": " ".join(t for t in texts if t).strip(),
            "language": getattr(info, "language", None),
            "duration_sec": getattr(info, "duration", None),
            "model": model_name,
            "transcript_status": "octivate_machine_transcript",
            "segment_count": len(segments),
        }
        fh.write(json.dumps(summary, ensure_ascii=False) + "\n")

    log(f"done segments={len(segments)} chars={len(summary['text'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
