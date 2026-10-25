'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function runAgents(n, username, opts) {
  const o = opts || {};
  const agents = [];
  const ipFile = path.join(process.cwd(), `${n}.txt`);
  let ips = [];
  try { ips = fs.readFileSync(ipFile, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean); } catch {}
  for (let i = 0; i < n; i++) {
    const ip = ips[i] || null;
    const args = [path.join(process.cwd(), 'auto_reset.js'), username, '--method=auto'];
    if (ip) args.push(`--proxy=${ip}`);
    const child = spawn(process.execPath, args, { stdio: 'inherit', env: { ...process.env, AGENT_ID: String(i + 1) } });
    agents.push(child);
  }
  try { fs.unlinkSync(ipFile); } catch {}
  return agents;
}

module.exports = { runAgents };