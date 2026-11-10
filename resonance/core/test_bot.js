// node core/test_bot.js  -> headless bot runs on every cue map
const fs = require('fs'), R = require('./core.js');
let fail = 0;
for (const w of ['cry-me-a-reverb', 'nueva-anormalidad', 'ganimedes']) {
  const cm = JSON.parse(fs.readFileSync(__dirname + '/../cuemaps/' + w + '.json'));
  for (const tier of ['easy', 'normal', 'elite']) {
    const p = R.simulate(cm, tier, 1, 7), q = R.simulate(cm, tier, 0.5, 7);
    const ok = p.full && q.heardFrac < 1;
    if (!ok) fail++;
    // landing accuracy at random frame rates (30..144 fps): landing frame must be the first frame at/after the downbeat
    let seed = 99; const rdt = () => { seed = (seed * 16807) % 2147483647; return 1 / (30 + (seed % 115)); };
    const v = R.simulate(cm, tier, 1, 7, rdt), fl = v.flights - v.outro;
    const lok = v.landings.length === fl && v.landings.every(e => e >= -1e-9 && e < 1 / 30 + 1e-9);
    if (!lok) { fail++; console.log('  LANDING FAIL', fl, v.landings); }
    console.log('  flights', v.flights, '(outro', v.outro + ')', 'landings', v.landings.length, 'max err ms', Math.round(1000 * Math.max(0, ...v.landings)), 'dust', v.stats.dust, lok ? 'OK' : 'FAIL');
    console.log(w.padEnd(18), tier.padEnd(7), 'perfect bot heard', p.heard + '/' + p.phrases, '| 50% bot', q.heard + '/' + q.phrases, 'miss', q.stats.miss, ok ? 'OK' : 'FAIL');
  }
}
console.log(fail ? 'FAIL' : 'PASS'); process.exit(fail ? 1 : 0);
