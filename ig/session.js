'use strict';
const fs = require('fs');
const path = require('path');

const SESSION_DIR = process.env.SESSION_DIR || path.join(process.cwd(), 'sessions');

function sessionPath(username) {
  try { fs.mkdirSync(SESSION_DIR, { recursive: true }); } catch {}
  return path.join(SESSION_DIR, `${username}.json`);
}

function saveSession(username, settings) {
  const p = sessionPath(username);
  fs.writeFileSync(p, JSON.stringify(settings, null, 2), { mode: 0o600 });
  console.log(`[ig/session] saved ${p}`);
  return p;
}

function loadSession(username) {
  try { return JSON.parse(fs.readFileSync(sessionPath(username), 'utf8')); } catch { return null; }
}

function hasSession(username) {
  try { fs.accessSync(sessionPath(username)); return true; } catch { return false; }
}

function deleteSession(username) {
  try { fs.unlinkSync(sessionPath(username)); } catch {}
}

module.exports = { sessionPath, saveSession, loadSession, hasSession, deleteSession, SESSION_DIR };