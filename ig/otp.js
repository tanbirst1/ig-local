const translator = require('../translator');

const OTP_SELECTORS = [
  'input[name="security_code"]',
  'input[autocomplete="one-time-code"]',
  'input[aria-label*="Security Code" i]',
  'input[aria-label*="verification" i]',
  'input[type="text"]',
  'input[type="tel"]',
  'input[type="number"]'
];

async function findOTPField(page) {
  for (const selector of OTP_SELECTORS) {
    try {
      const count = await page.locator(selector).count();
      if (count > 0) {
        const field = page.locator(selector).first();
        await field.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
        return field;
      }
    } catch {}
  }

  try {
    const textbox = page.getByRole('textbox');
    if ((await textbox.count()) > 0) {
      return textbox.first();
    }
  } catch {}

  return null;
}

async function fillOTP(page, code) {
  const field = await findOTPField(page);
  if (!field) {
    throw new Error('OTP field not found');
  }

  await field.fill('');
  for (const ch of code) {
    await field.pressSequentially(ch, { delay: 100 });
  }
  await sleep(500);
  return field;
}

async function submitOTP(page, locale) {
  const localeMap = translator.localeMap[locale] || translator.localeMap['en-US'];

  const nextSelectors = [
    'button[type="submit"]',
    'button:has-text("Next")',
    'button:has-text("' + (localeMap.nextText || 'Weiter') + '")',
    ...localeMap.nextSelectors
  ];

  for (const sel of nextSelectors) {
    try {
      const btn = page.locator(sel).first();
      if ((await btn.count()) > 0 && await btn.isVisible().catch(() => false)) {
        await btn.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
        await btn.click({ timeout: 10000 });
        return true;
      }
    } catch {}
  }

  const nextByText = page.getByRole('button', { name: new RegExp(localeMap.nextText || 'Next', 'i') });
  if ((await nextByText.count()) > 0) {
    await nextByText.first().click({ timeout: 10000 });
    return true;
  }

  return false;
}

async function waitForOTPPrompt(page, timeout = 15000) {
  const deadline = Date.now() + timeout;
  try {
    const field = await findOTPField(page);
    if (field) return field;
  } catch {}

  while (Date.now() < deadline) {
    await page.waitForTimeout(500);
    const field = await findOTPField(page).catch(() => null);
    if (field) return field;
  }
  return null;
}

async function detectOTPError(page, locale) {
  const localeMap = translator.localeMap[locale] || translator.localeMap['en-US'];
  const errorSelectors = localeMap.errorSelectors || [];

  for (const sel of errorSelectors) {
    try {
      const el = page.locator(sel);
      if ((await el.count()) > 0) {
        const text = await el.first().innerText();
        if (text) return text.trim();
      }
    } catch {}
  }

  const bodyText = await page.locator('body').innerText().catch(() => '');
  const errorPatterns = localeMap.errorPatterns || [/incorrect|didn.*match|try again|expired|invalid|wrong/i];
  for (const pat of errorPatterns) {
    if (pat.test(bodyText)) {
      return bodyText.match(pat)[0];
    }
  }

  return null;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = {
  findOTPField,
  fillOTP,
  submitOTP,
  waitForOTPPrompt,
  detectOTPError
};
