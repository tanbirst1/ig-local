const { TorManager } = require('./util/tor');
const { IPFilter } = require('./util/ipFilter');
const { GeoManager } = require('./util/geo');
const { BrowserPool } = require('./parallel/pool');
const { SubagentManager } = require('./parallel/manager');
const { BlockClassifier } = require('./fallback/classifier');
const { BlockHandler } = require('./fallback/block');
const { WorkerRestart } = require('./fallback/restart');
const { translator } = require('./translator');
const { CaptureManager } = require('./ig/capture');
const { SessionManager } = require('./ig/session');
const { navigateToResetPage, fillUsername, detectMethodChooser } = require('./ig/nav');
const { findOTPField, submitOTP, detectOTPError } = require('./ig/otp');

async function test() {
  console.log('1. Creating TorManager...');
  try {
    const tor = new TorManager();
    console.log('   TorManager created');
  } catch(e) {
    console.log('   Error:', e.message || e);
  }

  console.log('2. Creating IPFilter...');
  try {
    const ipFilter = new IPFilter();
    console.log('   IPFilter created');
  } catch(e) {
    console.log('   Error:', e.message || e);
  }

  console.log('3. Creating GeoManager...');
  try {
    const geo = new GeoManager();
    console.log('   GeoManager created');
  } catch(e) {
    console.log('   Error:', e.message || e);
  }

  console.log('4. Creating BrowserPool...');
  try {
    const pool = new BrowserPool({ maxContexts: 3 });
    console.log('   BrowserPool created');
    // Don't call init() - it needs chromium
  } catch(e) {
    console.log('   Error:', e.message || e);
  }

  console.log('5. Creating SubagentManager...');
  try {
    const subagent = new SubagentManager({ username: 'test', workerCount: 2 });
    console.log('   SubagentManager created');
  } catch(e) {
    console.log('   Error:', e.message || e);
  }

  console.log('6. Creating BlockClassifier...');
  try {
    const classifier = new BlockClassifier();
    console.log('   BlockClassifier created');
  } catch(e) {
    console.log('   Error:', e.message || e);
  }

  console.log('7. Creating BlockHandler...');
  try {
    const handler = new BlockHandler();
    console.log('   BlockHandler created');
  } catch(e) {
    console.log('   Error:', e.message || e);
  }

  console.log('8. Creating WorkerRestart...');
  try {
    const restart = new WorkerRestart();
    console.log('   WorkerRestart created');
  } catch(e) {
    console.log('   Error:', e.message || e);
  }

  console.log('9. Testing translator...');
  try {
    console.log('   translator:', typeof translator);
  } catch(e) {
    console.log('   Error:', e.message || e);
  }

  console.log('10. Creating CaptureManager...');
  try {
    const capture = new CaptureManager();
    console.log('   CaptureManager created');
  } catch(e) {
    console.log('   Error:', e.message || e);
  }

  console.log('11. Creating SessionManager...');
  try {
    const session = new SessionManager();
    console.log('   SessionManager created');
  } catch(e) {
    console.log('   Error:', e.message || e);
  }

  console.log('All components created successfully!');
  process.exit(0);
}
test().catch(e => { console.error('TRACE ERROR:', e.stack || e.message); process.exit(1); });
