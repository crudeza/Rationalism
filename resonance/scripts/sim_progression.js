// node scripts/sim_progression.js
// Validates the Game Sheet §8 tuning target: "an average player reaches Full Resonance on a song in a handful
// of runs." Simulates repeated attempts with a fixed-skill headless bot (core.js's makeBot) that spends the
// Energy it earns on upgrades (progression.js) between runs, and reports how many runs each song takes.
const fs = require('fs'), path = require('path');
const R = require('../core/core.js'), P = require('../core/progression.js');

const WORLDS = P.WORLDS;
const cuemaps = {};
for (const w of WORLDS) cuemaps[w] = JSON.parse(fs.readFileSync(path.join(__dirname, '../cuemaps/' + w + '.json')));

// Buy whichever upgrade is cheapest to level up right now (round-robins across all five by cost, not by type).
function spendAll(save) {
  let bought = 0;
  for (; ;) {
    let best = null, bestCost = Infinity;
    for (const key of Object.keys(P.UPGRADES)) {
      if (!P.canAfford(save, key)) continue;
      const c = P.upgradeCost(save.upgrades[key]);
      if (c < bestCost) { bestCost = c; best = key; }
    }
    if (!best) break;
    P.buyUpgrade(save, best); bought++;
  }
  return bought;
}

function runSong(save, world, tier, skill, seed) {
  const cm = cuemaps[world], opt = P.cfgFromSave(save);
  const r = R.simulate(cm, tier, skill, seed, null, opt);
  const rep = P.applyRunResult(save, world, r, null);
  return { r, rep };
}

function simulatePlayer(tier, skill, label) {
  const save = P.defaultSave();
  let seed = 1, totalRuns = 0;
  const report = [];
  for (const world of WORLDS) {
    if (!save.songs[world].unlocked) { report.push({ world, locked: true }); continue; }
    let runs = 0, got = false, energyIn = 0, upgradesAtStart = JSON.stringify(save.upgrades);
    while (runs < 60 && !got) {
      runs++; totalRuns++; seed = (seed * 48271) % 2147483647;
      const { r, rep } = runSong(save, world, tier, skill, seed || 1);
      energyIn += rep.earned;
      spendAll(save);
      if (r.full) got = true;
    }
    report.push({ world, runs, got, energyIn, finalUpgrades: Object.assign({}, save.upgrades), energyLeft: save.energy, startedWith: upgradesAtStart });
  }
  return { label, tier, skill, totalRuns, report, finalSave: save };
}

const PROFILES = [
  { label: 'skilled', skill: 0.97 },
  { label: 'average', skill: 0.75 },
  { label: 'rough', skill: 0.55 },
  { label: 'struggling', skill: 0.35 } // robustness check only: not the tuning target, just must not get stuck forever
];
const TIERS = ['easy', 'normal', 'elite'];
const HANDFUL = 12; // [TUNE] gate: "a handful of runs" (Game Sheet §8), excluding the 'struggling' robustness profile

let worst = 0, worstTuned = 0, stuck = 0;
for (const tier of TIERS) {
  console.log('\n=== tier', tier, '===');
  for (const prof of PROFILES) {
    const res = simulatePlayer(tier, prof.skill, prof.label);
    console.log(` ${prof.label.padEnd(10)} skill=${prof.skill}`);
    for (const row of res.report) {
      if (row.locked) { console.log('   ', row.world.padEnd(20), 'LOCKED (previous song not Full yet)'); continue; }
      worst = Math.max(worst, row.got ? row.runs : Infinity);
      if (prof.label !== 'struggling') worstTuned = Math.max(worstTuned, row.got ? row.runs : Infinity);
      if (!row.got) stuck++;
      console.log('   ', row.world.padEnd(20), row.got ? ('Full in ' + row.runs + ' run(s)') : ('NOT FULL after ' + row.runs + ' runs - STUCK'),
        '| upgrades now', JSON.stringify(row.finalUpgrades), '| energy left', row.energyLeft);
    }
  }
}
console.log('\nworst-case runs-to-Full (skilled/average/rough):', worstTuned, worstTuned <= HANDFUL ? 'OK - within "a handful"' : 'FAIL - too grindy, retune upgradeCost / bonuses');
// 'struggling' (skill 0.35) is a robustness note only, not the tuning target: a very low-skill player maxing
// every upgrade and still not reaching Full on a song is an acceptable difficulty floor, not a bug.
console.log('struggling-profile songs still not Full at max upgrades (informational only):', stuck);
const fail = worstTuned > HANDFUL;
console.log(fail ? 'FAIL' : 'PASS');
process.exit(fail ? 1 : 0);
