/* RESONANCE W5: progression and the ship builder's data model. No rendering; pairs with core.js's run/result.
   Save schema v1 is frozen in 04_TECH_SPEC.md - this file is the only place that reads or writes it. */
(function (root) {
  const SHIPS = ['gemini', 'halo', 'petal']; // W3 ship kit (ships_manifest.json)
  const SLOTS = ['HULL', 'WING_L', 'WING_R', 'ENGINE', 'POD_L', 'POD_R', 'TRAIL', 'DECAL']; // manifest slot order
  const WORLDS = ['cry-me-a-reverb', 'nueva-anormalidad', 'ganimedes']; // unlock order (Q-03)
  const SAVE_KEY = 'resonance_save_v1';
  const MAX_LEVEL = 5; // [TUNE] same ceiling for every upgrade, kept low so a grind stays "a little" (Game Sheet §8)

  /* Upgrade levels -> actual gameplay numbers. Every one is forgiveness or earnings, never speed (P-07). */
  const UPGRADES = {
    span: { label: 'Span', desc: 'Wider hit area on rings', effect: lvl => 0.2 + 0.025 * lvl },
    agility: { label: 'Agility', desc: 'More forgiving timing windows', effect: lvl => ({ perfect: 0.05 + 0.008 * lvl, good: 0.12 + 0.015 * lvl }) },
    echo: { label: 'Echo', desc: 'Shield charges that save a phrase from going hollow', effect: lvl => lvl },
    magnet: { label: 'Magnet', desc: 'Gentle pull toward the nearest ring', effect: lvl => 0.06 * lvl },
    gain: { label: 'Gain', desc: 'More Energy per run', effect: lvl => 1 + 0.15 * lvl }
  };

  function upgradeCost(level) { return Math.round(20 * Math.pow(1.45, level)); } // cost of level -> level+1 [TUNE]

  const FULL_BONUS = 20, PURE_BONUS = 15; // [TUNE] flat Energy on top of the heard-fraction award

  /* Cosmetic reward schedule [PROPOSED]: Full Resonance on a world unlocks the next ship's whole part set.
     GEMINI is owned from the start (the W3 base/reference ship; w3-handoff). Purely cosmetic (P-07 / w3-handoff:
     no ship has a stat difference), so this never touches difficulty. */
  const PART_REWARD = { 0: 'halo', 1: 'petal' }; // world index -> ship granted whole on Full Resonance

  function partsOf(ship) { return SLOTS.map(s => ship + ':' + s); }

  function defaultSave() {
    const songs = {};
    WORLDS.forEach((w, i) => { songs[w] = { unlocked: i === 0, bestHeard: 0, full: false, pure: false, ghost: null }; });
    const owned = partsOf('gemini'), equipped = {};
    SLOTS.forEach(s => { equipped[s] = 'gemini:' + s; });
    return {
      v: 1, energy: 0,
      upgrades: { span: 0, agility: 0, echo: 0, magnet: 0, gain: 0 },
      parts: { owned, equipped },
      songs, prize: { claimed: false }, calibrationMs: 0, lang: 'en'
    };
  }

  /* Fill in anything a save from an earlier build is missing (a new song, a new upgrade key) without touching
     what is already there. Always run a loaded save through this. */
  function migrate(s) {
    const d = defaultSave();
    s.upgrades = Object.assign({}, d.upgrades, s.upgrades);
    s.parts = s.parts || d.parts;
    s.parts.owned = s.parts.owned || d.parts.owned;
    s.parts.equipped = Object.assign({}, d.parts.equipped, s.parts.equipped);
    s.songs = s.songs || {};
    WORLDS.forEach((w, i) => { s.songs[w] = Object.assign({ unlocked: i === 0, bestHeard: 0, full: false, pure: false, ghost: null }, s.songs[w]); });
    s.prize = s.prize || d.prize;
    s.calibrationMs = s.calibrationMs || 0;
    s.lang = s.lang || 'en';
    s.energy = s.energy || 0;
    return s;
  }

  function loadSave() {
    try {
      const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(SAVE_KEY) : null;
      if (!raw) return defaultSave();
      const s = JSON.parse(raw);
      if (!s || s.v !== 1) return defaultSave();
      return migrate(s);
    } catch (e) { return defaultSave(); }
  }

  function saveSave(s) {
    try { if (typeof localStorage !== 'undefined') { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; } return false; }
    catch (e) { return false; }
  }

  /* Export/import code: a copy-pasteable string, since there is no account/server. */
  function exportCode(s) {
    try { return btoa(unescape(encodeURIComponent(JSON.stringify(s)))); } catch (e) { return null; }
  }
  function importCode(code) {
    try { const s = JSON.parse(decodeURIComponent(escape(atob(String(code).trim())))); return (s && s.v === 1) ? migrate(s) : null; }
    catch (e) { return null; }
  }

  /* The opt object core.createRun(cm, tier, opt) expects, derived from the save's upgrade levels. */
  function cfgFromSave(s) {
    const u = s.upgrades, ag = UPGRADES.agility.effect(u.agility);
    return {
      span: UPGRADES.span.effect(u.span), perfect: ag.perfect, good: ag.good,
      shields: UPGRADES.echo.effect(u.echo), magnet: UPGRADES.magnet.effect(u.magnet),
      calibMs: s.calibrationMs || 0
    };
  }

  function gainMult(s) { return UPGRADES.gain.effect(s.upgrades.gain); }

  /* Energy actually awarded for a finished run. core.js's result() is gameplay-only (Gain belongs to the
     economy, not the sim), so the multiplier and completion bonuses are applied here. */
  function energyForRun(r, s) {
    let e = Math.round(r.energy * gainMult(s));
    if (r.full) e += FULL_BONUS;
    if (r.pure) e += PURE_BONUS;
    return e;
  }

  function nextUnlockMessages(s, worldIdx) {
    const msgs = [];
    const nextWorld = WORLDS[worldIdx + 1];
    if (nextWorld && !s.songs[nextWorld].unlocked) { s.songs[nextWorld].unlocked = true; msgs.push({ type: 'song', world: nextWorld }); }
    const ship = PART_REWARD[worldIdx];
    if (ship) {
      const parts = partsOf(ship), missing = parts.filter(p => !s.parts.owned.includes(p));
      if (missing.length) { s.parts.owned.push(...missing); msgs.push({ type: 'ship', ship }); }
    }
    return msgs;
  }

  /* Apply a finished run to the save: Energy, best score, unlock chain, cosmetic rewards, ghost. Mutates s and
     returns a report for the UI ("Song unlocked!", etc). Caller still calls saveSave(s). */
  function applyRunResult(s, world, r, ghostPath) {
    const idx = WORLDS.indexOf(world), song = s.songs[world], earned = energyForRun(r, s);
    s.energy += earned;
    const improved = r.heardFrac > song.bestHeard;
    if (improved) song.bestHeard = r.heardFrac;
    if (r.full) song.full = true;
    if (r.pure) song.pure = true;
    if (ghostPath && improved) song.ghost = ghostPath;
    const unlocks = r.full ? nextUnlockMessages(s, idx) : [];
    return { earned, improved, unlocks };
  }

  function canAfford(s, key) { return UPGRADES[key] && s.upgrades[key] < MAX_LEVEL && s.energy >= upgradeCost(s.upgrades[key]); }
  function buyUpgrade(s, key) {
    if (!canAfford(s, key)) return false;
    s.energy -= upgradeCost(s.upgrades[key]); s.upgrades[key]++; return true;
  }

  function equipPart(s, slot, ship) {
    const id = ship + ':' + slot;
    if (SLOTS.indexOf(slot) < 0 || !s.parts.owned.includes(id)) return false;
    s.parts.equipped[slot] = id; return true;
  }

  /* Ghost path helpers: a compact sampled (t, x) path for the best run, replayed as a translucent ship. */
  const r3 = v => Math.round(v * 1000) / 1000;
  function compactGhost(points, maxPoints) {
    maxPoints = maxPoints || 300;
    if (points.length <= maxPoints) return points.map(p => [r3(p[0]), r3(p[1])]);
    const out = [], step = (points.length - 1) / (maxPoints - 1);
    for (let i = 0; i < maxPoints; i++) { const p = points[Math.round(i * step)]; out.push([r3(p[0]), r3(p[1])]); }
    return out;
  }
  function ghostX(ghost, t) {
    if (!ghost || !ghost.length) return null;
    if (t <= ghost[0][0]) return ghost[0][1];
    if (t >= ghost[ghost.length - 1][0]) return ghost[ghost.length - 1][1];
    let lo = 0, hi = ghost.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ghost[mid][0] <= t) lo = mid; else hi = mid; }
    const a = ghost[lo], b = ghost[hi], u = (t - a[0]) / ((b[0] - a[0]) || 1);
    return a[1] + (b[1] - a[1]) * u;
  }

  root.RESPROG = {
    SHIPS, SLOTS, WORLDS, MAX_LEVEL, UPGRADES, upgradeCost, FULL_BONUS, PURE_BONUS, PART_REWARD,
    defaultSave, migrate, loadSave, saveSave, exportCode, importCode,
    cfgFromSave, gainMult, energyForRun, applyRunResult, canAfford, buyUpgrade, equipPart,
    compactGhost, ghostX
  };
  if (typeof module !== 'undefined') module.exports = root.RESPROG;
})(typeof window !== 'undefined' ? window : globalThis);
