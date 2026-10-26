#!/usr/bin/env node
const { chromium } = require('patchright');
const fs = require('fs');
const path = require('path');
const { TorManager } = require('./util/tor');
const { IPFilter } = require('./util/ipFilter');
const { GeoManager } = require('./util/geo');
const { BrowserPool } = require('./parallel/pool');
const { SubagentManager } = require('./parallel/manager');
const { BlockClassifier } = require('./fallback/classifier');
const { BlockHandler } = require('./fallback/block');
const { WorkerRestart } = require('./fallback/restart');
const { translator } = require('./translator');
const { CaptureManager } = require('./ig/capture');
const { SessionManager } = require('./ig/session');
const { navigateToResetPage, fillUsername, clickContinue, detectMethodChooser, selectSMSMethod, selectEmailMethod } = require('./ig/nav');
const { findOTPField, fillOTP, submitOTP, waitForOTPPrompt, detectOTPError } = require('./ig/otp');

class OTPLoginRunner {
  constructor(options = {}) {
    this.username = options.username;
    this.agents = options.agents || 1;
    this.torManager = new TorManager();
    this.ipFilter = new IPFilter();
    this.geoManager = new GeoManager();
    this.browserPool = new BrowserPool();
    this.subagentManager = new SubagentManager();
    this.blockClassifier = new BlockClassifier();
    this.blockHandler = new BlockHandler();
    this.workerRestart = new WorkerRestart();
    this.captureManager = new CaptureManager();
    this.sessionManager = new SessionManager();
    this.running = false;
  }

  async startTor() {
    const result = await this.torManager.start();
    if (!result.success) {
      throw new Error(`Tor failed to start: ${result.error || result.message || 'unknown error'}`);
    }
    return result;
  }

  async getNextExit() {
    const tor = new TorManager();
    const exitResult = await tor.newNym();
    const currentIp = await tor.getCurrentExitIp();

    if (!currentIp) {
      return { ip: null, proxy: null, locale: 'en-US', timezone: 'America/New_York', country: 'US' };
    }

    const geo = await this.geoManager.getTorExitInfo(currentIp);
    const proxy = tor.getSocksProxy();

    return {
      ip: currentIp,
      proxy,
      locale: geo.locale,
      timezone: geo.timezone,
      country: geo.country
    };
  }

  async generatePoolFile(n) {
    const exits = [];
    const tor = new TorManager();

    for (let i = 0; i < n; i++) {
      try {
        const exitResult = await tor.newNym();
        const currentIp = await tor.getCurrentExitIp();

        if (currentIp) {
          const geo = await this.geoManager.getTorExitInfo(currentIp);
          exits.push({
            exitIp: currentIp,
            proxy: tor.getSocksProxy(),
            locale: geo.locale,
            timezone: geo.timezone,
            country: geo.country
          });
        }
      } catch (err) {
        console.error(`Pool generation error for ${i}:`, err.message);
      }
      if (i < n - 1) {
        await this.sleepRandom(2000, 8000);
      }
    }

    return exits;
  }

  async sleepRandom(min, max) {
    const { sleep } = require('./utils/sleep');
    return sleep(Math.floor(Math.random() * (max - min + 1)) + min);
  }

  async createPoolFile(n, exits) {
    const poolPath = `/workspace/app/${n}.txt`;
    fs.writeFileSync(poolPath, JSON.stringify(exits, null, 2), 'utf8');
    return poolPath;
  }

  async deletePoolFile(n) {
    const poolPath = `/workspace/app/${n}.txt`;
    try {
      fs.unlinkSync(poolPath);
    } catch {}
  }

  async consumeExitFromPool(filePath) {
    const exits = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const exit = exits.pop();

    try {
      fs.writeFileSync(filePath, JSON.stringify(exits, null, 2), 'utf8');
    } catch {}

    if (exits.length === 0) {
      try { fs.unlinkSync(filePath); } catch {}
    }

    if (!exit) return null;

    const tor = new TorManager();
    const geo = await this.geoManager.getTorExitInfo(exit.exitIp);

    return {
      ...exit,
      proxy: tor.getSocksProxy(),
      locale: geo.locale,
      timezone: geo.timezone
    };
  }

  async startWorker(exit) {
    const browser = await this.browserPool.init();
    const context = await this.browserPool.createContext(exit);
    const page = await context.newPage();

    const worker = {
      id: `subagent_${Date.now()}`,
      exit,
      context,
      page,
      browserPool: this.browserPool
    };

    return worker;
  }

  async runAttempt(worker) {
    const { context, page, exit } = worker;

    await navigateToResetPage(page, { tor: true });
    await page.screenshot({ path: `/workspace/app/logs/${worker.id}_start.png` });

    const username = this.username;
    await fillUsername(page, username);
    await page.screenshot({ path: `/workspace/app/logs/${worker.id}_filled.png` });

    const continueBtn = page.getByRole('button', { name: 'Continue' });
    await continueBtn.click({ timeout: 10000 });
    await sleep(5000);

    await page.screenshot({ path: `/workspace/app/logs/${worker.id}_after_continue.png` });

    const bodyText = await page.locator('body').innerText().catch(() => '');
    const title = await page.title().catch(() => '');
    const classification = this.blockClassifier.classify(page.url(), bodyText, title);

    const blockDecision = await this.blockHandler.handleBlock(
      { url: page.url(), bodyText, title },
      worker,
      context,
      this.browserPool,
      this.blockClassifier
    );

    if (blockDecision.action === 'ROTATE') {
      await this.browserPool.closeContext(exit.ip);
      await this.browserPool.markExitAsDead(exit.ip, blockDecision.reason);

      const tor = new TorManager();
      await tor.newNym();
      const newExit = await tor.getCurrentExitInfo();
      await tor.stop();

      return { rotated: true, newExit };
    }

    if (blockDecision.action === 'REVIEW') {
      await this.captureManager.screenshot(page, 'challenge', worker.id);
      return { rotated: false, reason: blockDecision.reason };
    }

    if (blockDecision.action === 'BACKOFF') {
      await this.sleepRandom(30000, 120000);
      return { rotated: false, reason: blockDecision.reason, shouldRetry: true };
    }

    const result = await this.attemptOTPSubmit(worker, context);

    if (result.success) {
      await context.storageState({
        path: `/workspace/app/sessions/${this.username}_session_${exit.ip}.json`
      });

      console.log(`OTP SUCCESS for ${this.username} via exit ${exit.ip}`);
      return { rotated: false, success: true };
    }

    return { rotated: false, success: false, reason: result.reason };
  }

  async attemptOTPSubmit(worker, context) {
    const { page, exit } = worker;

    const methodHandled = await this.handleMethodChooser(page);
    if (methodHandled) {
      return { success: false, reason: 'method_chooser_seen' };
    }

    const field = await findOTPField(page);
    if (!field) {
      return { success: false, reason: 'otp_field_not_found' };
    }

    await field.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null);
    await sleep(1000);

    const code = await this.generateCode();

    await field.fill('');
    for (const ch of code) {
      await field.pressSequentially(ch, { delay: 100 });
    }

    const submitOk = await submitOTP(page, exit.locale);
    const codeError = await detectOTPError(page, exit.locale).catch(() => null);

    if (codeError) {
      return { success: false, reason: `otp_rejected:${codeError}` };
    }

    const success = await this.detectSuccess(page, exit.locale);

    if (success) {
      return { success: true, reason: 'otp_verified' };
    }

    return { success: false, reason: 'otp_not_confirmed' };
  }

  async handleMethodChooser(page) {
    const seen = await detectMethodChooser(page, true);
    if (seen) {
      const phoneLike = /^[+\d][\d\s+-]*$/.test(this.username) && this.username.replace(/\D/g, '').length >= 7;
      if (!phoneLike) {
        const switchOk = await selectEmailMethod(page);
        if (!switchOk) {
          return true;
        }
      }
    }
    return false;
  }

  generateCode() {
    const crypto = require('crypto');
    return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  }

  async detectSuccess(page, locale) {
    try {
      const url = page.url();
      if (/instagram\.com\/?$/i.test(url) || /instagram\.com\/feed/i.test(url)) {
        const bodyText = await page.locator('body').innerText().catch(() => '');
        if (/log in|sign in|feed|home|profile/i.test(bodyText)) {
          return true;
        }
      }
    } catch {}

    try {
      const bodyText = await page.locator('body').innerText().catch(() => '');
      if (/login info|password saved|save your login/i.test(bodyText)) {
        return true;
      }
    } catch {}

    const errorText = await detectOTPError(page, locale).catch(() => null);
    if (errorText) {
      return false;
    }
    return false;
  }

  async run() {
    this.running = true;
    console.log('OTP Login Runner starting...');
    console.log(`Username: ${this.username}`);
    console.log(`Agents: ${this.agents}`);

    await this.startTor();

    const exits = await this.generatePoolFile(this.agents);

    const poolPath = `/workspace/app/${this.agents}.txt`;
    fs.writeFileSync(poolPath, JSON.stringify(exits, null, 2), 'utf8');

    const browserPool = this.browserPool;
    const translatorInstance = translator;

    for (const exit of exits) {
      await this.runAttemptForExit(exit, browserPool, translatorInstance);
    }

    await browserPool.closeAll();
    await this.torManager.stop();

    console.log('OTP Login Runner finished');
    this.running = false;
  }

  async runAttemptForExit(exit, browserPool, translatorInstance) {
    const worker = await this.startWorker(exit);

    try {
      const result = await this.runAttempt(worker);

      if (result.success) {
        const sessionManager = new SessionManager();
        const sessionPath = await sessionManager.save(worker.context, this.username);

        await this.captureManager.screenshot(worker.page, 'success', 'worker');
        console.log(`Session persisted: ${sessionPath}`);

        return { status: 'SUCCESS' };
      }

      const subagentManager = new SubagentManager();
      return await subagentManager.manageQueue(this.agents, exit, browserPool, translatorInstance);
    } finally {
      try { await worker.context.close(); } catch {}
      try { await worker.page.close(); } catch {}
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--username') {
      options.username = args[++i];
    } else if (arg === '--agents') {
      options.agents = parseInt(args[++i], 10) || 1;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const username = options.username || 'test_user';
  const agents = options.agents || 1;

  const runner = new OTPLoginRunner({
    username,
    agents
  });

  await runner.run();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err.message || err);
    console.error('Stack:', err.stack || '');
    process.exit(1);
  });
}

module.exports = { OTPLoginRunner };
