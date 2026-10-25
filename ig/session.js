const fs = require('fs');
const path = require('path');

const SESSION_DIR = '/workspace/app/sessions';

class SessionManager {
  constructor() {
    this.sessionDir = SESSION_DIR;
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  async save(context, username) {
    const data = await context.storageState();
    const filePath = path.join(this.sessionDir, `${username}_${Date.now()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return filePath;
  }

  async load(context, filePath) {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return context.storageState(data);
    }
    return context.newContext();
  }

  async getSessionFile(username) {
    const files = fs.readdirSync(this.sessionDir)
      .filter(f => f.startsWith(username + '_') && f.endsWith('.json'))
      .sort();
    return files.length > 0 ? files[0] : null;
  }

  cleanupOldSessions(maxAgeDays = 30) {
    const now = Date.now();
    const files = fs.readdirSync(this.sessionDir)
      .filter(f => f.endsWith('.json'));

    for (const f of files) {
      const filePath = path.join(this.sessionDir, f);
      const stat = fs.statSync(filePath);
      const age = now - stat.mtimeMs;
      if (age > maxAgeDays * 24 * 60 * 60 * 1000) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }
  }
}

module.exports = { SessionManager };
