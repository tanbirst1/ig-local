'use strict';
const { focusCodeBox } = require('../auto_reset');

async function waitForCodeScreen(pg, timeoutMs = 15000) {
  try {
    await pg.waitForFunction(() => /security code|enter.*code|one-time|verification code/i.test(document.body ? document.body.innerText : ''), { timeout: timeoutMs });
    return true;
  } catch { return false; }
}

async function fillCode(pg, code) {
  const box = await focusCodeBox(pg);
  if (!box) return false;
  await box.first().click().catch(() => {});
  await box.first().fill('');
  for (const ch of code) await box.first().pressSequentially(ch, { delay: 80 });
  const submit = pg.getByRole('button', { name: /Confirm|Continue|Verify|Submit/i });
  if (await submit.count()) await submit.first().click();
  return true;
}

module.exports = { waitForCodeScreen, fillCode };