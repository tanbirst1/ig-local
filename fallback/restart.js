const { sleep } = require('../utils/sleep');
const config = require('../config.json');

class WorkerRestart {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || config.retries.maxConsecutive;
    this.baseDelay = options.baseDelay || config.retries.baseDelayMs;
    this.maxDelay = options.maxDelay || config.retries.maxDelayMs;
    this.jitterRatio = options.jitterRatio || config.retries.jitterRatio;
    this.retryCounts = new Map();
  }

  getRetryCount(workerId) {
    return this.retryCounts.get(workerId) || 0;
  }

  incrementRetry(workerId) {
    const count = this.getRetryCount(workerId) + 1;
    this.retryCounts.set(workerId, count);
    return count;
  }

  resetRetry(workerId) {
    this.retryCounts.delete(workerId);
  }

  async calculateDelay(workerId) {
    const count = this.getRetryCount(workerId);
    if (count === 0) return 0;

    const exponentialDelay = Math.min(
      this.baseDelay * Math.pow(2, count - 1),
      this.maxDelay
    );

    const jitter = exponentialDelay * this.jitterRatio * Math.random();
    return Math.floor(exponentialDelay + jitter);
  }

  async waitForRetry(workerId) {
    const delay = await this.calculateDelay(workerId);
    if (delay > 0) {
      console.log(`[Worker ${workerId}] Waiting ${delay}ms before retry (attempt ${this.getRetryCount(workerId)})`);
      await sleep(delay);
    }
  }

  shouldQuit(workerId) {
    return this.getRetryCount(workerId) >= this.maxRetries;
  }

  async restartWorker(worker, newExit, browserPool) {
    await this.waitForRetry(worker.id);

    try {
      if (worker.context) {
        await worker.context.close();
      }
    } catch {}

    worker.exit = newExit;
    worker.context = await browserPool.createContext(newExit);
    worker.page = await worker.context.newPage();

    this.incrementRetry(worker.id);
    return worker;
  }

  releaseWorker(worker) {
    this.resetRetry(worker.id);
  }
}

module.exports = { WorkerRestart };
