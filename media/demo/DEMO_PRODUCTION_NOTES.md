# CarbonProof AI — Demo Production Notes

**Track**: Carbon Markets & Emissions Transparency (IEEE ClimateChain Global Hackathon 2026)  
**Production Date**: October 20, 2026  
**Produced by**: Principal Engineer & Media Architect  

---

## 1. Master Output Assets

| Asset Path | Format / Spec | Purpose |
|---|---|---|
| `media/demo/carbonproof-demo.mp4` | 1080p (1920×1080), 30 fps, H.264 / AAC, 4.67 MB | Official video submission walkthrough |
| `media/demo/carbonproof-demo.srt` | SubRip Subtitle (.srt), UTF-8 | Synchronized closed captions |
| `media/demo/captions.srt` | SubRip Subtitle (.srt), UTF-8 | Duplicate copy for video players |
| `media/demo/narration.mp3` | MPEG-3 Audio, 24kHz, 48 kbps | Neural voiceover master |
| `media/demo/narration.wav` | Linear PCM 48kHz, 16-bit stereo | Broadcast-grade uncompressed audio |
| `media/demo/narration_final.wav` | Linear PCM 48kHz, 16-bit stereo | Final normalized mix track |
| `media/demo/narration_script.txt` | Plain Text | Master narration script (7 time-coded segments) |
| `media/demo/recording/*.png` | 1920×1080 PNG | 7 high-resolution frames captured from live React app |

---

## 2. Production Pipeline & Tooling

1. **Screen Capture**:
   - Google Chrome Headless (`154.0.8037.97`) running via Chrome DevTools Protocol (`remote-debugging-port`).
   - Automated via `scripts/capture-demo-scenes.js`.
   - Captured real React 18 application with active authentication session token for Administrator role.
   - Exact 1080p resolution (1920×1080) with 1x device scale factor and zero browser chrome clutter.

2. **Neural Speech Synthesis**:
   - Engine: `edge-tts` (Microsoft Neural Voice Engine).
   - Voice Profile: `en-US-ChristopherNeural` (Male, News/Authoritative, Pacing: -4% for clear technical comprehension).
   - Generated both audio and synchronized VTT subtitle timestamps matching sentence boundaries.

3. **Audio Mastering**:
   - Resampled to broadcast standard 48,000 Hz, 16-bit stereo PCM.
   - Loudness normalized to -16 LUFS with zero clipping.

4. **Video Assembly**:
   - Assembled using FFmpeg 7+ with `concat` demuxer and `libopenh264` codec.
   - Frame rate: 30 fps progressive.
   - Synchronized with 7 discrete application scenes directly matching narrative points.

---

## 3. Verified Authenticity & Ethics Statement

- All captured views reflect real components and pages running against the live backend API.
- All demo data shown is explicitly labeled with the `SYNTHETIC_DEMO` disclosure badge.
- The presentation explicitly articulates the boundaries of cryptographic proof: matching SHA-256 fingerprints certifies document immutability and tamper-resistance, without making unscientific claims of replacing on-ground physical inspection.
