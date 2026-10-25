const { OTPLoginRunner } = require('./main');

async function test() {
  console.log('Creating OTPLoginRunner...');
  const runner = new OTPLoginRunner({ username: 'test_user', agents: 2 });
  console.log('Runner created');
  
  console.log('Calling startTor...');
  try {
    const result = await runner.torManager.start();
    console.log('startTor result:', result);
  } catch(e) {
    console.log('startTor error: ' + (e.message || e));
  }
  process.exit(0);
}
test().catch(e => { console.error('MAIN TEST ERROR:', e.stack || e.message); process.exit(1); });
