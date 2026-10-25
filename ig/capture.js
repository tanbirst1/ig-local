'use strict';
const fs = require('fs');

async function captureSession(ctx, username) {
  const jar = await ctx.cookies();
  const { buildSessionSettings } = require('../auto_reset');
  const built = buildSessionSettings(jar.map((c) => ({ name: c.name, value: c.value })));
  if (built.error) return { error: built.error, missing: built.missing };
  const { saveSession } = require('./session');
  saveSession(username, built.settings);
  return { ok: true, ds_user_id: jar.find((c) => c.name === 'ds_user_id')?.value };
}

function saveArtifact(name, data) {
  try { fs.writeFileSync(name, typeof data === 'string' ? data : JSON.stringify(data, null, 2)); } catch {}
}

module.exports = { captureSession, saveArtifact };