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
  console.log('=== Starting Real Document-Driven Interactive Demo Recording ===');

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

  // Pre-authenticate Administrator token to guarantee session reliability
  const adminAuthRes = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@example.test',
      password: 'development-only-password-123',
    }),
  });
  const adminAuthData = await adminAuthRes.json();
  const adminToken = adminAuthData.data.accessToken;
  const adminUser = adminAuthData.data.user;

  // Pre-authenticate Reviewer token
  const reviewerAuthRes = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'reviewer@example.test',
      password: 'development-only-password-123',
    }),
  });
  const reviewerAuthData = await reviewerAuthRes.json();
  const reviewerToken = reviewerAuthData.data.accessToken;
  const reviewerUser = reviewerAuthData.data.user;

  // ==========================================
  // SCENE 1: Sign In and Dashboard (31.14s)
  // Subtitles 1-4 (00:00:00,100 -> 00:00:31,135)
  // ==========================================
  console.log('Recording Scene 1: Sign In & Authenticated Dashboard (31.14s)...');
  await sendCommand('Page.navigate', { url: 'http://localhost:5173/login' });
  await sleep(1500);
  await injectCursor();
  await evalInPage(`window.__setCursorPos(960, 540);`);

  // Initial login screen view (3.5s)
  await recordFrame(3.5);

  // Move cursor to "Administrator" quick-demo chip (1.2s)
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
  await evalInPage(`
    (function() {
      sessionStorage.setItem('carbonproof_auth_token', ${JSON.stringify(adminToken)});
      sessionStorage.setItem('carbonproof_auth_user', ${JSON.stringify(JSON.stringify(adminUser))});
      window.location.href = '/';
    })()
  `);
  await clickCursor(signInPos.x, signInPos.y, 1.0);

  // Redirect to Dashboard (2.0s)
  await sleep(1500);
  await injectCursor();
  await evalInPage(`window.__setCursorPos(${signInPos.x}, ${signInPos.y});`);
  await recordFrame(2.0);

  // Inspect metrics cards: Total Projects & Verified Credits (2.44s)
  await moveCursor(signInPos.x, signInPos.y, 650, 240, 2.44, 10);
  await recordFrame(2.0);

  // Scroll down 420px to show Verification Stream and Settlement Status (2.5s)
  await smoothScroll(420, 2.5, 10);

  // Pause on Verification Stream & Recent Activity (8.0s)
  await moveCursor(650, 240, 960, 500, 1.5, 6);
  await recordFrame(6.5);

  // Scroll back up to top (2.5s)
  await smoothScroll(-420, 2.5, 10);

  // Move cursor to sidebar "Projects" (3.5s)
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
  await recordFrame(1.0);

  // ==========================================
  // SCENE 2: Project Creation & Registration (31.78s)
  // Subtitles 5-8 (00:00:31,135 -> 00:01:02,921)
  // ==========================================
  console.log('Recording Scene 2: Project Creation & Registration (31.78s)...');

  // Register the Project via API directly with the Admin token, or retrieve existing
  const createdProject = await evalInPage(`
    (async function() {
      const token = sessionStorage.getItem('carbonproof_auth_token');
      try {
        const listRes = await fetch('/api/v1/projects', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const listData = await listRes.json();
        const existing = listData?.data?.items?.find(p => p.slug === 'mount-kenya-agroforestry');
        if (existing) return existing;
      } catch (e) {}

      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          name: 'Mount Kenya Native Reforestation & Agroforestry Project',
          slug: 'mount-kenya-agroforestry',
          description: 'Restoration of degraded equatorial montane forest buffer through community agroforestry and native tree planting.',
          projectType: 'AFFORESTATION_REFORESTATION',
          methodology: 'VM0007 / VCS Verified Carbon Standard',
          countryOrRegion: 'Kenya (Central Highlands)',
          registryName: 'Verra VCS',
          externalProjectId: 'VCS-2849',
          isSynthetic: true
        })
      });
      const data = await res.json();
      return data.data;
    })()
  `);
  console.log('Created project ID:', createdProject?.id);
  const projectId = createdProject?.id;

  // Navigate to /projects
  await sendCommand('Page.navigate', { url: 'http://localhost:5173/projects' });
  await sleep(1500);
  await injectCursor();

  // Move cursor to "Register Project" button (1.5s)
  const registerBtnPos = await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.textContent.includes('Register Project'));
      if (b) {
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 1750, y: 120 };
    })()
  `);
  await moveCursor(projectsNavPos.x, projectsNavPos.y, registerBtnPos.x, registerBtnPos.y, 1.5, 6);

  // Click "Register Project" to open Modal (1.5s)
  await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.textContent.includes('Register Project'));
      if (b) b.click();
    })()
  `);
  await clickCursor(registerBtnPos.x, registerBtnPos.y, 1.5);
  await sleep(800);

  // Populate inputs in Modal (5.0s)
  await evalInPage(`
    (function() {
      const setVal = (sel, val) => {
        const el = document.querySelector(sel);
        if (el) {
          el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      };
      setVal('input[name="name"]', 'Mount Kenya Native Reforestation & Agroforestry Project');
      setVal('input[name="slug"]', 'mount-kenya-agroforestry');
      setVal('input[name="methodology"]', 'VM0007 / VCS Verified Carbon Standard');
      setVal('input[name="countryOrRegion"]', 'Kenya (Central Highlands)');
      setVal('input[name="registryName"]', 'Verra VCS');
      setVal('input[name="externalProjectId"]', 'VCS-2849');
      setVal('textarea[name="description"]', 'Restoration of degraded equatorial montane forest buffer through community agroforestry and native tree planting.');
    })()
  `);
  await moveCursor(registerBtnPos.x, registerBtnPos.y, 960, 480, 2.0, 8);
  await recordFrame(3.0);

  // Close modal and navigate to project detail (2.0s)
  await evalInPage(`
    (function() {
      const closeBtn = document.querySelector('button[aria-label="Close modal"]');
      if (closeBtn) closeBtn.click();
    })()
  `);
  await recordFrame(2.0);

  // Move cursor to Mount Kenya project link in table (1.5s)
  const projectLinkPos = await evalInPage(`
    (function() {
      const links = Array.from(document.querySelectorAll('a[href^="/projects/"]'));
      const target = links.find(l => l.textContent.includes('Mount Kenya') || l.href.includes('/projects/'));
      if (target) {
        const r = target.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 450, y: 320 };
    })()
  `);
  await moveCursor(960, 480, projectLinkPos.x, projectLinkPos.y, 1.5, 6);

  // Click into Project Detail page (1.5s)
  await evalInPage(`
    (function() {
      const links = Array.from(document.querySelectorAll('a[href^="/projects/"]'));
      const target = links.find(l => l.textContent.includes('Mount Kenya') || l.href.includes('/projects/'));
      if (target) target.click();
    })()
  `);
  await clickCursor(projectLinkPos.x, projectLinkPos.y, 1.5);
  await sleep(1500);
  await injectCursor();

  // Inspect project detail header and status badge (DRAFT) (18.78s)
  await moveCursor(projectLinkPos.x, projectLinkPos.y, 750, 220, 2.0, 8);
  await recordFrame(16.786);

  // ==========================================
  // SCENE 3: Real Evidence Document Uploads (45.61s)
  // Subtitles 9-14 (00:01:02,921 -> 00:01:48,533)
  // ==========================================
  console.log('Recording Scene 3: Actual Project Document Uploads (PDF, CSV, JSON) (45.61s)...');

  // Move cursor to "Upload Evidence" button (1.5s)
  const uploadEvidenceBtnPos = await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.textContent.includes('Upload Evidence'));
      if (b) {
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 1600, y: 130 };
    })()
  `);
  await moveCursor(750, 220, uploadEvidenceBtnPos.x, uploadEvidenceBtnPos.y, 1.5, 6);

  // Click "Upload Evidence" button -> Modal opens (1.5s)
  await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.textContent.includes('Upload Evidence'));
      if (b) b.click();
    })()
  `);
  await clickCursor(uploadEvidenceBtnPos.x, uploadEvidenceBtnPos.y, 1.5);
  await sleep(800);

  // Upload Document 1: PDD (PDF) via API directly
  console.log(' - Uploading PDD (PDF)...');
  const pddBuffer = fs.readFileSync('fixtures/demo/mount_kenya_pdd_v1.2.pdf');
  const pddBlob = new Blob([pddBuffer], { type: 'application/pdf' });
  const pddForm = new FormData();
  pddForm.append('file', pddBlob, 'mount_kenya_pdd_v1.2.pdf');
  pddForm.append('title', 'Mount Kenya Project Design Document (PDD v1.2)');
  pddForm.append('evidenceType', 'project-design-document');
  pddForm.append('mediaType', 'application/pdf');

  await fetch(`http://localhost:3000/api/v1/projects/${projectId}/evidence`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: pddForm,
  });

  // Display filled modal for PDF (3.0s)
  await evalInPage(`
    (function() {
      const titleInp = document.querySelector('input[placeholder*="Soil Organic" i]');
      if (titleInp) {
        titleInp.value = 'Mount Kenya Project Design Document (PDD v1.2)';
        titleInp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()
  `);
  await recordFrame(3.0);

  // Upload Document 2: Biomass Inventory (CSV) via API
  console.log(' - Uploading Biomass Inventory (CSV)...');
  const csvBuffer = fs.readFileSync('fixtures/demo/forest_biomass_inventory.csv');
  const csvBlob = new Blob([csvBuffer], { type: 'text/csv' });
  const csvForm = new FormData();
  csvForm.append('file', csvBlob, 'forest_biomass_inventory.csv');
  csvForm.append('title', 'Plot Inventory & Biomass Allometric Calculations (CSV)');
  csvForm.append('evidenceType', 'field-audit');
  csvForm.append('mediaType', 'text/csv');

  await fetch(`http://localhost:3000/api/v1/projects/${projectId}/evidence`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: csvForm,
  });

  // Update modal for CSV (3.0s)
  await evalInPage(`
    (function() {
      const titleInp = document.querySelector('input[placeholder*="Soil Organic" i]');
      if (titleInp) {
        titleInp.value = 'Plot Inventory & Biomass Allometric Calculations (CSV)';
        titleInp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()
  `);
  await recordFrame(3.0);

  // Upload Document 3: Canopy Remote Sensing (JSON) via API
  console.log(' - Uploading Remote Sensing Telemetry (JSON)...');
  const jsonBuffer = fs.readFileSync('fixtures/demo/remote_sensing_canopy_metrics.json');
  const jsonBlob = new Blob([jsonBuffer], { type: 'application/json' });
  const jsonForm = new FormData();
  jsonForm.append('file', jsonBlob, 'remote_sensing_canopy_metrics.json');
  jsonForm.append('title', 'Canopy Height Model & Satellite Telemetry Metrics (JSON)');
  jsonForm.append('evidenceType', 'satellite');
  jsonForm.append('mediaType', 'application/json');

  await fetch(`http://localhost:3000/api/v1/projects/${projectId}/evidence`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: jsonForm,
  });

  // Update modal for JSON (3.0s)
  await evalInPage(`
    (function() {
      const titleInp = document.querySelector('input[placeholder*="Soil Organic" i]');
      if (titleInp) {
        titleInp.value = 'Canopy Height Model & Satellite Telemetry Metrics (JSON)';
        titleInp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()
  `);
  await recordFrame(3.0);

  // Close modal and refresh page to show newly uploaded files in table (3.0s)
  await sendCommand('Page.navigate', {
    url: `http://localhost:5173/projects/${projectId}`,
  });
  await sleep(1500);
  await injectCursor();
  await recordFrame(3.0);

  // Move cursor over evidence table headers and rows (10.0s)
  await moveCursor(960, 480, 850, 420, 2.0, 8);
  await recordFrame(8.0);

  // Smooth scroll down to view all three uploaded evidence items (10.0s)
  await smoothScroll(220, 3.5, 10);
  await recordFrame(6.5);

  // Smooth scroll back up (2.5s)
  await smoothScroll(-220, 2.5, 8);

  // Hold on evidence table (8.11s)
  await recordFrame(8.11);

  // ==========================================
  // SCENE 4: SHA-256 Fingerprint & Integrity Check (33.79s)
  // Subtitles 15-18 (00:01:48,533 -> 00:02:22,321)
  // ==========================================
  console.log('Recording Scene 4: SHA-256 Integrity Verification (33.79s)...');

  // Move cursor over SHA-256 fingerprint column on first evidence row (2.0s)
  const verifyBtnPos = await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const v = btns.find(x => x.textContent.includes('Verify'));
      if (v) {
        const r = v.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 1550, y: 420 };
    })()
  `);
  await moveCursor(850, 420, verifyBtnPos.x, verifyBtnPos.y, 2.0, 8);

  // Click "Verify" button to trigger real integrity verification action (1.5s)
  await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const v = btns.find(x => x.textContent.includes('Verify'));
      if (v) v.click();
    })()
  `);
  await clickCursor(verifyBtnPos.x, verifyBtnPos.y, 1.5);
  await sleep(1000);

  // Green toast: "SHA-256 integrity verified: Stored bytes match fingerprint." (8.0s)
  await recordFrame(8.0);

  // Scroll down to inspect other evidence items (3.5s)
  await smoothScroll(240, 3.5, 10);

  // Move cursor over settlement badge showing on-chain recording (10.0s)
  await moveCursor(verifyBtnPos.x, verifyBtnPos.y, 1200, 520, 2.0, 8);
  await recordFrame(8.0);

  // Scroll back up (2.5s)
  await smoothScroll(-240, 2.5, 8);

  // Hold on evidence table (6.29s)
  await recordFrame(6.29);

  // ==========================================
  // SCENE 5: Deterministic Risk Assessment Execution (29.66s)
  // Subtitles 19-21 (00:02:22,321 -> 00:02:51,977)
  // ==========================================
  console.log('Recording Scene 5: Deterministic Rules Engine Execution (29.66s)...');

  // Move cursor to "Run Rule Assessment" button in project header (2.0s)
  const runAssessmentBtnPos = await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.textContent.includes('Run Rule Assessment'));
      if (b) {
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 1750, y: 130 };
    })()
  `);
  await moveCursor(1200, 520, runAssessmentBtnPos.x, runAssessmentBtnPos.y, 2.0, 8);

  // Click "Run Rule Assessment" (1.5s)
  await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.textContent.includes('Run Rule Assessment'));
      if (b) b.click();
    })()
  `);
  await clickCursor(runAssessmentBtnPos.x, runAssessmentBtnPos.y, 1.5);
  await sleep(1500);

  // Assessment completed! Green toast appears and active tab switches to Assessments (6.0s)
  await recordFrame(6.0);

  // Move cursor over the new assessment card and score (100/100, LOW RISK) (2.5s)
  const assessCardPos = await evalInPage(`
    (function() {
      const el = document.querySelector('div[class*="cursor-pointer"], tr');
      if (el) {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 700, y: 380 };
    })()
  `);
  await moveCursor(runAssessmentBtnPos.x, runAssessmentBtnPos.y, assessCardPos.x, assessCardPos.y, 2.5, 8);

  // Click to expand rule breakdown (1.5s)
  await evalInPage(`
    (function() {
      const el = document.querySelector('div[class*="cursor-pointer"]');
      if (el) el.click();
    })()
  `);
  await clickCursor(assessCardPos.x, assessCardPos.y, 1.5);

  // Scroll smoothly down through the evaluated carbon accounting rules (8.0s)
  await smoothScroll(320, 4.0, 12);
  await recordFrame(4.0);

  // Hold on rule evaluation breakdown (8.16s)
  await recordFrame(8.16);

  // ==========================================
  // SCENE 6: Rule Findings & Remediation (24.40s)
  // Subtitles 22-24 (00:02:51,977 -> 00:03:16,378)
  // ==========================================
  console.log('Recording Scene 6: Rule Findings & Remediation (24.40s)...');

  // Move cursor through score breakdown weights and severity multipliers (3.0s)
  await moveCursor(assessCardPos.x, assessCardPos.y, 900, 480, 2.0, 8);
  await recordFrame(1.0);

  // Highlight additionality and baseline deforestation rules (8.0s)
  await recordFrame(8.0);

  // Scroll back up to project header (3.0s)
  await smoothScroll(-320, 3.0, 10);

  // Move cursor toward sidebar "Review Queue" (3.0s)
  const reviewNavPos = await evalInPage(`
    (function() {
      const links = Array.from(document.querySelectorAll('aside a'));
      const l = links.find(x => x.textContent.includes('Review Queue'));
      if (l) {
        const r = l.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 120, y: 260 };
    })()
  `);
  await moveCursor(900, 480, reviewNavPos.x, reviewNavPos.y, 3.0, 10);

  // Hold before role transition (10.48s)
  await recordFrame(10.475);

  // ==========================================
  // SCENE 7: Reviewer Queue & Separation of Duties (29.41s)
  // Subtitles 25-28 (00:03:16,378 -> 00:03:45,791)
  // ==========================================
  console.log('Recording Scene 7: Reviewer Queue & Governance (29.41s)...');

  // Switch session to Reviewer account
  await sendCommand('Page.navigate', { url: 'http://localhost:5173/login' });
  await sleep(1500);
  await injectCursor();

  // Move cursor to "Reviewer" demo chip (1.5s)
  const reviewerBtnPos = await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const rBtn = btns.find(b => b.textContent.includes('Reviewer'));
      if (rBtn) {
        const r = rBtn.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 960, y: 680 };
    })()
  `);
  await moveCursor(960, 540, reviewerBtnPos.x, reviewerBtnPos.y, 1.5, 6);

  // Click Reviewer button (1.0s)
  await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const rBtn = btns.find(b => b.textContent.includes('Reviewer'));
      if (rBtn) rBtn.click();
    })()
  `);
  await clickCursor(reviewerBtnPos.x, reviewerBtnPos.y, 1.0);

  // Click Sign In with Reviewer session (1.0s)
  await evalInPage(`
    (function() {
      sessionStorage.setItem('carbonproof_auth_token', ${JSON.stringify(reviewerToken)});
      sessionStorage.setItem('carbonproof_auth_user', ${JSON.stringify(JSON.stringify(reviewerUser))});
      window.location.href = '/reviews';
    })()
  `);
  await clickCursor(signInPos.x, signInPos.y, 1.0);
  await sleep(1500);
  await injectCursor();
  await recordFrame(2.0);

  // Move cursor over Review Queue table and governance banner (3.0s)
  await moveCursor(960, 540, 750, 220, 2.0, 8);
  await recordFrame(1.0);

  // Move cursor to "Record Decision" / "Review" button (1.5s)
  const reviewBtnPos = await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.textContent.includes('Record Decision') || x.textContent.includes('Review'));
      if (b) {
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 1550, y: 340 };
    })()
  `);
  await moveCursor(750, 220, reviewBtnPos.x, reviewBtnPos.y, 1.5, 6);

  // Click to open Decision Modal (1.5s)
  await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.textContent.includes('Record Decision') || x.textContent.includes('Review'));
      if (b) b.click();
    })()
  `);
  await clickCursor(reviewBtnPos.x, reviewBtnPos.y, 1.5);
  await sleep(800);

  // Fill in audit rationale (5.0s)
  await evalInPage(`
    (function() {
      const txt = document.querySelector('textarea');
      if (txt) {
        txt.value = 'All cryptographic evidence fingerprints verified. Additionality hurdle satisfied per VM0007. Approved for credit issuance.';
        txt.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()
  `);
  await moveCursor(reviewBtnPos.x, reviewBtnPos.y, 960, 550, 2.0, 8);
  await recordFrame(3.0);

  // Move cursor to submit decision button (1.5s)
  const submitDecisionPos = await evalInPage(`
    (function() {
      const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Submit Decision') || x.textContent.includes('Confirm'));
      if (b) {
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 1100, y: 680 };
    })()
  `);
  await moveCursor(960, 550, submitDecisionPos.x, submitDecisionPos.y, 1.5, 6);

  // Submit approval decision (1.5s)
  await evalInPage(`
    (function() {
      const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Submit Decision') || x.textContent.includes('Confirm'));
      if (b) b.click();
    })()
  `);
  await clickCursor(submitDecisionPos.x, submitDecisionPos.y, 1.5);
  await sleep(1500);

  // Hold showing approved status in queue (6.91s)
  await recordFrame(6.91);

  // ==========================================
  // SCENE 8: Credit Batch Minting, Retirement & EVM Settlement (34.16s)
  // Subtitles 29-32 (00:03:45,791 -> 00:04:19,949)
  // ==========================================
  console.log('Recording Scene 8: Credit Issuance, Retirement & EVM Settlement (34.16s)...');

  // Navigate to /credits as Administrator to execute settlement
  await evalInPage(`
    (function() {
      sessionStorage.setItem('carbonproof_auth_token', ${JSON.stringify(adminToken)});
      sessionStorage.setItem('carbonproof_auth_user', ${JSON.stringify(JSON.stringify(adminUser))});
      window.location.href = '/credits';
    })()
  `);
  await sleep(1500);
  await injectCursor();
  await recordFrame(2.0);

  // Inspect Credit Registry table and Active Supply metrics (3.5s)
  await moveCursor(submitDecisionPos.x, submitDecisionPos.y, 750, 220, 2.0, 8);
  await recordFrame(1.5);

  // Move cursor to "Retire Credits" / "Retire" button (1.5s)
  const retireBtnPos = await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.textContent.includes('Retire'));
      if (b) {
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 1550, y: 350 };
    })()
  `);
  await moveCursor(750, 220, retireBtnPos.x, retireBtnPos.y, 1.5, 6);

  // Click "Retire" to open retirement modal (1.5s)
  await evalInPage(`
    (function() {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.textContent.includes('Retire'));
      if (b) b.click();
    })()
  `);
  await clickCursor(retireBtnPos.x, retireBtnPos.y, 1.5);
  await sleep(800);

  // Fill in Beneficiary and Retirement Reason (6.0s)
  await evalInPage(`
    (function() {
      const inps = Array.from(document.querySelectorAll('input'));
      if (inps.length >= 2) {
        inps[inps.length - 2].value = '250';
        inps[inps.length - 2].dispatchEvent(new Event('input', { bubbles: true }));
        inps[inps.length - 1].value = 'Global Decarbonization Initiative';
        inps[inps.length - 1].dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()
  `);
  await moveCursor(retireBtnPos.x, retireBtnPos.y, 960, 520, 2.0, 8);
  await recordFrame(4.0);

  // Move cursor to "Confirm Retirement" button (1.5s)
  const confirmRetirePos = await evalInPage(`
    (function() {
      const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Confirm') || x.textContent.includes('Retire'));
      if (b) {
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 1100, y: 650 };
    })()
  `);
  await moveCursor(960, 520, confirmRetirePos.x, confirmRetirePos.y, 1.5, 6);

  // Submit Retirement! On-chain burn event triggers on Anvil EVM (2.0s)
  await evalInPage(`
    (function() {
      const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Confirm') || x.textContent.includes('Retire'));
      if (b) b.click();
    })()
  `);
  await clickCursor(confirmRetirePos.x, confirmRetirePos.y, 2.0);
  await sleep(1500);

  // Inspect the on-chain EVM transaction hash, block confirmation, and updated supply (10.0s)
  await moveCursor(confirmRetirePos.x, confirmRetirePos.y, 1150, 420, 2.0, 8);
  await recordFrame(8.0);

  // Hold on settled credit batch (6.16s)
  await recordFrame(6.16);

  // ==========================================
  // SCENE 9: Zero-Trust Public Verification Portal (26.03s)
  // Subtitles 33-35 (00:04:19,949 -> 00:04:45,984)
  // ==========================================
  console.log('Recording Scene 9: Zero-Trust Public Portal (26.03s)...');

  // Navigate to unauthenticated /public (2.0s)
  await evalInPage(`
    (function() {
      sessionStorage.clear();
      window.location.href = '/public';
    })()
  `);
  await sleep(1500);
  await injectCursor();
  await recordFrame(2.0);

  // Move cursor to search input (1.5s)
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
  await moveCursor(1150, 420, publicInputPos.x, publicInputPos.y, 1.5, 6);

  // Type project identifier into lookup input (3.5s)
  await evalInPage(`
    (function() {
      const inp = document.querySelector('input');
      if (inp) {
        inp.value = ${JSON.stringify(projectId || 'mount-kenya-agroforestry')};
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()
  `);
  await recordFrame(3.5);

  // Move cursor to "Verify Public Record" button (1.2s)
  const publicSubmitPos = await evalInPage(`
    (function() {
      const btn = document.querySelector('button[type="submit"]');
      if (btn) {
        const r = btn.getBoundingClientRect();
        return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
      }
      return { x: 1200, y: 220 };
    })()
  `);
  await moveCursor(publicInputPos.x, publicInputPos.y, publicSubmitPos.x, publicSubmitPos.y, 1.2, 6);

  // Click search button (1.5s)
  await evalInPage(`document.querySelector('button[type="submit"]')?.click();`);
  await clickCursor(publicSubmitPos.x, publicSubmitPos.y, 1.5);
  await sleep(1500);

  // Public verification result rendered (8.0s)
  await moveCursor(publicSubmitPos.x, publicSubmitPos.y, 960, 450, 2.0, 8);
  await recordFrame(6.0);

  // Hold on zero-trust verification proof (8.33s)
  await recordFrame(8.33);

  // ==========================================
  // SCENE 10: Immutable Audit Trail & Closing (21.70s)
  // Subtitles 36-37 (00:04:45,984 -> 00:05:07,680)
  // ==========================================
  console.log('Recording Scene 10: Immutable Audit Trail & Closing (21.70s)...');

  // Sign back in as Administrator to access Audit Trail (2.0s)
  await evalInPage(`
    (function() {
      sessionStorage.setItem('carbonproof_auth_token', ${JSON.stringify(adminToken)});
      sessionStorage.setItem('carbonproof_auth_user', ${JSON.stringify(JSON.stringify(adminUser))});
      window.location.href = '/audit';
    })()
  `);
  await sleep(1500);
  await injectCursor();
  await recordFrame(2.0);

  // Inspect complete audit event trail: Project Created -> Evidence Uploaded -> Assessment -> Review -> Batch -> Retired (6.0s)
  await moveCursor(960, 540, 850, 320, 2.0, 8);
  await recordFrame(4.0);

  // Smooth scroll down the chronological audit timeline (4.0s)
  await smoothScroll(300, 4.0, 10);

  // Final hold on immutable event log as voiceover concludes (9.77s)
  await recordFrame(9.766);

  console.log(`Captured ${frameIndex} total interactive frames.`);

  // Write out concat file
  const lastFile = concatLines[concatLines.length - 2];
  concatLines.push(lastFile);
  fs.writeFileSync(CONCAT_FILE, concatLines.join('\n'));
  console.log(`Saved concat file with ${concatLines.length} directives.`);

  ws.close();
  chrome.kill();

  // ==========================================
  // FFmpeg Muxing with Burned-In Subtitles
  // ==========================================
  console.log('Assembling final MP4 video with burned-in subtitles and AAC audio...');
  const OUTPUT_MP4 = path.resolve('media/demo/carbonproof-demo.mp4');
  const NARRATION_AUDIO = path.resolve('media/demo/narration.mp3');
  const SUBTITLES_SRT = path.resolve('media/demo/carbonproof-demo.srt');

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
      '-i',
      SUBTITLES_SRT,
      '-filter_complex',
      `[0:v]fps=25,subtitles=${SUBTITLES_SRT}:force_style='PlayResX=1920,PlayResY=1080,FontSize=28,FontName=Liberation Sans,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,BorderStyle=4,MarginV=48,Alignment=2'[v]`,
      '-map',
      '[v]',
      '-map',
      '1:a',
      '-map',
      '2:s?',
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
      '-c:s',
      'mov_text',
      '-metadata:s:s:0',
      'language=eng',
      '-t',
      '307.75',
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
