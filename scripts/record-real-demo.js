import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FRAMES_DIR = path.resolve('media/demo/recording/frames');
const CONCAT_FILE = path.resolve('media/demo/recording/concat_frames.txt');
fs.mkdirSync(FRAMES_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let frameIndex = 0;
const concatLines = ['ffconcat version 1.0'];

async function main() {
  console.log('=== Starting Real Interactive Demo Recording ===');

  console.log('1. Launching Headless Google Chrome on port 9225...');
  const chrome = spawn(
    'google-chrome',
    [
      '--headless=new',
      '--remote-debugging-port=9225',
      '--no-sandbox',
      '--disable-gpu',
      '--window-size=1920,1080',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  await sleep(1500);

  const targetsRes = await fetch('http://127.0.0.1:9225/json/list');
  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  let idCounter = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    }
  };

  function sendCommand(method, params = {}) {
    return new Promise((resolve) => {
      const id = idCounter++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Set 1080p desktop viewport
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sendCommand('Page.enable');
  await sendCommand('DOM.enable');

  async function evalInPage(expression) {
    const res = await sendCommand('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res?.result?.value;
  }

  async function recordFrame(durationSec) {
    const filename = `frame_${String(frameIndex++).padStart(5, '0')}.jpg`;
    const filepath = path.join(FRAMES_DIR, filename);

    const { data } = await sendCommand('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 85,
    });
    fs.writeFileSync(filepath, Buffer.from(data, 'base64'));

    concatLines.push(`file ${filepath}`);
    concatLines.push(`duration ${durationSec.toFixed(3)}`);
  }

  async function injectCursor() {
    await evalInPage(`
      (function() {
        if (document.getElementById('demo-cursor')) return;
        const cursor = document.createElement('div');
        cursor.id = 'demo-cursor';
        cursor.style.position = 'fixed';
        cursor.style.width = '20px';
        cursor.style.height = '20px';
        cursor.style.borderRadius = '50%';
        cursor.style.backgroundColor = 'rgba(45, 90, 67, 0.75)';
        cursor.style.border = '2px solid #ffffff';
        cursor.style.boxShadow = '0 2px 10px rgba(0,0,0,0.35)';
        cursor.style.pointerEvents = 'none';
        cursor.style.zIndex = '9999999';
        cursor.style.transform = 'translate(-50%, -50%)';
        cursor.style.transition = 'none';
        cursor.style.left = '960px';
        cursor.style.top = '540px';
        document.body.appendChild(cursor);

        window.__setCursorPos = (x, y) => {
          cursor.style.left = x + 'px';
          cursor.style.top = y + 'px';
        };

        window.__pulseCursor = () => {
          cursor.style.transform = 'translate(-50%, -50%) scale(0.7)';
          cursor.style.backgroundColor = 'rgba(30, 60, 45, 0.95)';
          setTimeout(() => {
            cursor.style.transform = 'translate(-50%, -50%) scale(1)';
            cursor.style.backgroundColor = 'rgba(45, 90, 67, 0.75)';
          }, 180);
        };
      })()
    `);
  }

  async function moveCursor(startX, startY, endX, endY, totalDurationSec, steps = 8) {
    const stepDuration = totalDurationSec / steps;
    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      // easeInOutQuad
      const eased =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const curX = Math.round(startX + (endX - startX) * eased);
      const curY = Math.round(startY + (endY - startY) * eased);
      await evalInPage(`window.__setCursorPos && window.__setCursorPos(${curX}, ${curY});`);
      await recordFrame(stepDuration);
    }
  }

  async function clickCursor(x, y, holdDuration = 0.5) {
    await evalInPage(`
      window.__setCursorPos && window.__setCursorPos(${x}, ${y});
      window.__pulseCursor && window.__pulseCursor();
    `);
    await recordFrame(holdDuration);
  }

  async function smoothScroll(deltaY, totalDurationSec, steps = 10) {
    const stepDuration = totalDurationSec / steps;
    const dy = deltaY / steps;
    for (let i = 0; i < steps; i++) {
      await evalInPage(`window.scrollBy({ top: ${dy}, behavior: 'instant' });`);
      await recordFrame(stepDuration);
    }
  }

  // --- SCENE 1: Overview & Authentication (32.50s) ---
  console.log('Recording Scene 1: Overview & Authentication (32.50s)...');
  await sendCommand('Page.navigate', { url: 'http://localhost:5173/login' });
  await sleep(1500);
  await injectCursor();
  await evalInPage(`window.__setCursorPos(960, 540);`);

  // Initial login screen view (3.5s)
  await recordFrame(3.5);

  // Move cursor to "Administrator" quick-demo button (approx 1060, 680) (1.2s)
  const adminBtnPos = await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const adminBtn = btns.find(b => b.textContent.includes('Administrator'));
      if (adminBtn) {
        const r = adminBtn.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 1060, y: 680 };
    })()
  `);
  await moveCursor(960, 540, adminBtnPos.x, adminBtnPos.y, 1.2, 8);

  // Click Administrator button (1.5s)
  await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const adminBtn = btns.find(b => b.textContent.includes('Administrator'));
      if (adminBtn) adminBtn.click();
    })()
  `);
  await clickCursor(adminBtnPos.x, adminBtnPos.y, 1.5);

  // Move cursor to "Sign In" button (1.0s)
  const signInPos = await evalInPage(`
    (function() {
      const btn = document.querySelector('button[type="submit"]');
      if (btn) {
        const r = btn.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 960, y: 760 };
    })()
  `);
  await moveCursor(adminBtnPos.x, adminBtnPos.y, signInPos.x, signInPos.y, 1.0, 6);

  // Click Sign In (1.0s)
  await evalInPage(`document.querySelector('button[type="submit"]')?.click();`);
  await clickCursor(signInPos.x, signInPos.y, 1.0);

  // Wait for redirect to Dashboard (2.0s)
  await sleep(1500);
  await injectCursor();
  await evalInPage(`window.__setCursorPos(${signInPos.x}, ${signInPos.y});`);
  await recordFrame(2.0);

  // Move cursor over Total Projects & Verified Credits metric cards (2.3s)
  await moveCursor(signInPos.x, signInPos.y, 650, 240, 2.3, 10);
  await recordFrame(2.0);

  // Scroll down 420px to show Verification Stream and Settlement Status (2.5s)
  await smoothScroll(420, 2.5, 10);

  // Pause to inspect Verification Stream and recent ledger entries (8.5s)
  await moveCursor(650, 240, 960, 500, 1.5, 6);
  await recordFrame(7.0);

  // Scroll back up to top (2.5s)
  await smoothScroll(-420, 2.5, 10);

  // Move cursor to sidebar "Projects" link (2.5s)
  const projectsNavPos = await evalInPage(`
    (function() {
      const links = Array.from(document.querySelectorAll('aside a'));
      const pLink = links.find(l => l.textContent.includes('Projects'));
      if (pLink) {
        const r = pLink.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 120, y: 140 };
    })()
  `);
  await moveCursor(960, 500, projectsNavPos.x, projectsNavPos.y, 2.5, 10);
  await recordFrame(1.5);

  // --- SCENE 2: Project Explorer & Data Intake (22.80s) ---
  console.log('Recording Scene 2: Project Explorer & Data Intake (22.80s)...');
  await evalInPage(`
    (function() {
      const links = Array.from(document.querySelectorAll('aside a'));
      const pLink = links.find(l => l.textContent.includes('Projects'));
      if (pLink) pLink.click();
    })()
  `);
  await clickCursor(projectsNavPos.x, projectsNavPos.y, 1.5);
  await sleep(1000);
  await injectCursor();

  // Move cursor to Search Input (1.2s)
  const searchInputPos = await evalInPage(`
    (function() {
      const inp = document.querySelector('input[type="text"], input[placeholder*="Search" i]');
      if (inp) {
        const r = inp.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 450, y: 170 };
    })()
  `);
  await moveCursor(projectsNavPos.x, projectsNavPos.y, searchInputPos.x, searchInputPos.y, 1.2, 6);

  // Click search input (0.5s)
  await clickCursor(searchInputPos.x, searchInputPos.y, 0.5);

  // Type "Kasigau" character by character (1.6s)
  const searchChars = 'Kasigau';
  for (let i = 0; i < searchChars.length; i++) {
    const partial = searchChars.slice(0, i + 1);
    await evalInPage(`
      (function() {
        const inp = document.querySelector('input[type="text"], input[placeholder*="Search" i]');
        if (inp) {
          inp.focus();
          inp.value = ${JSON.stringify(partial)};
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await recordFrame(0.23);
  }

  // Pause showing filtered project card (2.5s)
  await recordFrame(2.5);

  // Move cursor to Kasigau Corridor card/link (1.2s)
  const projectLinkPos = await evalInPage(`
    (function() {
      const links = Array.from(document.querySelectorAll('a[href^="/projects/"]'));
      const first = links.find(l => l.textContent.includes('Kasigau') || l.href.includes('/projects/'));
      if (first) {
        const r = first.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 500, y: 320 };
    })()
  `);
  await moveCursor(searchInputPos.x, searchInputPos.y, projectLinkPos.x, projectLinkPos.y, 1.2, 6);

  // Click into Project Detail view (1.5s)
  await evalInPage(`
    (function() {
      const links = Array.from(document.querySelectorAll('a[href^="/projects/"]'));
      const first = links.find(l => l.textContent.includes('Kasigau') || l.href.includes('/projects/'));
      if (first) first.click();
    })()
  `);
  await clickCursor(projectLinkPos.x, projectLinkPos.y, 1.5);
  await sleep(1000);
  await injectCursor();

  // Highlight project parameters, methodology badge, crediting period (3.0s)
  await moveCursor(projectLinkPos.x, projectLinkPos.y, 600, 260, 1.5, 6);
  await recordFrame(1.5);

  // Smooth scroll down to inspect coordinates and baseline parameters (3.0s)
  await smoothScroll(320, 2.5, 8);
  await recordFrame(2.5);

  // Move cursor toward sidebar "Evidence" (2.3s)
  const evidenceNavPos = await evalInPage(`
    (function() {
      const links = Array.from(document.querySelectorAll('aside a'));
      const eLink = links.find(l => l.textContent.includes('Evidence'));
      if (eLink) {
        const r = eLink.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 120, y: 180 };
    })()
  `);
  await moveCursor(600, 260, evidenceNavPos.x, evidenceNavPos.y, 2.3, 8);
  await recordFrame(0.5);

  // --- SCENE 3: Cryptographic Evidence Vault (32.50s) ---
  console.log('Recording Scene 3: Cryptographic Evidence Vault (32.50s)...');
  await evalInPage(`
    (function() {
      const links = Array.from(document.querySelectorAll('aside a'));
      const eLink = links.find(l => l.textContent.includes('Evidence'));
      if (eLink) eLink.click();
    })()
  `);
  await clickCursor(evidenceNavPos.x, evidenceNavPos.y, 1.5);
  await sleep(1000);
  await injectCursor();

  // Evidence table loaded (2.5s)
  await recordFrame(2.5);

  // Move cursor over SHA-256 fingerprint column (1.5s)
  const hashCopyPos = await evalInPage(`
    (function() {
      const btn = document.querySelector('button[aria-label="Copy SHA-256 hash"], button[title="Copy SHA-256"]');
      if (btn) {
        const r = btn.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 800, y: 320 };
    })()
  `);
  await moveCursor(evidenceNavPos.x, evidenceNavPos.y, hashCopyPos.x, hashCopyPos.y, 1.5, 6);

  // Click copy SHA-256 button (1.5s)
  await evalInPage(`
    document.querySelector('button[aria-label="Copy SHA-256 hash"], button[title="Copy SHA-256"]')?.click();
  `);
  await clickCursor(hashCopyPos.x, hashCopyPos.y, 1.5);

  // Move cursor to "Verify" button on first evidence row (1.5s)
  const verifyBtnPos = await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const vBtn = btns.find(b => b.textContent.includes('Verify'));
      if (vBtn) {
        const r = vBtn.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 1550, y: 320 };
    })()
  `);
  await moveCursor(hashCopyPos.x, hashCopyPos.y, verifyBtnPos.x, verifyBtnPos.y, 1.5, 6);

  // Click "Verify" button! Fires API call and toast (1.5s)
  await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const vBtn = btns.find(b => b.textContent.includes('Verify'));
      if (vBtn) vBtn.click();
    })()
  `);
  await clickCursor(verifyBtnPos.x, verifyBtnPos.y, 1.5);

  // Display green verification toast and active confirmation (5.0s)
  await recordFrame(5.0);

  // Smooth scroll down to view other evidence documents (LiDAR, Orthomosaic, GeoTIFF) (3.5s)
  await smoothScroll(250, 3.5, 10);

  // Highlight settlement status badge and ethical disclaimer (10.0s)
  await moveCursor(verifyBtnPos.x, verifyBtnPos.y, 1200, 480, 2.0, 8);
  await recordFrame(8.0);

  // Scroll back up to top (2.5s)
  await smoothScroll(-250, 2.5, 8);

  // Move cursor to sidebar "Assessments" (2.5s)
  const assessmentsNavPos = await evalInPage(`
    (function() {
      const links = Array.from(document.querySelectorAll('aside a'));
      const aLink = links.find(l => l.textContent.includes('Assessments'));
      if (aLink) {
        const r = aLink.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 120, y: 220 };
    })()
  `);
  await moveCursor(1200, 480, assessmentsNavPos.x, assessmentsNavPos.y, 2.5, 8);
  await recordFrame(0.5);

  // --- SCENE 4: Explainable Deterministic Risk Assessments (29.20s) ---
  console.log('Recording Scene 4: Explainable Deterministic Risk Assessments (29.20s)...');
  await evalInPage(`
    (function() {
      const links = Array.from(document.querySelectorAll('aside a'));
      const aLink = links.find(l => l.textContent.includes('Assessments'));
      if (aLink) aLink.click();
    })()
  `);
  await clickCursor(assessmentsNavPos.x, assessmentsNavPos.y, 1.5);
  await sleep(1000);
  await injectCursor();

  // Overview of assessments page (2.5s)
  await recordFrame(2.5);

  // Move cursor to Assessment Card / Score badge (Score 72 / 100) (1.5s)
  const assessCardPos = await evalInPage(`
    (function() {
      const card = document.querySelector('div[class*="cursor-pointer"], button[class*="accordion"]');
      if (card) {
        const r = card.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 700, y: 240 };
    })()
  `);
  await moveCursor(assessmentsNavPos.x, assessmentsNavPos.y, assessCardPos.x, assessCardPos.y, 1.5, 6);

  // Click to expand accordion rules (1.5s)
  await evalInPage(`
    (function() {
      const card = document.querySelector('div[class*="cursor-pointer"], button[class*="accordion"]');
      if (card) card.click();
    })()
  `);
  await clickCursor(assessCardPos.x, assessCardPos.y, 1.5);

  // Pause showing expanded itemized rules (4.5s)
  await recordFrame(4.5);

  // Scroll down through findings (CP-RULE-001 through CP-RULE-005) (3.5s)
  await smoothScroll(300, 3.5, 10);

  // Move cursor over severity tags and remediation recommendations (5.0s)
  await moveCursor(assessCardPos.x, assessCardPos.y, 850, 420, 2.0, 8);
  await recordFrame(3.0);

  // Highlight transparent, reproducible scoring vs black-box AI (6.5s)
  await recordFrame(6.5);

  // Move cursor to sidebar "Review Queue" (2.7s)
  const reviewsNavPos = await evalInPage(`
    (function() {
      const links = Array.from(document.querySelectorAll('aside a'));
      const rLink = links.find(l => l.textContent.includes('Review Queue'));
      if (rLink) {
        const r = rLink.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 120, y: 260 };
    })()
  `);
  await moveCursor(850, 420, reviewsNavPos.x, reviewsNavPos.y, 2.7, 8);

  // --- SCENE 5: Reviewer Queue & Separation of Duties (21.70s) ---
  console.log('Recording Scene 5: Reviewer Queue & Separation of Duties (21.70s)...');
  await evalInPage(`
    (function() {
      const links = Array.from(document.querySelectorAll('aside a'));
      const rLink = links.find(l => l.textContent.includes('Review Queue'));
      if (rLink) rLink.click();
    })()
  `);
  await clickCursor(reviewsNavPos.x, reviewsNavPos.y, 1.5);
  await sleep(1000);
  await injectCursor();

  // Review Queue table view (2.5s)
  await recordFrame(2.5);

  // Move cursor over the queue banner explaining Separation of Duties (2.5s)
  await moveCursor(reviewsNavPos.x, reviewsNavPos.y, 700, 200, 2.5, 8);
  await recordFrame(2.0);

  // Move cursor to "Record Decision" / "Review" button (1.5s)
  const decisionBtnPos = await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const dBtn = btns.find(b => b.textContent.includes('Record Decision') || b.textContent.includes('Review'));
      if (dBtn) {
        const r = dBtn.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 1500, y: 340 };
    })()
  `);
  await moveCursor(700, 200, decisionBtnPos.x, decisionBtnPos.y, 1.5, 6);

  // Click button to open Review Decision Modal (1.5s)
  await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const dBtn = btns.find(b => b.textContent.includes('Record Decision') || b.textContent.includes('Review'));
      if (dBtn) dBtn.click();
    })()
  `);
  await clickCursor(decisionBtnPos.x, decisionBtnPos.y, 1.5);

  // Decision Modal visible (2.5s)
  await recordFrame(2.5);

  // Move cursor to rationale text area (1.2s)
  const rationalePos = await evalInPage(`
    (function() {
      const txt = document.querySelector('textarea');
      if (txt) {
        const r = txt.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 960, y: 550 };
    })()
  `);
  await moveCursor(decisionBtnPos.x, decisionBtnPos.y, rationalePos.x, rationalePos.y, 1.2, 6);

  // Type audit justification into textarea (2.5s)
  await evalInPage(`
    (function() {
      const txt = document.querySelector('textarea');
      if (txt) {
        txt.focus();
        txt.value = 'All cryptographic evidence fingerprints verified. Additionality hurdle satisfied.';
        txt.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()
  `);
  await recordFrame(2.5);

  // Move cursor to Close / Cancel button on modal (1.5s)
  const modalClosePos = await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const cBtn = btns.find(b => b.textContent.includes('Cancel') || b.textContent.includes('Close'));
      if (cBtn) {
        const r = cBtn.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 880, y: 640 };
    })()
  `);
  await moveCursor(rationalePos.x, rationalePos.y, modalClosePos.x, modalClosePos.y, 1.5, 6);

  // Close modal (1.0s)
  await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const cBtn = btns.find(b => b.textContent.includes('Cancel') || b.textContent.includes('Close'));
      if (cBtn) cBtn.click();
    })()
  `);
  await clickCursor(modalClosePos.x, modalClosePos.y, 1.0);

  // Move cursor toward sidebar "Credit Registry" (1.0s)
  const creditsNavPos = await evalInPage(`
    (function() {
      const links = Array.from(document.querySelectorAll('aside a'));
      const cLink = links.find(l => l.textContent.includes('Credit Registry'));
      if (cLink) {
        const r = cLink.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 120, y: 300 };
    })()
  `);
  await moveCursor(modalClosePos.x, modalClosePos.y, creditsNavPos.x, creditsNavPos.y, 1.0, 4);

  // --- SCENE 6: Credit Registry & Dual-Layer Blockchain Settlement (29.10s) ---
  console.log('Recording Scene 6: Credit Registry & Blockchain Settlement (29.10s)...');
  await evalInPage(`
    (function() {
      const links = Array.from(document.querySelectorAll('aside a'));
      const cLink = links.find(l => l.textContent.includes('Credit Registry'));
      if (cLink) cLink.click();
    })()
  `);
  await clickCursor(creditsNavPos.x, creditsNavPos.y, 1.5);
  await sleep(1000);
  await injectCursor();

  // Credit Registry table loaded (3.0s)
  await recordFrame(3.0);

  // Move cursor over Total Issued, Active Supply, and Retired metrics (2.5s)
  await moveCursor(creditsNavPos.x, creditsNavPos.y, 650, 220, 2.5, 8);
  await recordFrame(2.5);

  // Move cursor to "Retire Batch" button (1.5s)
  const retireBtnPos = await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const rBtn = btns.find(b => b.textContent.includes('Retire'));
      if (rBtn) {
        const r = rBtn.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 1500, y: 350 };
    })()
  `);
  await moveCursor(650, 220, retireBtnPos.x, retireBtnPos.y, 1.5, 6);

  // Click "Retire Batch" to open modal (1.5s)
  await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const rBtn = btns.find(b => b.textContent.includes('Retire'));
      if (rBtn) rBtn.click();
    })()
  `);
  await clickCursor(retireBtnPos.x, retireBtnPos.y, 1.5);

  // Retirement modal visible (2.5s)
  await recordFrame(2.5);

  // Type beneficiary name into form (3.0s)
  await evalInPage(`
    (function() {
      const inps = Array.from(document.querySelectorAll('input'));
      if (inps.length > 0) {
        const inp = inps[inps.length - 1];
        inp.focus();
        inp.value = 'Microsoft Climate Innovation Fund';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()
  `);
  await recordFrame(3.0);

  // Highlight EVM settlement notice & idempotency key protection (4.0s)
  await recordFrame(4.0);

  // Close retirement modal (1.5s)
  await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const cBtn = btns.find(b => b.textContent.includes('Cancel') || b.textContent.includes('Close'));
      if (cBtn) cBtn.click();
    })()
  `);
  await recordFrame(1.5);

  // Move cursor over EVM Transaction Hash and block confirmation in ledger table (4.5s)
  await moveCursor(960, 500, 1100, 420, 2.0, 8);
  await recordFrame(2.5);

  // Move cursor to sidebar "Public Verification" (2.1s)
  const publicNavPos = await evalInPage(`
    (function() {
      const links = Array.from(document.querySelectorAll('aside a'));
      const pLink = links.find(l => l.textContent.includes('Public Verification'));
      if (pLink) {
        const r = pLink.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 120, y: 340 };
    })()
  `);
  await moveCursor(1100, 420, publicNavPos.x, publicNavPos.y, 2.1, 8);

  // --- SCENE 7: Zero-Trust Public Portal & Closing (20.91s) ---
  console.log('Recording Scene 7: Zero-Trust Public Portal (20.91s)...');
  await evalInPage(`
    (function() {
      const links = Array.from(document.querySelectorAll('aside a'));
      const pLink = links.find(l => l.textContent.includes('Public Verification'));
      if (pLink) pLink.click();
    })()
  `);
  await clickCursor(publicNavPos.x, publicNavPos.y, 1.5);
  await sleep(1000);
  await injectCursor();

  // Public Portal view (2.5s)
  await recordFrame(2.5);

  // Move cursor to Public Lookup input (1.2s)
  const publicInputPos = await evalInPage(`
    (function() {
      const inp = document.querySelector('input');
      if (inp) {
        const r = inp.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 800, y: 220 };
    })()
  `);
  await moveCursor(publicNavPos.x, publicNavPos.y, publicInputPos.x, publicInputPos.y, 1.2, 6);

  // Type project UUID into public search (2.5s)
  await evalInPage(`
    (function() {
      const inp = document.querySelector('input');
      if (inp) {
        inp.focus();
        inp.value = '550e8400-e29b-41d4-a716-446655440001';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()
  `);
  await recordFrame(2.5);

  // Move cursor to "Verify Public Record" button (1.0s)
  const publicSearchBtnPos = await evalInPage(`
    (function() {
      const btn = document.querySelector('button[type="submit"]');
      if (btn) {
        const r = btn.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 1200, y: 220 };
    })()
  `);
  await moveCursor(publicInputPos.x, publicInputPos.y, publicSearchBtnPos.x, publicSearchBtnPos.y, 1.0, 4);

  // Click search button (1.5s)
  await evalInPage(`document.querySelector('button[type="submit"]')?.click();`);
  await clickCursor(publicSearchBtnPos.x, publicSearchBtnPos.y, 1.5);

  // Public verification result rendered (5.5s)
  await moveCursor(publicSearchBtnPos.x, publicSearchBtnPos.y, 960, 450, 2.0, 8);
  await recordFrame(3.5);

  // Final hold on zero-trust verification certificate & concluding statement (5.21s)
  await recordFrame(5.21);

  console.log(`Captured ${frameIndex} total interactive frames.`);

  // Write out concat file
  // Add terminal line without duration per ffconcat spec
  const lastFile = concatLines[concatLines.length - 2];
  concatLines.push(lastFile);
  fs.writeFileSync(CONCAT_FILE, concatLines.join('\n'));
  console.log(`Saved concat file with ${concatLines.length} directives.`);

  ws.close();
  chrome.kill();

  // --- Step 8: FFmpeg Assembly with Master Narration & Captions ---
  console.log('Assembling final MP4 video with FFmpeg...');
  const OUTPUT_MP4 = path.resolve('media/demo/carbonproof-demo.mp4');
  const NARRATION_AUDIO = path.resolve('media/demo/narration.mp3');

  const ffmpeg = spawn(
    'ffmpeg',
    [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      CONCAT_FILE,
      '-i',
      NARRATION_AUDIO,
      '-c:v',
      'libopenh264',
      '-pix_fmt',
      'yuv420p',
      '-b:v',
      '3000k',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-shortest',
      OUTPUT_MP4,
    ],
    { stdio: 'inherit' }
  );

  await new Promise((resolve, reject) => {
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
  });

  console.log(`\nSUCCESS! Master demo video generated at:\n${OUTPUT_MP4}`);
}

main().catch((err) => {
  console.error('Fatal recording error:', err);
  process.exit(1);
});
