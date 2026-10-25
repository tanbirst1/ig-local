const translator = {
  localeMap: {
    'en-US': {
      nextText: 'Next',
      errorSelectors: [],
      errorPatterns: [/incorrect|didn.*match|try again|expired|invalid|wrong/i]
    },
    'de-DE': {
      nextText: 'Weiter',
      errorSelectors: [],
      errorPatterns: [/falsch|nicht|falscher Code|Verifizierung.*fehlgeschlagen/i]
    },
    'fr-FR': {
      nextText: 'Suivant',
      errorSelectors: [],
      errorPatterns: [/incorrect|mauvais|essayez encore|expiré/i]
    },
    'ja-JP': {
      nextText: '次へ',
      errorSelectors: [],
      errorPatterns: [/間違|失効|再試行|無効/i]
    },
    'pt-BR': {
      nextText: 'Próximo',
      errorSelectors: [],
      errorPatterns: [/incorreto|expirado|tente novamente|inválido/i]
    },
    'en-GB': {
      nextText: 'Next',
      errorSelectors: [],
      errorPatterns: [/incorrect|didn't match|try again|expired|invalid|wrong/i]
    }
  },

  getSelectorMessage(key, locale) {
    const map = this.localeMap[locale] || this.localeMap['en-US'];
    return map[key] || map['en-US'][key];
  },

  async resolveOTPField(page, locale) {
    const map = this.localeMap[locale] || this.localeMap['en-US'];
    const selectors = map.otpSelectors || [
      'input[name="security_code"]',
      'input[autocomplete="one-time-code"]',
      'input[aria-label*="Security Code" i]',
      'input[type="text"]'
    ];

    for (const sel of selectors) {
      const count = await page.locator(sel).count();
      if (count > 0) return sel;
    }
    return null;
  },

  async resolveButton(page, key, locale) {
    const map = this.localeMap[locale] || this.localeMap['en-US'];
    const label = map[key] || this.localeMap['en-US'][key] || key;
    const buttons = await page.getByRole('button', { name: new RegExp(label, 'i') }).all();
    return buttons.length > 0 ? buttons[0] : null;
  },

  async checkLanguageSwitch(page, expectedLocale) {
    const htmlLang = await page.evaluate(() => document.documentElement.getAttribute('lang') || '');
    return htmlLang.includes(expectedLocale) || false;
  }
};

module.exports = { translator };
