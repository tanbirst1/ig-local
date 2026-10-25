'use strict';
const { buildSessionSettings } = require('../auto_reset');

async function gotoReset(pg) {
  await pg.goto('https://www.instagram.com/accounts/password/reset/', { waitUntil: 'domcontentloaded' });
}

async function fillUsername(pg, username) {
  let box = pg.getByPlaceholder(/Mobile number|username|email/i);
  if ((await box.count()) === 0) box = pg.getByRole('textbox').first();
  await box.first().click().catch(() => {});
  await box.first().fill('');
  for (const ch of username) await box.first().pressSequentially(ch, { delay: 60 });
  return box;
}

async function submitUsername(pg) {
  const btn = pg.getByRole('button', { name: 'Continue' });
  if (await btn.count()) await btn.first().click();
}

async function screenshot(pg, name) {
  try { await pg.screenshot({ path: name }); } catch {}
}

module.exports = { gotoReset, fillUsername, submitUsername, screenshot };