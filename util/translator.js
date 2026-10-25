'use strict';
const { resolveLocaleFromIp } = require('./ip');

// Built-in translator: uses Google Translate free endpoint (best-effort).
// Falls back to original text on failure.
async function translate(text, targetLang) {
  if (!text || !targetLang || targetLang.startsWith('en')) return text;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const json = await res.json();
    return (json && json[0] && json[0].map((x) => x[0]).join('')) || text;
  } catch { return text; }
}

async function localeForIp() {
  const loc = await resolveLocaleFromIp();
  if (!loc || !loc.locale) return { locale: 'en_US', lang: 'en' };
  const lang = String(loc.locale).split('_')[0];
  return { locale: loc.locale, lang, country: loc.country };
}

module.exports = { translate, localeForIp };