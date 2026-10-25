const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const config = require('../config.json');

class TorManager {
  constructor(options = {}) {
    this.config = { ...config.tor, ...options };
    this.process = null;
    this.controlPort = this.config.controlPort;
    this.socksPort = this.config.socksPort;
    this.running = false;
  }

  async start() {
    if (this.running && this.process) {
      return { success: true, message: 'Tor already running' };
    }

    const args = [
      '--SocksPort', String(this.socksPort),
      '--ControlPort', String(this.controlPort),
      '--CookieAuthentication', '1',
      '--DataDirectory', '/tmp/tor-data',
      '--RunAsDaemon', '0'
    ];

    return new Promise((resolve, reject) => {
      this.process = spawn(this.config.binary, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.process.stdout.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg.includes('Bootstrapped 100%') || msg.includes('Done')) {
          this.running = true;
          resolve({ success: true, message: 'Tor started' });
        }
      });

      this.process.stderr.on('data', (data) => {
        console.log('[TOR]', data.toString().trim());
      });

      this.process.on('error', (err) => {
        reject({ success: false, error: err.message });
      });

      this.process.on('exit', (code) => {
        this.running = false;
        if (this.config.restartOnExit && code !== 0) {
          console.log('[TOR] Process exited, restarting...');
          setTimeout(() => this.start(), 5000);
        }
      });

      setTimeout(() => {
        if (!this.running) {
          reject({ success: false, error: 'Tor startup timeout' });
        }
      }, 60000);
    });
  }

  async stop() {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
      this.running = false;
    }
  }

  async newNym() {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.controlPort, '127.0.0.1', () => {
        socket.write('AUTHENTICATE ""\r\n');
      });

      let buffer = '';
      socket.on('data', (data) => {
        buffer += data.toString();
        if (buffer.includes('250 OK')) {
          if (!buffer.includes('SIGNAL')) {
            socket.write('SIGNAL NEWNYM\r\n');
          } else {
            socket.end();
            setTimeout(() => resolve({ success: true }), this.config.newNymCircuitWaitSeconds * 1000);
          }
        } else if (buffer.includes('515')) {
          socket.end();
          reject({ success: false, error: 'Authentication failed' });
        }
      });

      socket.on('error', (err) => reject({ success: false, error: err.message }));
      socket.setTimeout(30000, () => {
        socket.destroy();
        reject({ success: false, error: 'Control port timeout' });
      });
    });
  }

  async getCurrentExitIp() {
    return new Promise((resolve) => {
      const socket = net.createConnection(this.controlPort, '127.0.0.1', () => {
        socket.write('AUTHENTICATE ""\r\n');
      });

      let buffer = '';
      socket.on('data', (data) => {
        buffer += data.toString();
        if (buffer.includes('250+exit-address')) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.includes('exit-address')) {
              const ip = line.split(' ')[1];
              if (ip) {
                socket.end();
                return resolve(ip);
              }
            }
          }
        }
      });

      socket.on('error', () => resolve(null));
      socket.setTimeout(10000, () => {
        socket.destroy();
        resolve(null);
      });
    });
  }

  getSocksProxy() {
    return `socks5://127.0.0.1:${this.socksPort}`;
  }

  isRunning() {
    return this.running;
  }
}

module.exports = { TorManager };
