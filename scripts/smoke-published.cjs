// Read-only production smoke; no account, MQTT, physical command or mocked Firebase.
const { chromium } = require('playwright');
const fs = require('node:fs');
(async () => {
  const base = 'https://evellyn-omaia.github.io/Solda-sistema-versao-semifinal';
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const result = { base, mockedFirebase: false, authenticated: false, physicalCamera: false, websocketAttempts: 0, pages: [] };
  await context.routeWebSocket('**/*', socket => { result.websocketAttempts++; socket.close(); });
  try {
    for (const path of ['/solda-login/login.html', '/new-program/camera.html', '/new-program/novoprograma.html']) {
      const page = await context.newPage();
      const entry = { path, errors: 0, failedResponses: [] };
      page.on('pageerror', () => entry.errors++);
      page.on('response', response => { if (response.status() >= 400) entry.failedResponses.push({ path: new URL(response.url()).pathname, status: response.status() }); });
      const response = await page.goto(base + path, { waitUntil: 'networkidle' });
      entry.status = response.status();
      entry.secureContext = await page.evaluate(() => window.isSecureContext);
      if (path.endsWith('novoprograma.html')) {
        await page.waitForFunction(() => typeof mesaReal !== 'undefined' && mesaReal && conjuntoMovel);
        entry.publicMode = await page.evaluate(() => window.SoldaTechMQTTConfig.publico === true);
      }
      if (path.endsWith('camera.html')) {
        entry.cameraNotStarted = await page.evaluate(() => !document.querySelector('video')?.srcObject);
      }
      result.pages.push(entry);
      await page.close();
    }
    const response = await context.request.get('https://projeto-solda-default-rtdb.firebaseio.com/.json');
    result.unauthenticatedDatabaseStatus = response.status();
    result.passed = result.websocketAttempts === 0 && result.pages.every(p => p.status === 200 && p.secureContext && p.errors === 0 && p.failedResponses.length === 0) && result.unauthenticatedDatabaseStatus === 401;
    fs.writeFileSync('homologacao/published-smoke-atual.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    if (!result.passed) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(() => { console.error('Production smoke failed; no credentials logged.'); process.exitCode = 1; });
