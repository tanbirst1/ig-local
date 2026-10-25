const fs = require('fs');
const path = require('path');

const CAPTURE_DIR = '/workspace/app/logs';

class CaptureManager {
  constructor() {
    this.captureDir = CAPTURE_DIR;
    if (!fs.existsSync(this.captureDir)) {
      fs.mkdirSync(this.captureDir, { recursive: true });
    }
  }

  async screenshot(page, label, workerId) {
    const timestamp = Date.now();
    const filename = `worker_${workerId}_${label}_${timestamp}.png`;
    const filepath = path.join(this.captureDir, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    return filepath;
  }

  async captureHTML(page, label, workerId) {
    const timestamp = Date.now();
    const filename = `worker_${workerId}_${label}_${timestamp}.html`;
    const filepath = path.join(this.captureDir, filename);
    const html = await page.content();
    fs.writeFileSync(filepath, html, 'utf8');
    return filepath;
  }

  async captureResponse(page, label, workerId) {
    const timestamp = Date.now();
    const filename = `worker_${workerId}_${label}_${timestamp}.json`;
    const filepath = path.join(this.captureDir, filename);

    const responses = [];
    page.on('response', response => {
      if (response.url().includes('instagram.com')) {
        responses.push({
          url: response.url(),
          status: response.status(),
          headers: response.headers(),
          timestamp: Date.now()
        });
      }
    });

    fs.writeFileSync(filepath, JSON.stringify(responses, null, 2), 'utf8');
    return filepath;
  }

  async captureAll(page, label, workerId) {
    const results = {};
    results.screenshot = await this.screenshot(page, label, workerId);
    results.html = await this.captureHTML(page, label, workerId);
    return results;
  }

  cleanup(maxAgeDays = 7) {
    const now = Date.now();
    const files = fs.readdirSync(this.captureDir);

    for (const f of files) {
      const filepath = path.join(this.captureDir, f);
      const stat = fs.statSync(filepath);
      const age = now - stat.mtimeMs;
      if (age > maxAgeDays * 24 * 60 * 60 * 1000) {
        try { fs.unlinkSync(filepath); } catch {}
      }
    }
  }
}

module.exports = { CaptureManager };
