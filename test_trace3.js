const { OTPLoginRunner } = require('./main');

async function test() {
  console.log('Creating OTPLoginRunner...');
  const runner = new OTPLoginRunner({ username: 'test_user', agents: 2 });
  console.log('Runner created');
  
  console.log('Calling startTor...');
  try {
    const result = await runner.startTor();
    console.log('startTor result:', JSON.stringify(result));
  } catch(e) {
    console.log('startTor caught error:');
    console.log('  e:', e);
    console.log('  e.message:', e.message);
    console.log('  typeof e:', typeof e);
    console.log('  e.constructor.name:', e.constructor.name);
  }
  
  console.log('Calling run()...');
  try {
    await runner.run();
  } catch(e) {
    console.log('run() caught error:');
    console.log('  e:', e);
    console.log('  e.message:', e.message);
    console.log('  typeof e:', typeof e);
  }
  
  process.exit(0);
}
test().catch(e => { console.error('UNCAUGHT:', e); process.exit(1); });
