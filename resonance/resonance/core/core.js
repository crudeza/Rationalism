/* RESONANCE core: cues, scoring, silences. No rendering, no audio: runs headless (bot) and in the browser. */
(function (root) {
  const BASE_SPEED = 1.6; // normalised corridor units/s, same as validate_cuemap.py
  const TIERS = { easy: { easy: 1 }, normal: { easy: 1, normal: 1 }, elite: { easy: 1, normal: 1, elite: 1 } };

  function createRun(cm, tier, opt) {
    opt = opt || {};
    const cues = cm.cues.filter(c => TIERS[tier][c.tier || 'easy']).map((c, i) => Object.assign({ id: i, state: 'pending' }, c));
    const phr = cm.phrases.map(p => ({ id: p.id, t0: p.t0, t1: p.t1, total: 0, hit: 0, missed: 0, done: false }));
    cues.forEach(c => { phr[c.phrase].total++; });
    return {
      cm, tier, cues, phr,
      ship: { x: 0, y: 0 }, target: { x: 0, y: 0 },
      presses: [], events: [], next: 0, silence: false,
      stats: { perfect: 0, good: 0, miss: 0, combo: 0, max: 0 },
      cfg: { span: opt.span || 0.2, perfect: 0.05, good: 0.12, calib: (opt.calibMs || 0) / 1000, speed: BASE_SPEED * (opt.agility || 1) }
    };
  }

  function grade(run, c, g) {
    const s = run.stats;
    if (g === 'miss') {
      c.state = 'miss'; s.miss++; s.combo = 0; run.phr[c.phrase].missed++;
      run.events.push({ type: 'miss', phrase: c.phrase, t: c.t });
    } else {
      c.state = g; s[g]++; s.combo++; s.max = Math.max(s.max, s.combo); run.phr[c.phrase].hit++;
      run.events.push({ type: 'hit', grade: g, id: c.id });
    }
  }

  function inSilence(cm, t) { return cm.silences.some(s => t >= s.t0 && t < s.t1); }

  /* t = track time in seconds (same timeline as cue.t). Call every frame with a monotonic t. */
  function step(run, t, dt) {
    // road mode (w2-v3): left/right only, instant. y is ignored; cue y in the maps is unused.
    run.ship.x = Math.max(-1, Math.min(1, run.target.x)); run.ship.y = 0;
    run.silence = inSilence(run.cm, t);
    const cf = run.cfg;
    for (; run.next < run.cues.length; run.next++) {
      const c = run.cues[run.next], tj = c.t + cf.calib;
      if (c.type === 'pulse') {
        // look for a press within the good window
        let bi = -1, bd = 9;
        run.presses.forEach((p, i) => { const e = Math.abs(p - tj); if (e <= cf.good && e < bd) { bd = e; bi = i; } });
        if (bi >= 0) { run.presses.splice(bi, 1); grade(run, c, bd <= cf.perfect ? 'perfect' : 'good'); continue; }
        if (t > tj + cf.good) { grade(run, c, 'miss'); continue; }
        break;
      } else {
        if (t < tj) break;
        const e = Math.abs(run.ship.x - c.x);
        grade(run, c, e <= cf.span * 0.5 ? 'perfect' : e <= cf.span ? 'good' : 'miss');
      }
    }
    run.presses = run.presses.filter(p => t - p < 0.3);
    run.phr.forEach(p => { if (!p.done && t >= p.t1) { p.done = true; run.events.push({ type: 'phrase', id: p.id, heard: p.missed === 0 }); } });
  }

  function press(run, t) { run.presses.push(t); }

  function result(run) {
    const heard = run.phr.filter(p => p.missed === 0).length, n = run.phr.length;
    return { heardFrac: heard / n, heard, phrases: n, full: heard === n, energy: Math.round(100 * heard / n), stats: run.stats };
  }

  /* Headless bot. skill 1 = perfect; lower = ignores some cues. Deterministic via seed. */
  function makeBot(run, skill, seed) {
    let s = seed || 1; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const skip = {};
    return function (t) {
      let c = null;
      for (let i = run.next; i < run.cues.length; i++) {
        const q = run.cues[i];
        if (q.state !== 'pending') continue;
        if (q.type === 'ring') { if (skip[q.id] === undefined) skip[q.id] = rnd() > skill; if (!skip[q.id]) { c = q; break; } }
        if (q.type === 'pulse' && Math.abs(q.t + run.cfg.calib - t) < 1 / 30) { if (rnd() <= skill) press(run, q.t + run.cfg.calib); }
        if (q.t - t > 1.5) break;
      }
      if (c) { run.target.x = c.x; run.target.y = c.y; }
    };
  }

  function simulate(cm, tier, skill, seed) {
    const run = createRun(cm, tier), bot = makeBot(run, skill, seed), dt = 1 / 60;
    let t = cm.startMark - 2;
    for (; t < cm.duration; t += dt) { bot(t); step(run, t, dt); if (isNaN(run.ship.x) || isNaN(run.ship.y)) throw new Error('NaN ship'); }
    step(run, t + 1, dt);
    return result(run);
  }

  root.RES = { createRun, step, press, result, makeBot, simulate, inSilence, BASE_SPEED };
  if (typeof module !== 'undefined') module.exports = root.RES;
})(typeof window !== 'undefined' ? window : globalThis);
