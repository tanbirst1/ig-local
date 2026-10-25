const { sleep } = require('../utils/sleep');

const RESET_URL = 'https://www.instagram.com/accounts/password/reset/';
const TAB_SWITCH_TEXT = 'Find by email or username instead';

async function navigateToResetPage(page, options = {}) {
  const tor = options.tor || false;
  const timeout = tor ? 60000 : 30000;

  await page.goto(RESET_URL, { waitUntil: 'domcontentloaded', timeout });
  await sleep(3000);

  try {
    const decline = page.getByRole('button', { name: /Decline optional cookies/i });
    if ((await decline.count()) > 0) {
      await decline.first().click({ timeout: 10000 });
      await sleep(2000);
    }
  } catch {}

  return page;
}

async function switchToEmailMode(page, username) {
  const isPhone = /^[+\d][\d\s+-]*$/.test(username) && username.replace(/\D/g, '').length >= 7;

  if (!isPhone) {
    try {
      const switchLink = page.getByText(TAB_SWITCH_TEXT);
      if ((await switchLink.count()) > 0) {
        await switchLink.first().click({ timeout: 10000 });
        await page.getByText('Find by mobile number instead').first().waitFor({ timeout: 15000 });
        return true;
      }
    } catch {}
  }
  return false;
}

async function fillUsername(page, username) {
  const box = page.getByPlaceholder(/Mobile number|username|email/i).first();
  await box.waitFor({ state: 'visible', timeout: 15000 });
  await box.fill('');
  for (const ch of username) {
    await box.pressSequentially(ch, { delay: 60 });
  }
  await sleep(500);
  return page;
}

async function clickContinue(page) {
  const contBtn = page.getByRole('button', { name: 'Continue' });
  await contBtn.first().click({ timeout: 10000 });
  await sleep(5000);
  return page;
}

async function detectMethodChooser(page, tor = false) {
  const timeout = tor ? 60000 : 20000;
  try {
    await page.waitForFunction(
      () => /Choose a way to log in\./i.test(document.body?.innerText || ''),
      { timeout }
    );
    return true;
  } catch {
    return false;
  }
}

async function getMethodOptions(page) {
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const lines = bodyText.split('\n').map(s => s.trim()).filter(Boolean);
  const options = lines.filter(t => /get code or link via|whatsapp/i.test(t));
  return options;
}

async function selectSMSMethod(page) {
  const options = await getMethodOptions(page);
  const smsOption = options.find(t => /get code or link via sms/i.test(t));
  if (smsOption) {
    await page.getByText(smsOption, { exact: true }).first().click({ timeout: 10000 });
    await sleep(2000);
    return true;
  }
  return false;
}

async function selectEmailMethod(page) {
  const options = await getMethodOptions(page);
  const emailOption = options.find(t => /get code or link via email/i.test(t));
  if (emailOption) {
    await page.getByText(emailOption, { exact: true }).first().click({ timeout: 10000 });
    await sleep(2000);
    return true;
  }
  return false;
}

module.exports = {
  navigateToResetPage,
  switchToEmailMode,
  fillUsername,
  clickContinue,
  detectMethodChooser,
  getMethodOptions,
  selectSMSMethod,
  selectEmailMethod
};
