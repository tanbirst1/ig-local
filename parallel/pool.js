const { chromium } = require('patchright');
const config = require('../config.json');
const { GeoManager } = require('../util/geo');

class BrowserPool {
  constructor(options = {}) {
    this.config = { ...config.browser, ...options };
    this.browser = null;
    this.contexts = new Map(); // exitIp -> context
    this.exitContexts = new Map(); // exitIp -> context
    this.maxContexts = options.maxContexts || config.concurrency.maxContexts;
    this.contextMemoryMb = options.contextMemoryMb || config.concurrency.contextMemoryMb;
    this.memoryBudgetMb = options.memoryBudgetMb || config.concurrency.initialBudgetMb;
    this.geoManager = new GeoManager();
    this.blockedExits = new Set();
  }

  async init() {
    if (this.browser) return this.browser;

    this.browser = await chromium.launch({
      executablePath: this.config.executablePath,
      headless: this.config.headless,
      isolatedContext: this.config.isolatedContext,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-blink-features=AutomationControlled',
        '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'
      ]
    });

    await this.setupResourceBlocking();
    return this.browser;
  }

  async setupResourceBlocking() {
    if (!this.browser) return;

    this.browser.on('contextcreated', (context) => {
      context.route('**/*', (route) => {
        const request = route.request();
        const resourceType = request.resourceType();

        if (this.config.blockImages && resourceType === 'image') {
          return route.abort();
        }
        if (this.config.blockMedia && (resourceType === 'media' || resourceType === 'video')) {
          return route.abort();
        }
        if (this.config.blockFonts && resourceType === 'font') {
          return route.abort();
        }

        return route.continue();
      });
    });
  }

  async createContext(exit) {
    if (this.blockedExits.has(exit.ip)) {
      throw new Error(`Exit ${exit.ip} is blocked`);
    }

    if (this.exitContexts.has(exit.ip)) {
      return this.exitContexts.get(exit.ip);
    }

    const contextOptions = {
      viewport: this.config.mobileViewport,
      userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
      locale: exit.locale || this.config.locale,
      timezoneId: exit.timezone || this.config.timezoneId,
      hasTouch: this.config.touchEnabled,
      isMobile: this.config.touchEnabled,
      acceptLanguage: this.getAcceptLanguage(exit.locale || this.config.locale),
      proxy: { server: exit.proxy }
    };

    const context = await this.browser.newContext(contextOptions);

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'languages', { get: () => [window.navigator.language] });
      Object.defineProperty(navigator, 'platform', { get: () => 'Linux armv8l' });
      Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
    });

    this.exitContexts.set(exit.ip, context);
    return context;
  }

  getAcceptLanguage(locale) {
    const parts = locale.split('-');
    const lang = parts[0];
    const country = parts[1];
    return `${lang}-${country || lang.toUpperCase()},${lang};q=0.9,en;q=0.8`;
  }

  async closeContext(exitIp) {
    const context = this.exitContexts.get(exitIp);
    if (context) {
      try { await context.close(); } catch {}
      this.exitContexts.delete(exitIp);
    }
  }

  async closeAll() {
    for (const context of this.exitContexts.values()) {
      try { await context.close(); } catch {}
    }
    this.exitContexts.clear();

    if (this.browser) {
      try { await this.browser.close(); } catch {}
      this.browser = null;
    }
  }

  markExitAsDead(ip, reason) {
    this.blockedExits.add(ip);
    console.log(`[BrowserPool] Exit ${ip} marked dead: ${reason}`);
  }

  getActiveContextCount() {
    return this.exitContexts.size;
  }

  getRemainingBudget() {
    const used = this.exitContexts.size * this.contextMemoryMb;
    return Math.max(0, this.memoryBudgetMb - used);
  }

  canCreateContext() {
    return this.exitContexts.size < this.maxContexts && this.getRemainingBudget() >= this.contextMemoryMb;
  }
}

module.exports = { BrowserPool };
