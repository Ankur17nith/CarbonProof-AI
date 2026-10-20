import asyncio
import os
import edge_tts

VOICE = "en-US-ChristopherNeural"
OUTPUT_MP3 = "media/demo/narration.mp3"
OUTPUT_SRT = "media/demo/carbonproof-demo.srt"

SCRIPT_TEXT = """Welcome to CarbonProof AI, an evidence-first environmental verification platform engineered to restore cryptographic integrity to voluntary carbon markets. We begin by authenticating into the platform using the administrator role. On the main dashboard, market operators and auditors have immediate visibility into aggregate system metrics: total active projects, verified carbon credits, and dual-layer settlement indicators. Every metric is backed by verified data records.

Next, we register a new environmental carbon project through the platform's intake interface. We enter the project details: the Mount Kenya Native Reforestation and Agroforestry Project, adopting the verified VM0007 methodology. We specify the host region in Kenya's Central Highlands, register the external registry reference, and submit. The project is created through our REST API and initialized in draft status, ready for primary evidence intake.

In CarbonProof AI, carbon claims are treated as unverified hypotheses until backed by immutable evidence documents. We now upload actual project documentation directly to the project's evidence vault. First, we attach the Project Design Document, a comprehensive PDF detailing baseline additionality barriers. Next, we upload field biomass sample inventory data in CSV format, recording tree diameter and allometric carbon calculations. Finally, we attach satellite remote sensing telemetry in JSON format, capturing canopy height models and vegetation indices. Each document is validated, securely persisted, and indexed.

Every uploaded file is immediately fingerprinted using SHA-256. Notice our ethical verification boundary: matching cryptographic fingerprints guarantees that stored bytes are byte-for-byte identical to what was submitted, preventing retro-active alteration. We trigger the platform's integrity verification action: the backend reads the stored file, recalculates the cryptographic digest, and confirms an exact match against the ledger. It establishes immutable custody without claiming to replace on-ground physical inspection.

With primary evidence in custody, we execute the platform's deterministic rules engine. Unlike opaque black-box neural networks, CarbonProof evaluates submitted projects against standardized carbon accounting criteria using transparent, reproducible rules. The engine evaluates additionality hurdles, baseline deforestation credibility, boundary validation, and provenance attachment, generating an overall risk score and an itemized breakdown.

Reviewers can inspect each individual finding produced by the rules engine. Here, the system flags the absence of registered land tenure deed attachments, assigning a moderate severity and recommending submission of official cadastral records. The rules engine provides clear, actionable remediation guidance so project proponents know exactly what evidentiary gaps must be resolved.

Integrity requires strict governance. We switch to the reviewer account to demonstrate separation of duties. Under our platform's governance model, project developers are prohibited from reviewing or approving their own submissions. An accredited reviewer audits the evidence vault and risk findings, records written justifications detailing the additionality verification, and submits an official approval decision, transitioning the project to verified internal status.

Once verified, the platform authorizes the creation and issuance of credit batches, protected by mandatory idempotency keys to eliminate duplicate minting across network retries. We mint five thousand metric tons of verified carbon credits. Next, we retire two hundred and fifty credits on behalf of a named corporate beneficiary for Scope 3 voluntary offsetting. The transaction settles directly against our Solidity smart contract on the EVM node, burning the credits and returning an immutable on-chain transaction receipt.

Transparency extends to all market participants. In an unauthenticated session, any corporate buyer, auditor, or regulator can access the Zero-Trust Public Verification Portal. By querying the project identifier or evidence hash, the portal retrieves public project status, verified evidence fingerprints, and retirement certificate serials without exposing confidential operational data.

Finally, our immutable Audit Trail logs every state transition, evidence verification, reviewer approval, and settlement event with cryptographic timestamps and actor attribution. CarbonProof AI delivers deterministic rigor and cryptographic certainty, transforming voluntary carbon markets into a verifiable, trustworthy ecosystem."""

def format_time(seconds: float) -> str:
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    if millis >= 1000:
        millis = 999
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"

async def generate():
    communicate = edge_tts.Communicate(
        text=SCRIPT_TEXT,
        voice=VOICE,
        rate="-2%",
        pitch="+0Hz"
    )
    print("Generating speech and sentence boundary cues...")
    sentences = []
    with open(OUTPUT_MP3, "wb") as file:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                file.write(chunk["data"])
            elif chunk["type"] == "SentenceBoundary":
                sentences.append(chunk)

    srt_lines = []
    for idx, s in enumerate(sentences, 1):
        start_sec = s["offset"] / 10_000_000.0
        end_sec = (s["offset"] + s["duration"]) / 10_000_000.0
        text = s["text"].strip()
        srt_lines.append(f"{idx}\n{format_time(start_sec)} --> {format_time(end_sec)}\n{text}\n")

    srt_content = "\n".join(srt_lines)
    with open(OUTPUT_SRT, "w", encoding="utf-8") as file:
        file.write(srt_content)
    with open("media/demo/captions.srt", "w", encoding="utf-8") as file:
        file.write(srt_content)
    with open("media/demo/narration_script.txt", "w", encoding="utf-8") as file:
        file.write(SCRIPT_TEXT)

    print(f"Generated {OUTPUT_MP3} and {OUTPUT_SRT} with {len(sentences)} sentence subtitles.")

if __name__ == "__main__":
    asyncio.run(generate())
