# Parliamentary Video Ingest — Phase 1

**Status:** Build-ready addendum to the four-country connector spec  
**Scope:** Vimeo embeds + direct video files only (`.mp4`, `.webm`, `.m3u8`, `.mov`)

## Overrides vs full PRD

- Hansard / PDF / order-paper connectors are **deferred**.
- Local download into operator storage is **allowed** for ASR (not public redistribution).
- YouTube / Facebook / Livestream-only URLs are **skipped**.
- Machine ASR is always labeled `octivate_machine_transcript` — never Hansard.

## Storage layout

```text
data/local/parliamentary-videos/{country}/{yyyy}/{titleSlug}_{isoStamp}/
  video.{ext}
  meta.json
  transcript.jsonl
  transcripts.csv
  source.html          (optional, size-capped)
```

## Operator controls

Only `start` | `pause` | `cancel`. Limits and country seeds come from server env.

## Labels

| Artifact | `transcriptStatus` |
|----------|--------------------|
| Downloaded video | `not_applicable` |
| faster-whisper output | `octivate_machine_transcript` |

## Env

See `.env.example` keys prefixed `PARL_`.
