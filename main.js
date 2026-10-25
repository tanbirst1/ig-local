'use strict';
const fs = require('fs');
const path = require('path');
const { startTor, rotateCircuit, TOR_SOCKS_PORT } = require('./util/tor');
const { getPublicIp } = require('./util/ip');
const { filterByCountry } = require('./util/ip-filter');
const { runAgents } = require('./parallel/manager');
const { localeForIp } = require('./util/translator');

const args = process.argv.slice(2);
const USER = args.find((a) => !a.startsWith('--')) || 'edix.bm';
const agentArg = args.find((a) => a.startsWith('--agent=') || a.startsWith('--agents='));
const N = parseInt((agentArg || '').split('=')[1] || '3', 10) || 3;

(async () => {
  console.log(`[main] user=${USER} agents=${N}`);
  // 1. Start TOR (background)
  const torProc = startTor();
  await new Promise((r) => setTimeout(r, 8000));
  // 2. Gather N clean IPs via TOR circuit rotation
  const ips = [];
  for (let i = 0; i < N; i++) {
    if (i > 0) await rotateCircuit();
    await new Promise((r) => setTimeout(r, 3000));
    const ip = await getPublicIp(15000);
    if (ip) { ips.push(`socks5://127.0.0.1:${TOR_SOCKS_PORT}`); console.log(`[main] circuit ${i + 1} ip=${ip}`); }
  }
  // 3. Filter by country (TOR exits vary)
  const filtered = await filterByCountry(ips.map((_, i) => ips[i]), { log: true }).catch(() => ips);
  const finalIps = (filtered && filtered.length ? filtered : ips).slice(0, N);
  // 4. Save {N}.txt
  const ipFile = path.join(process.cwd(), `${N}.txt`);
  fs.writeFileSync(ipFile, finalIps.join('\n') + '\n');
  console.log(`[main] wrote ${finalIps.length} ips to ${ipFile}`);
  // 5. Locale/translator
  const loc = await localeForIp();
  console.log(`[main] locale=${loc.locale} lang=${loc.lang} country=${loc.country}`);
  // 6. Deploy subagents
  const agents = runAgents(N, USER, {});
  console.log(`[main] deployed ${agents.length} subagents`);
  // 7. Wait for all to finish
  await Promise.all(agents.map((a) => new Promise((res) => a.on('exit', res))));
  console.log('[main] all subagents finished');
  try { if (torProc) torProc.kill(); } catch {}
  process.exit(0);
})().catch((e) => { console.error('[main] fatal:', e.message || e); process.exit(1); });