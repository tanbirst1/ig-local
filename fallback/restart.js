'use strict';
const { recordBlock, recordResult } = require('../auto_reset');

async function restartSession(browser, proxy) {
  try { await browser.close(); } catch {}
  return { restarted: true, proxy };
}

function isBlocked(body, title) {
  return /sorry, something went wrong|try again later|help us confirm|recaptcha|captcha/i.test((body || '') + ' ' + (title || ''));
}

function isRateLimited(body) {
  return /please wait|slow down|rate.?limit|unusual activ|429/i.test(body || '');
}

async function captureFailure(pg, tag) {
  try { await pg.screenshot({ path: `fail_${tag}.png` }); } catch {}
}

function recordFailure(username, reason) {
  try { recordResult(username, false); } catch {}
  if (reason === 'blocked') try { recordBlock(username); } catch {}
}

module.exports = { restartSession, isBlocked, isRateLimited, captureFailure, recordFailure };