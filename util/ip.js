'use strict';

/**
 * util/ip.js — IP detection, leak check, country/locale detection
 * Used by: main.js (baseline), subagents (egress verify), ip filter
 */
const https = require('https');
const http = require('http');

const IPIFY_URL = process.env.IPIFY_URL || 'https://api.ipify.org?format=text';
const IPINFO_URL = process.env.IPINFO_URL || 'https://ipinfo.io/json';

function fetchUrl(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    try {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.get(url, { timeout: timeoutMs }, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { data += c; if (data.length > 500000) req.destroy(); });
        res.on('end', () => resolve(data));
      });
      req.on('timeout', () => { req.destroy(new Error('timeout')); });
      req.on('error', reject);
    } catch (e) { reject(e); }
  });
}

/**
 * Fetch current public IP as plain text.
 * @returns {string|null}
 */
async function getPublicIp(timeoutMs = 15000) {
  try {
    return (await fetchUrl(IPIFY_URL, timeoutMs)).trim();
  } catch { return null; }
}

/**
 * Fetch IP metadata (country, locale, city, org).
 * @returns {object|null}
 */
async function getIpInfo(timeoutMs = 15000) {
  try {
    const raw = await fetchUrl(IPINFO_URL + '?token=' + (process.env.IPINFO_TOKEN || ''), timeoutMs);
    return JSON.parse(raw);
  } catch { return null; }
}

/**
 * Resolve a best-effort locale from IP metadata.
 * Returns { locale, country, country_code, timezone } or null.
 */
async function resolveLocaleFromIp(timeoutMs = 15000) {
  const info = await getIpInfo(timeoutMs);
  if (!info) return null;
  const cc = String(info.country || '').toUpperCase();
  const locale = info.country ? (info.countryCode ? String(info.countryCode).toUpperCase() : cc) : null;
  // Map common country codes to IG-friendly locale strings
  const localeByCc = {
    US: 'en_US', GB: 'en_US', CA: 'en_US', AU: 'en_US',
    IN: 'en_IN', DE: 'de_DE', FR: 'fr_FR', ES: 'es_ES',
    IT: 'it_IT', NL: 'nl_NL', BR: 'pt_BR', MX: 'es_MX',
    JP: 'ja_JP', KR: 'ko_KR', CN: 'zh_CN', RU: 'ru_RU',
    TR: 'tr_TR', UA: 'uk_UA', PL: 'pl_PL', SE: 'sv_SE',
    NO: 'sv_SE', DK: 'da_DK', FI: 'fi_FI', BE: 'nl_NL',
    AT: 'de_DE', CH: 'de_DE', PT: 'pt_PT', GR: 'el_GR',
    ZA: 'en_US', AR: 'es_AR', CL: 'es_CL', CO: 'es_CO',
    PE: 'es_PE', EG: 'ar_EG', SA: 'ar_SA', AE: 'ar_AE',
    ID: 'id_ID', PH: 'en_PH', TH: 'th_TH', VN: 'vi_VN',
    HK: 'zh_TW', TW: 'zh_TW', SG: 'en_SG', MY: 'en_MY',
    NZ: 'en_US', IE: 'en_US', CH: 'de_DE',
  };
  const mapped = localeByCc[cc] || (cc ? cc + '_' + cc : null);
  return {
    locale: mapped,
    country: info.country || null,
    country_code: info.countryCode ? String(info.countryCode).toUpperCase() : null,
    city: info.city || null,
    org: info.org || null,
    timezone: info.timezone || null,
  };
}

/**
 * Leak check: compare egress IP against a known direct baseline.
 * @returns {{leak:boolean, egress:string|null, direct:string|null}}
 */
function checkLeak(egress, direct) {
  if (!egress) return { leak: false, egress: null, direct: direct || null, inconclusive: true };
  if (direct && egress === direct) return { leak: true, egress, direct, inconclusive: false };
  return { leak: false, egress, direct: direct || null, inconclusive: false };
}

function maskIp(ip) {
  if (!ip) return '***';
  // IPv4: mask last octet. IPv6: mask last 4 groups.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.replace(/\.\d+$/, '.x.x');
  if (ip.includes(':')) return ip.replace(/:[0-9a-fA-F]{1,4}(:[0-9a-fA-F]{1,4}){0,3}$/, ':****');
  return '***';
}

module.exports = { fetchUrl, getPublicIp, getIpInfo, resolveLocaleFromIp, checkLeak, maskIp };