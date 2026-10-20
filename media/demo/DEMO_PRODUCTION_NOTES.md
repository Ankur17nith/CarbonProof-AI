# CarbonProof AI — Demo Production Notes

**Domain**: Carbon Markets & Emissions Transparency  
**Production Date**: October 20, 2026  
**Produced by**: Principal Systems Architect & Media Engineer  

---

## 1. Master Output Assets

| Asset Path | Format / Spec | Purpose |
|---|---|---|
| `media/demo/carbonproof-demo.mp4` | 1080p (1920×1080), 25 fps progressive, H.264 / AAC, Burned-in Subtitles | Official product video walkthrough (document-driven interactive screen capture, 05:07 duration) |
| `media/demo/carbonproof-demo.srt` | SubRip Subtitle (.srt), UTF-8 (37 sentence cues) | Synchronized closed captions (embedded as `mov_text` & standalone) |
| `media/demo/captions.srt` | SubRip Subtitle (.srt), UTF-8 | Duplicate copy for external video players |
| `media/demo/narration.mp3` | MPEG-3 Audio, 24kHz, 48 kbps | Neural voiceover master (`en-US-ChristopherNeural`, 05:07 duration) |
| `media/demo/narration.wav` | Linear PCM 48kHz, 16-bit stereo | Broadcast-grade uncompressed audio |
| `media/demo/narration_final.wav` | Linear PCM 48kHz, 16-bit stereo | Final normalized mix track |
| `media/demo/narration_script.txt` | Plain Text | Master narration script (10 time-coded scenes) |
| `fixtures/demo/mount_kenya_pdd_v1.2.pdf` | Valid ISO 32000-1 PDF (1 page) | Project Design Document fixture with additionality analysis |
| `fixtures/demo/forest_biomass_inventory.csv` | Valid RFC 4180 CSV (8 plot records) | Field biomass inventory and allometric carbon calculations |
| `fixtures/demo/remote_sensing_canopy_metrics.json` | Valid JSON Schema v1 payload | Satellite LiDAR telemetry and Sentinel-2 vegetation indices |
| `media/demo/recording/` | Frame captures & ffconcat directive list | Continuous 1080p interactive frame stream |

---

## 2. Production Pipeline & Tooling

1. **Interactive Screen Recording**:
   - Google Chrome Headless (`154.0.8037.97`) running with Chrome DevTools Protocol (`remote-debugging-port`).
   - Automated via `scripts/record-real-demo.js`.
   - Drives authentic user interactions against running React frontend (`http://localhost:5173`), Express backend (`http://localhost:3000`), and Anvil EVM node (`http://127.0.0.1:8545`):
     - **Scene 1**: Administrator login and overview metrics dashboard inspection.
     - **Scene 2**: Project creation form submission registering "Mount Kenya Native Reforestation & Agroforestry Project".
     - **Scene 3**: Real document uploads via multipart interface: PDD (PDF), Biomass Inventory (CSV), Remote Sensing Telemetry (JSON).
     - **Scene 4**: Cryptographic SHA-256 fingerprint verification with backend storage hash matching.
     - **Scene 5**: Execution of the 14-rule deterministic carbon risk assessment engine (`v1.0.0`).
     - **Scene 6**: Detailed inspection of rule findings, severity multipliers, and remediation recommendations.
     - **Scene 7**: Role switch to Reviewer (`reviewer@example.test`), separation of duties enforcement, and audit approval decision submission.
     - **Scene 8**: Credit batch issuance (`5000 tCO2e`) and permanent retirement (`250 tCO2e`) with real on-chain EVM settlement.
     - **Scene 9**: Unauthenticated public verification query rendering verified disclosure certificates.
     - **Scene 10**: Complete immutable audit trail review across all lifecycle state transitions.
   - Captured at 1080p desktop resolution (1920×1080) with 1x device scale factor and high-quality frames.

2. **Neural Speech Synthesis**:
   - Engine: `edge-tts` (Microsoft Neural Voice Engine).
   - Voice Profile: `en-US-ChristopherNeural` (Male, News/Authoritative, Pacing: -2% for clear technical comprehension).
   - Generated both audio (`narration.mp3`) and 37 synchronized sentence boundary cues (`carbonproof-demo.srt`).

3. **Audio Mastering**:
   - Resampled to broadcast standard 48,000 Hz, 16-bit stereo PCM.
   - Loudness normalized to -16 LUFS with zero clipping.

4. **Frame-Accurate Video Assembly & Subtitle Burning**:
   - Assembled using FFmpeg 7+ with `concat` demuxer and `libopenh264` codec.
   - **Subtitles Burned In**: Using FFmpeg `subtitles` filter with `Liberation Sans`, 28pt font, white fill, black border, 48px bottom margin, centered alignment. Visible in any player without enabling captions.
   - Dual-channel accessibility: Subtitles also muxed as selectable `mov_text` subtitle track.
   - Frame rate: 25 fps progressive; color space: YUV420p; container: MP4.
   - Total duration: 05:07.75, synchronized with narration audio down to the centisecond.

---

## 3. Verified Authenticity & Ethics Statement

- All captured views reflect real components and pages running against the live backend API and local Anvil EVM node.
- All demo data shown is explicitly labeled with the `SYNTHETIC_DEMO` disclosure badge.
- The presentation explicitly articulates the boundaries of cryptographic proof: matching SHA-256 fingerprints certifies document immutability and tamper-resistance, without making unscientific claims of replacing on-ground physical inspection.
