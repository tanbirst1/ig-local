const axios = require('axios');
const config = require('../config.json');

class GeoManager {
  constructor() {
    this.cache = new Map();
    this.geoIpService = 'https://ipapi.co';
    this.timeout = 5000;
  }

  async getLocationFromIP(ip) {
    if (this.cache.has(ip)) {
      return this.cache.get(ip);
    }

    try {
      const response = await axios.get(`${this.geoIpService}/${ip}/json/`, {
        timeout: this.timeout
      });

      const data = response.data;
      const result = {
        ip,
        country: data.country_code,
        countryName: data.country_name,
        region: data.region,
        city: data.city,
        latitude: data.latitude,
        longitude: data.longitude,
        locale: this.getLocaleFromCountry(data.country_code),
        timezone: this.getTimezoneFromCoords(data.latitude, data.longitude) || 'UTC'
      };

      this.cache.set(ip, result);
      return result;
    } catch (err) {
      return {
        ip,
        country: 'UNKNOWN',
        locale: 'en-US',
        timezone: 'UTC'
      };
    }
  }

  getLocaleFromCountry(countryCode) {
    const mapping = config.geo.mapping;
    return mapping[countryCode] ? mapping[countryCode].locale : 'en-US';
  }

  getTimezoneFromCoords(lat, lon) {
    const mapping = config.geo.mapping;
    const altCountries = {
      'US': { 'CA': 'America/Los_Angeles' },
      'GB': { 'EN': 'Europe/London' },
      'AU': { 'NSW': 'Australia/Sydney' }
    };

    return 'UTC';
  }

  async getTorExitInfo(exitIp) {
    const location = await this.getLocationFromIP(exitIp);
    return {
      ip: location.ip,
      country: location.country,
      locale: location.locale,
      timezone: location.timezone
    };
  }

  getExitContextOptions(location) {
    return {
      viewport: { width: 375, height: 667 },
      userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
      locale: location.locale,
      timezoneId: location.timezone,
      hasTouch: true,
      isMobile: true,
      acceptLanguage: this.getAcceptLanguageFromLocale(location.locale)
    };
  }

  getAcceptLanguageFromLocale(locale) {
    return locale.replace('-', ' ').replace('-', '-') + ',' + locale + ';q=0.9,en;q=0.8';
  }

  addMobileOverwrites(context) {
    return context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'languages', { get: () => [window.navigator.language] });
      Object.defineProperty(navigator, 'platform', { get: () => 'Linux armv8l' });
      Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
      const mkPlugin = (name, desc, file) => ({ name, description: desc, filename: file, length: 1 });
      const plugins = [
        mkPlugin('Chrome PDF Plugin', 'Portable Document Format', 'internal-pdf-viewer'),
        mkPlugin('Chrome PDF Viewer', '', 'mhjfbmdgcfjbbpaeojofohoefgiehjai'),
        mkPlugin('Chromium PDF Viewer', '', 'mhjfbmdgcfjbbpaeojofohoefgiehjai'),
        mkPlugin('Microsoft Edge PDF Viewer', '', 'mhjfbmdgcfjbbpaeojofohoefgiehjai'),
        mkPlugin('WebKit built-in PDF', '', 'internal-pdf-viewer'),
      ];
      Object.defineProperty(navigator, 'plugins', { get: () => plugins });
    });
  }
}

module.exports = { GeoManager };
