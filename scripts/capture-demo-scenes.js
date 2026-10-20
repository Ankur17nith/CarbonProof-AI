import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('media/demo/recording');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('1. Authenticating as Demo Administrator...');
  const loginRes = await fetch('http://localhost:5173/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@example.test',
      password: 'development-only-password-123',
    }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data.accessToken;
  const user = loginData.data.user;
  console.log('Authenticated user:', user.displayName, 'Token acquired.');

  console.log('2. Launching headless Google Chrome with CDP...');
  const chrome = spawn(
    'google-chrome',
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--no-sandbox',
      '--disable-gpu',
      '--window-size=1920,1080',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  await sleep(2000);

  const versionRes = await fetch('http://127.0.0.1:9222/json/list');
  const targets = await versionRes.json();
  const pageTarget = targets.find((t) => t.type === 'page');
  const wsUrl = pageTarget.webSocketDebuggerUrl;

  console.log('3. Connecting to Chrome via CDP WebSocket:', wsUrl);
  const ws = new WebSocket(wsUrl);

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

  // Set device metrics
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // Enable Page domain
  await sendCommand('Page.enable');

  const scenes = [
    { name: 'scene1_dashboard.png', url: 'http://localhost:5173/' },
    { name: 'scene2_projects.png', url: 'http://localhost:5173/projects' },
    { name: 'scene3_evidence.png', url: 'http://localhost:5173/evidence' },
    { name: 'scene4_assessments.png', url: 'http://localhost:5173/assessments' },
    { name: 'scene5_reviews.png', url: 'http://localhost:5173/reviews' },
    { name: 'scene6_credits.png', url: 'http://localhost:5173/credits' },
    { name: 'scene7_public.png', url: 'http://localhost:5173/public' },
  ];

  for (const scene of scenes) {
    console.log(`Navigating to ${scene.url}...`);
    await sendCommand('Page.navigate', { url: scene.url });
    await sleep(2500);

    // Inject authentication into sessionStorage
    await sendCommand('Runtime.evaluate', {
      expression: `
        sessionStorage.setItem('carbonproof_auth_token', ${JSON.stringify(token)});
        sessionStorage.setItem('carbonproof_auth_user', ${JSON.stringify(JSON.stringify(user))});
      `,
    });

    await sleep(1500);

    console.log(`Capturing 1080p frame: ${scene.name}...`);
    const { data } = await sendCommand('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });

    const filePath = path.join(OUT_DIR, scene.name);
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    console.log(`Saved: ${filePath}`);
  }

  ws.close();
  chrome.kill();
  console.log('All 7 demo scenes captured successfully!');
}

main().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
