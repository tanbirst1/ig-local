const { chromium } = require('patchright');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');

const BLACKLIST_PATH = '/workspace/app/.tor-blacklist.json';
const VERIFIED_PATH = '/tmp/tor-exits.json';

class IPFilter {
  constructor(options = {}) {
    this.config = { ...config.ipFilter, ...options };
    this.blacklist = new Set();
    this.verified = [];
    this._loadBlacklist();
    this._loadVerified();
  }

  _loadBlacklist() {
    try {
      const data = fs.readFileSync(BLACKLIST_PATH, 'utf8');
      const arr = JSON.parse(data);
      this.blacklist = new Set(arr);
    } catch {
      this.blacklist = new Set();
    }
  }

  _saveBlacklist() {
    fs.writeFileSync(BLACKLIST_PATH, JSON.stringify([...this.blacklist]), 'utf8');
  }

  _loadVerified() {
    try {
      const data = fs.readFileSync(VERIFIED_PATH, 'utf8');
      this.verified = JSON.parse(data);
    } catch {
      this.verified = [];
    }
  }

  _saveVerified() {
    fs.writeFileSync(VERIFIED_PATH, JSON.stringify(this.verified, null, 2), 'utf8');
  }

  isBlacklisted(ip) {
    return this.blacklist.has(ip);
  }

  addToBlacklist(ip) {
    this.blacklist.add(ip);
    this._saveBlacklist();
  }

  async verifyExit(exitIp, proxyUrl, timeoutMs = 15000) {
    try {
      const browser = await chromium.launch({
        executablePath: config.browser.executablePath,
        headless: true,
        proxy: { server: `socks5://127.0.0.1:${proxyUrl.split(':')[2]}` },
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions'
        ]
      });

      const context = await browser.newContext({
        viewport: { width: 375, height: 667 }
      });

      const page = await context.newPage();
      await page.goto('https://www.instagram.com/accounts/password/reset/', {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs
      });

      const title = await page.title().catch(() => '');
      const bodyText = await page.locator('body').innerText().catch(() => '');

      await browser.close();

      const blocked = /sorry, something went wrong|try again later|help us confirm|recaptcha|captcha/.test(bodyText + ' ' + title);
      const reachable = /instagram|log in|sign up|create/i.test(bodyText + ' ' + title);

      if (!blocked && reachable) {
        return { valid: true, exitIp, latency: Date.now() - Date.now() };
      }

      return { valid: false, exitIp, reason: blocked ? 'blocked' : 'unreachable' };
    } catch (err) {
      return { valid: false, exitIp, reason: err.message || 'error' };
    }
  }

  async preGeneratePool(n, getTorExitFn) {
    const pool = [];
    const seen = new Set();

    while (pool.length < n) {
      const tor = await getTorExitFn();
      if (!tor || !tor.ip) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      const ip = tor.ip;
      if (seen.has(ip) || this.blacklist.has(ip)) {
        continue;
      }

      const verified = await this.verifyExit(ip, tor.proxy);
      if (verified.valid) {
        pool.push({
          exitIp: ip,
          proxy: tor.proxy,
          locale: tor.locale,
          timezone: tor.timezone,
          country: tor.country
        });
        seen.add(ip);
      } else {
        this.addToBlacklist(ip);
      }
    }

    this.verified = pool;
    this._saveVerified();
    return pool;
  }

  async getExitFromPool(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const exits = JSON.parse(content);
    if (exits.length === 0) return null;

    const exit = exits.pop();
    this.verified = exits;

    try {
      fs.writeFileSync(filePath, JSON.stringify(exits, null, 2), 'utf8');
    } catch {}

    this._saveVerified();
    return exit;
  }

  getPoolPath(n) {
    return `/workspace/app/${n}.txt`;
  }

  async createPoolFile(n, items) {
    const path = this.getPoolPath(n);
    fs.writeFileSync(path, JSON.stringify(items, null, 2), 'utf8');
    return items;
  }

  async deletePoolFile(n) {
    const path = this.getPoolPath(n);
    try {
      fs.unlinkSync(path);
    } catch {}
  }

  startRefill(n, getTorExitFn, intervalMs = 300000) {
    const refill = async () => {
      try {
        const pool = await this.preGeneratePool(1, getTorExitFn);
        if (pool.length > 0) {
          const currentPath = this.getPoolPath(n);
          const current = [];
          try {
            const content = fs.readFileSync(currentPath, 'utf8');
            const existing = JSON.parse(content);
            if (existing.length < n) {
              const updated = [...existing, ...pool];
              fs.writeFileSync(currentPath, JSON.stringify(updated.slice(0, n), null, 2), 'utf8');
            }
          } catch {
            fs.writeFileSync(currentPath, JSON.stringify(pool, null, 2), 'utf8');
          }
        }
      } catch (err) {
        console.error('[IPFilter] Refill error:', err.message);
      }

      setTimeout(refill, intervalMs);
    };

    refill();
    return refill;
  }
}

module.exports = { IPFilter };
