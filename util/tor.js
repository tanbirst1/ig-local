'use strict';
const { execSync, spawn } = require('child_process');
const fs = require('fs');

const TOR_BIN = process.env.TOR_BIN || '/usr/bin/tor';
const TOR_CONTROL_PORT = parseInt(process.env.TOR_CONTROL_PORT || '9051', 10);
const TOR_SOCKS_PORT = parseInt(process.env.TOR_SOCKS_PORT || '9050', 10);
const TOR_DATA_DIR = process.env.TOR_DATA_DIR || '/tmp/kilo/tor-data';

function torInstalled() {
  try { execSync(`${TOR_BIN} --version`, { stdio: 'ignore' }); return true; } catch { return false; }
}

function controlPortCmd(cmd) {
  // Minimal Tor control protocol via socket
  const net = require('net');
  return new Promise((resolve, reject) => {
    const s = net.createConnection(TOR_CONTROL_PORT, '127.0.0.1', () => {
      s.write('AUTHENTICATE\r\n');
      s.write(cmd + '\r\n');
      s.write('QUIT\r\n');
    });
    let buf = '';
    s.on('data', (d) => { buf += d.toString(); });
    s.on('end', () => resolve(buf));
    s.on('error', reject);
    setTimeout(() => { try { s.destroy(); } catch {} reject(new Error('tor control timeout')); }, 10000);
  });
}

async function rotateCircuit() {
  try {
    const r = await controlPortCmd('SIGNAL NEWNYM');
    return /250 OK/.test(r);
  } catch { return false; }
}

function startTor(opts) {
  const o = opts || {};
  if (!torInstalled()) {
    console.log('[tor] tor binary not found, skipping start');
    return null;
  }
  try { fs.mkdirSync(TOR_DATA_DIR, { recursive: true }); } catch {}
  const args = ['--SocksPort', String(TOR_SOCKS_PORT), '--ControlPort', String(TOR_CONTROL_PORT), '--DataDirectory', TOR_DATA_DIR, '--CookieAuthentication', '0', '--HashedControlPassword', '', '--AllowUnverifiedNodes', 'middle,rendezvous'];
  const proc = spawn(TOR_BIN, args, { detached: true, stdio: 'ignore' });
  proc.unref();
  console.log('[tor] started socks=' + TOR_SOCKS_PORT + ' control=' + TOR_CONTROL_PORT);
  return proc;
}

function stopTor(proc) {
  if (proc && !proc.killed) { try { proc.kill(); } catch {} }
}

module.exports = { torInstalled, startTor, stopTor, rotateCircuit, TOR_SOCKS_PORT, TOR_CONTROL_PORT };