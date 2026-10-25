const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function jitteredDelay(baseMs, maxMs, jitter = 0.3) {
  const delay = baseMs + Math.random() * baseMs * jitter;
  return Math.min(delay, maxMs);
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

module.exports = {
  sleep,
  jitteredDelay,
  randomDelay
};
