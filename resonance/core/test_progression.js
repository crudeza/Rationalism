// node core/test_progression.js
const P = require('./progression.js');
let fail = 0;
const ok = (cond, label) => { if (!cond) { fail++; console.log('FAIL:', label); } else console.log('ok:', label); };

// 1. default save matches schema v1 (04_TECH_SPEC.md) and starts with world 0 unlocked, GEMINI owned/equipped
{
  const s = P.defaultSave();
  ok(s.v === 1, 'default save v=1');
  ok(s.songs[P.WORLDS[0]].unlocked && !s.songs[P.WORLDS[1]].unlocked && !s.songs[P.WORLDS[2]].unlocked, 'only world 0 starts unlocked');
  ok(P.SLOTS.every(sl => s.parts.equipped[sl] === 'gemini:' + sl), 'every slot starts equipped with gemini');
  ok(P.SLOTS.every(sl => s.parts.owned.includes('gemini:' + sl)), 'every gemini part starts owned');
  ok(s.parts.owned.length === P.SLOTS.length, 'nothing else owned yet');
}

// 2. export/import round-trips exactly, and rejects garbage
{
  const s = P.defaultSave(); s.energy = 123; s.upgrades.span = 2;
  const code = P.exportCode(s), back = P.importCode(code);
  ok(back && back.energy === 123 && back.upgrades.span === 2, 'export/import round-trip');
  ok(P.importCode('not-a-real-code') === null, 'garbage import code is rejected, not thrown');
}

// 3. migrate() fills in a song/upgrade a save predates, without touching what is already there
{
  const old = { v: 1, energy: 50, upgrades: { span: 3 }, parts: { owned: ['gemini:HULL'], equipped: { HULL: 'gemini:HULL' } }, songs: { 'cry-me-a-reverb': { unlocked: true, bestHeard: 0.5, full: false, pure: false, ghost: null } } };
  const m = P.migrate(JSON.parse(JSON.stringify(old)));
  ok(m.upgrades.span === 3 && m.upgrades.gain === 0, 'migrate keeps existing levels and adds missing ones at 0');
  ok(m.songs['ganimedes'] && m.songs['ganimedes'].unlocked === false, 'migrate adds a song the old save never had, locked');
  ok(m.energy === 50, 'migrate preserves energy');
}

// 4. buyUpgrade: spends exactly the listed cost, refuses when short, caps at MAX_LEVEL
{
  const s = P.defaultSave(); s.energy = P.upgradeCost(0) - 1;
  ok(P.buyUpgrade(s, 'span') === false, 'buyUpgrade refuses when energy is short');
  s.energy = P.upgradeCost(0);
  ok(P.buyUpgrade(s, 'span') === true && s.upgrades.span === 1 && s.energy === 0, 'buyUpgrade spends exactly the cost and levels up');
  s.upgrades.span = P.MAX_LEVEL;
  ok(P.buyUpgrade(s, 'span') === false, 'buyUpgrade refuses past MAX_LEVEL');
  ok(P.buyUpgrade(s, 'not-a-real-upgrade') === false, 'buyUpgrade refuses an unknown key');
}

// 5. applyRunResult: energy award, unlock chain, cosmetic reward, best-score tracking
{
  const s = P.defaultSave();
  const r1 = { heardFrac: 1, heard: 10, phrases: 10, full: true, pure: true, shieldsUsed: 0, energy: 100, stats: {} };
  const rep1 = P.applyRunResult(s, P.WORLDS[0], r1, [[0, 0], [1, 0.5]]);
  ok(rep1.earned === 100 + P.FULL_BONUS + P.PURE_BONUS, 'Full + Pure award the flat bonuses on top of the raw energy');
  ok(s.songs[P.WORLDS[0]].full && s.songs[P.WORLDS[0]].pure, 'song marked full and pure');
  ok(s.songs[P.WORLDS[1]].unlocked === true, 'Full Resonance unlocks the next song');
  ok(rep1.unlocks.some(u => u.type === 'song' && u.world === P.WORLDS[1]), 'unlock report names the newly unlocked song');
  ok(rep1.unlocks.some(u => u.type === 'ship' && u.ship === 'halo'), 'Full on world 0 grants the halo part set (PROPOSED reward schedule)');
  ok(P.SLOTS.every(sl => s.parts.owned.includes('halo:' + sl)), 'every halo part is now owned');
  ok(JSON.stringify(s.songs[P.WORLDS[0]].ghost) === JSON.stringify([[0, 0], [1, 0.5]]), 'ghost stored on an improved best run');

  // a worse run afterwards must not overwrite the ghost or best score
  const r2 = { heardFrac: 0.4, heard: 4, phrases: 10, full: false, pure: false, shieldsUsed: 0, energy: 40, stats: {} };
  const rep2 = P.applyRunResult(s, P.WORLDS[0], r2, [[0, 0.9]]);
  ok(rep2.improved === false, 'a worse run is not reported as an improvement');
  ok(JSON.stringify(s.songs[P.WORLDS[0]].ghost) === JSON.stringify([[0, 0], [1, 0.5]]), 'a worse run does not overwrite the ghost');

  // repeating the reward does not duplicate owned parts or re-fire the unlock message
  const rep3 = P.applyRunResult(s, P.WORLDS[0], r1, null);
  ok(rep3.unlocks.length === 0, 'repeating Full on an already-unlocked/rewarded world fires no further unlocks');
  ok(s.parts.owned.filter(p => p === 'halo:HULL').length === 1, 'halo:HULL is not duplicated in owned[]');
}

// 6. equipPart only allows equipping an owned part into a real slot
{
  const s = P.defaultSave();
  ok(P.equipPart(s, 'HULL', 'halo') === false, 'cannot equip a part that is not owned');
  s.parts.owned.push('halo:HULL');
  ok(P.equipPart(s, 'HULL', 'halo') === true && s.parts.equipped.HULL === 'halo:HULL', 'equipping an owned part works');
  ok(P.equipPart(s, 'NOT_A_SLOT', 'halo') === false, 'cannot equip into a slot that does not exist');
}

// 7. gain is the only upgrade that changes awarded Energy for an otherwise identical run
{
  const s0 = P.defaultSave(), s1 = P.defaultSave(); s1.upgrades.gain = P.MAX_LEVEL;
  const r = { heardFrac: 0.5, heard: 5, phrases: 10, full: false, pure: false, shieldsUsed: 0, energy: 50, stats: {} };
  const e0 = P.energyForRun(r, s0), e1 = P.energyForRun(r, s1);
  ok(e1 > e0 && e1 === Math.round(50 * P.UPGRADES.gain.effect(P.MAX_LEVEL)), 'Gain multiplies the awarded energy as documented');
}

// 8. ghost lookup interpolates and clamps at the ends
{
  const g = [[0, -1], [1, 0], [2, 1]];
  ok(P.ghostX(g, 0.5) === -0.5, 'ghostX interpolates between samples');
  ok(P.ghostX(g, -5) === -1 && P.ghostX(g, 50) === 1, 'ghostX clamps before the first and after the last sample');
  ok(P.ghostX(null, 1) === null, 'ghostX on no ghost returns null');
}

console.log(fail ? ('FAIL (' + fail + ')') : 'PASS');
process.exit(fail ? 1 : 0);
