// Simulate exactly what main.js does
const { TorManager } = require('./util/tor');

async function test() {
  const tor = new TorManager();
  console.log('Calling start...');
  try {
    const result = await tor.start();
    console.log('Result:', JSON.stringify(result));
  } catch(e) {
    console.log('Caught error:');
    console.log('  type:', typeof e);
    console.log('  constructor name:', e.constructor ? e.constructor.name : 'null');
    console.log('  value:', e);
  }
  process.exit(0);
}
test().catch(e => { console.error('UNCAUGHT:', e); process.exit(1); });
