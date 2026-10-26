class BlockClassifier {
  static classify(url, bodyText, title) {
    const text = (bodyText || '') + ' ' + (title || '');
    const lower = text.toLowerCase();

    if (/help us confirm|recaptcha|captcha|security check/i.test(lower)) {
      return {
        type: 'CHALLENGE',
        reason: 'CAPTCHA or security challenge detected',
        shouldRotate: false,
        shouldStop: true
      };
    }

    if (/sorry, something went wrong|try again later|not available/i.test(lower)) {
      return {
        type: 'IP_BLOCK',
        reason: 'IP blocked or service unavailable',
        shouldRotate: true,
        shouldStop: false
      };
    }

    if (/please wait|slow down|rate.?limit|too many|unusual activ/i.test(lower)) {
      return {
        type: 'RATE_LIMIT',
        reason: 'Rate limit detected',
        shouldRotate: false,
        shouldStop: false
      };
    }

    if (/account.*locked|suspended|disabled|restricted/i.test(lower)) {
      return {
        type: 'ACCOUNT_BLOCK',
        reason: 'Account locked or restricted',
        shouldRotate: false,
        shouldStop: true
      };
    }

    if (/404|not found|page not found/i.test(lower)) {
      return {
        type: 'PAGE_ERROR',
        reason: 'Page not found or error',
        shouldRotate: false,
        shouldStop: false
      };
    }

    return {
      type: 'UNKNOWN',
      reason: 'Unknown block type',
      shouldRotate: false,
      shouldStop: false
    };
  }

  static isChallenge(blockType) {
    return blockType === 'CHALLENGE';
  }

  static isIPBlock(blockType) {
    return blockType === 'IP_BLOCK';
  }

  static isRateLimit(blockType) {
    return blockType === 'RATE_LIMIT';
  }

  static isAccountBlock(blockType) {
    return blockType === 'ACCOUNT_BLOCK';
  }
}

module.exports = { BlockClassifier };
