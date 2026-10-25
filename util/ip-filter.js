'use strict';
const { fetchUrl } = require('./ip');

const BLOCKED_COUNTRIES = new Set((process.env.BLOCKED_COUNTRIES || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
const ALLOWED_COUNTRIES = new Set((process.env.ALLOWED_COUNTRIES || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));

/**
 * Filter a list of proxy/IP entries by country using ipinfo.io.
 * Returns clean list of {ip, meta, ok}.
 */
async function filterByCountry(ips, opts) {
  const o = opts || {};
  const out = [];
  for (const ip of ips) {
    const meta = await (async () => {
      try {
        const raw = await fetchUrl(`https://ipinfo.io/${ip}/json`, 10000);
        return JSON.parse(raw);
      } catch { return null; }
    })();
    const cc = String((meta && meta.country) || '').toUpperCase();
    let ok = true;
    if (ALLOWED_COUNTRIES.size && !ALLOWED_COUNTRIES.has(cc)) ok = false;
    if (BLOCKED_COUNTRIES.size && BLOCKED_COUNTRIES.has(cc)) ok = false;
    if (!meta) ok = false;
    out.push({ ip, meta, ok });
    if (o.log) console.log(`[ip-filter] ${ip} country=${cc || '?'} ${ok ? 'KEEP' : 'DROP'}`);
  }
  return out.filter((x) => x.ok);
}

function isBlockedCountry(cc) {
  const c = String(cc || '').toUpperCase();
  if (BLOCKED_COUNTRIES.size && BLOCKED_COUNTRIES.has(c)) return true;
  if (ALLOWED_COUNTRIES.size && !ALLOWED_COUNTRIES.has(c)) return true;
  return false;
}

module.exports = { filterByCountry, isBlockedCountry, BLOCKED_COUNTRIES, ALLOWED_COUNTRIES };