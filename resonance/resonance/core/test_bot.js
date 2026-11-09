// node core/test_bot.js  -> headless bot runs on every cue map
const fs = require('fs'), R = require('./core.js');
let fail = 0;
for (const w of ['cry-me-a-reverb', 'nueva-anormalidad', 'ganimedes']) {
  const cm = JSON.parse(fs.readFileSync(__dirname + '/../cuemaps/' + w + '.json'));
  for (const tier of ['easy', 'normal', 'elite']) {
    const p = R.simulate(cm, tier, 1, 7), q = R.simulate(cm, tier, 0.7, 7);
    const ok = p.full && q.heardFrac < 1;
    if (!ok) fail++;
    console.log(w.padEnd(18), tier.padEnd(7), 'perfect bot heard', p.heard + '/' + p.phrases, '| 70% bot', q.heard + '/' + q.phrases, 'miss', q.stats.miss, ok ? 'OK' : 'FAIL');
  }
}
console.log(fail ? 'FAIL' : 'PASS'); process.exit(fail ? 1 : 0);
