const { sleep, jitteredDelay } = require('../utils/sleep');
const { BlockHandler } = require('../fallback/block');
const { BlockClassifier } = require('../fallback/classifier');
const { CaptureManager } = require('../ig/capture');

class SubagentManager {
  constructor(options = {}) {
    this.username = options.username;
    this.workerCount = options.workerCount || 1;
    this.workerPool = [];
    this.running = false;
    this.results = [];
    this.blockHandler = new BlockHandler();
    this.classifier = new BlockClassifier();
    this.captureManager = new CaptureManager();
  }

  async createWorker(workerId, exit, browserPool, translator) {
    const context = await browserPool.createContext(exit);
    const page = await context.newPage();

    const worker = {
      id: workerId,
      exit,
      context,
      page,
      translator,
      lastActivity: Date.now()
    };

    return worker;
  }

  async consumeWorkerQueue(exit, browserPool, translator) {
    const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let worker = null;

    try {
      worker = await this.createWorker(workerId, exit, browserPool, translator);
      console.log('[' + workerId + '] Created worker with exit ' + exit.ip);

      await this.runWorkerJob(worker);
      console.log('[' + workerId + '] Job completed successfully');
    } catch (error) {
      console.log('[' + workerId + '] Worker job failed: ' + error.message);
      await this.captureManager.captureAll(worker ? worker.page : null, 'worker_failure', worker ? worker.id : workerId);
      throw error;
    } finally {
      if (worker) {
        await browserPool.closeContext(worker.exit.ip);
        worker = null;
      }
    }
  }

  async runWorkerJob(worker) {
    worker.lastActivity = Date.now();
    const workerId = worker.id;

    await worker.page.goto('https://www.instagram.com/accounts/password/reset/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await worker.page.screenshot({ path: '/workspace/app/logs/' + workerId + '_start.png' });

    const username = this.username;
    await worker.page.getByPlaceholder(/Mobile number|username|email/i).fill(username);
    await worker.page.getByRole('button', { name: 'Continue' }).click();

    await sleep(2000);

    await worker.page.screenshot({ path: '/workspace/app/logs/' + workerId + '_after_continue.png' });

    const bodyText = await worker.page.locator('body').innerText().catch(() => '');
    const title = await worker.page.title().catch(() => '');
    const classification = this.classifier.classify(worker.page.url(), bodyText, title);

    if (this.blockHandler.isChallenge(classification.type)) {
      await this.captureManager.captureAll(worker.page, 'challenge', worker.id);
      throw new Error('CAPTCHA or security challenge detected');
    }

    if (this.blockHandler.isIPBlock(classification.type)) {
      await browserPool.markExitAsDead(worker.exit.ip, 'IP block');
      throw new Error('IP blocked by Instagram');
    }

    if (this.blockHandler.isRateLimit(classification.type)) {
      await sleep(jitteredDelay(30000, 120000, 0.3));
      return this.runWorkerJob(worker);
    }

    await worker.page.screenshot({ path: '/workspace/app/logs/' + workerId + '_success.png' });

    await worker.context.storageState({ path: '/workspace/app/sessions/' + username + '_success.json' });

    console.log('[' + workerId + '] Worker successfully completed job');
  }

  async manageQueue(n, exit, browserPool, translator) {
    console.log('[' + n + '] Starting worker management for exit ' + exit.ip);

    for (let i = 0; i < this.workerCount; i++) {
      const workerId = n + '_worker_' + i;
      try {
        await this.consumeWorkerQueue(exit, browserPool, translator);
      } catch (error) {
        console.log('[' + workerId + '] Worker failed: ' + error.message);
      }
    }

    console.log('[' + n + '] Worker management completed');
  }

  async start(n, exit, browserPool, translator) {
    console.log('[' + n + '] Starting management for exit ' + exit.ip);
    await this.manageQueue(n, exit, browserPool, translator);
    console.log('[' + n + '] Management completed');
  }
}

module.exports = { SubagentManager };
