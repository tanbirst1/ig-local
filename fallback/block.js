const config = require('../config.json');
const translator = require('../translator');

class BlockHandler {
  constructor(options = {}) {
    this.cooldownMs = options.cooldownMs || config.ipFilter.cooldownMs;
    this.blockedExits = new Map();
    this.rateLimitedExits = new Map();
  }

  isBlocked(ip) {
    const blockedUntil = this.blockedExits.get(ip);
    if (blockedUntil && Date.now() < blockedUntil) {
      return true;
    }
    if (blockedUntil && Date.now() >= blockedUntil) {
      this.blockedExits.delete(ip);
    }
    return false;
  }

  blockIP(ip, durationMs = this.cooldownMs) {
    const until = Date.now() + durationMs;
    this.blockedExits.set(ip, until);
    console.log('[BlockHandler] IP ' + ip + ' blocked until ' + new Date(until).toString());
  }

  isRateLimited(ip, limit) {
    const limitData = this.rateLimitedExits.get(ip);
    if (!limitData) return false;

    const { count, resetTime } = limitData;
    if (Date.now() >= resetTime) {
      this.rateLimitedExits.delete(ip);
      return false;
    }

    return count >= limit;
  }

  recordRateLimit(ip, maxCount = 10, windowMs = 60000) {
    const now = Date.now();
    let data = this.rateLimitedExits.get(ip);
    if (!data || now >= data.resetTime) {
      data = { count: 1, resetTime: now + windowMs };
    } else {
      data.count++;
    }
    this.rateLimitedExits.set(ip, data);
  }

  classifyIPBlock(url, bodyText, title, exitIp) {
    const classifiers = [
      this.isBlocked(exitIp) ? 'blocked' : null,
      this.isChallenge(url, bodyText, title) ? 'challenge' : null,
      this.isRateLimit(exitIp) ? 'rate_limited' : null
    ];

    const classification = classifiers.find(c => c !== null);
    if (classification) {
      return classification;
    }

    return 'clean';
  }

  isChallenge(url, bodyText, title) {
    const text = (bodyText || '') + ' ' + (title || '');
    const lower = text.toLowerCase();
    const pattern = /help us confirm|recaptcha|captcha|security check|validation|prove you are human/i;
    return pattern.test(lower);
  }

  isRateLimit(ip) {
    return this.isRateLimited(ip, 5);
  }

  isClean(url, bodyText, title, exitIp) {
    return this.classifyIPBlock(url, bodyText, title, exitIp) === 'clean';
  }

  async quarantineExit(exitIp, reason) {
    this.blockIP(exitIp);
    this.recordRateLimit(exitIp);

    console.log('[BlockHandler] Exit ' + exitIp + ' quarantined: ' + reason);
    return {
      exitIp,
      reason,
      blockedUntil: this.blockedExits.get(exitIp)
    };
  }

  async handleBlock(result, worker, context, browserPool, translation) {
    const { url, bodyText, title } = result;
    const exitIp = worker.exit ? worker.exit.ip : null;

    if (!exitIp) {
      return { action: 'ABORT', reason: 'No exit IP found' };
    }

    const blockType = this.classifyIPBlock(url, bodyText, title, exitIp);

    switch (blockType) {
      case 'blocked':
        await browserPool.markExitAsDead(exitIp, 'IP block');
        return { action: 'ROTATE', reason: 'IP blocked' };

      case 'challenge':
        return { action: 'REVIEW', reason: 'CAPTCHA/security challenge' };

      case 'rate_limited':
        this.recordRateLimit(exitIp);
        return { action: 'BACKOFF', reason: 'Rate limit detected' };

      default:
        return { action: 'CONTINUE', reason: 'Unknown block type' };
    }
  }
}

module.exports = { BlockHandler };
