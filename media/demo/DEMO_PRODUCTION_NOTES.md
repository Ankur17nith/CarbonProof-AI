# CarbonProof AI — Demo Production Notes

**Domain**: Carbon Markets & Emissions Transparency  
**Production Date**: October 20, 2026  
**Produced by**: Principal Systems Architect & Media Engineer  

---

## 1. Master Output Assets

| Asset Path | Format / Spec | Purpose |
|---|---|---|
| `media/demo/carbonproof-demo.mp4` | 1080p (1920×1080), 30 fps, H.264 / AAC | Official product video walkthrough (interactive screen capture) |
| `media/demo/carbonproof-demo.srt` | SubRip Subtitle (.srt), UTF-8 | Synchronized closed captions (embedded & standalone) |
| `media/demo/captions.srt` | SubRip Subtitle (.srt), UTF-8 | Duplicate copy for external video players |
| `media/demo/narration.mp3` | MPEG-3 Audio, 24kHz, 48 kbps | Neural voiceover master (`en-US-ChristopherNeural`) |
| `media/demo/narration.wav` | Linear PCM 48kHz, 16-bit stereo | Broadcast-grade uncompressed audio |
| `media/demo/narration_final.wav` | Linear PCM 48kHz, 16-bit stereo | Final normalized mix track |
| `media/demo/narration_script.txt` | Plain Text | Master narration script (7 time-coded segments) |
| `media/demo/recording/` | Frame captures & ffconcat directive list | Continuous 1080p interactive frame stream |

---

## 2. Production Pipeline & Tooling

1. **Interactive Screen Recording**:
   - Google Chrome Headless (`154.0.8037.97`) running with Chrome DevTools Protocol (`remote-debugging-port`).
   - Automated via `scripts/record-real-demo.js`.
   - Drives authentic user interactions against running React frontend (`http://localhost:5173`) and Express backend (`http://localhost:3000`):
     - One-click role login chip selection and form submission.
     - Smooth multi-step cursor movements and click animations.
     - Dynamic text typing in search and form inputs.
     - Live invocation of `/api/v1/evidence/:id/verify-integrity` with green toast feedback.
     - Accordion expansion of 5 deterministic carbon risk assessment rules.
     - Reviewer decision modal presentation and audit justification entry.
     - Credit batch retirement dialog and EVM transaction ledger inspection.
     - Zero-trust public lookup query execution.
   - Captured at 1080p desktop resolution (1920×1080) with 1x device scale factor and high-quality JPEG frames.

2. **Neural Speech Synthesis**:
   - Engine: `edge-tts` (Microsoft Neural Voice Engine).
   - Voice Profile: `en-US-ChristopherNeural` (Male, News/Authoritative, Pacing: -4% for clear technical comprehension).
   - Generated both audio (`narration.mp3`) and synchronized VTT/SRT subtitle timestamps matching sentence boundaries.

3. **Audio Mastering**:
   - Resampled to broadcast standard 48,000 Hz, 16-bit stereo PCM.
   - Loudness normalized to -16 LUFS with zero clipping.

4. **Frame-Accurate Video Assembly**:
   - Assembled using FFmpeg 7+ with `concat` demuxer and `libopenh264` codec.
   - Frame rate: 30 fps progressive; color space: YUV420p; container: MP4.
   - Total duration: 03:08.71, matching narration and subtitles down to milliseconds.

---

## 3. Verified Authenticity & Ethics Statement

- All captured views reflect real components and pages running against the live backend API.
- All demo data shown is explicitly labeled with the `SYNTHETIC_DEMO` disclosure badge.
- The presentation explicitly articulates the boundaries of cryptographic proof: matching SHA-256 fingerprints certifies document immutability and tamper-resistance, without making unscientific claims of replacing on-ground physical inspection.
