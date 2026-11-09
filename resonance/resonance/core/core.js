/* RESONANCE core: cues, scoring, silences. No rendering, no audio: runs headless (bot) and in the browser. */
(function (root) {
  const BASE_SPEED = 1.6; // normalised corridor units/s, same as validate_cuemap.py
  const HEAR_RATIO = 0.7; // [TUNE] share of a phrase's cues that must be hit for it to stay full
  const TIERS = { easy: { easy: 1 }, normal: { easy: 1, normal: 1 }, elite: { easy: 1, normal: 1, elite: 1 } };

  /* Silence flights: each silence (merged if landing would overlap the next) becomes a flight that
     ends exactly on the next downbeat (bar line). The final silence of the track is an outro glide (land = null). */
  function buildFlights(cm) {
    const bar = cm.beatsPerBar * 60 / cm.bpm, ss = cm.silences.slice().sort((a, b) => a.t0 - b.t0), out = [];
    const nextDown = t => cm.startMark + Math.ceil((t - cm.startMark) / bar - 0.02) * bar;
    for (let i = 0; i < ss.length; i++) {
      let t0 = ss[i].t0, t1 = ss[i].t1;
      if (t1 >= cm.duration - 1) { out.push({ t0, land: null, end: cm.duration }); continue; }
      let land = nextDown(t1);
      while (i + 1 < ss.length && ss[i + 1].t0 < land) { i++; t1 = ss[i].t1; if (t1 >= cm.duration - 1) { land = null; break; } land = nextDown(t1); }
      if (land === null) { out.push({ t0, land: null, end: cm.duration }); continue; }
      out.push({ t0, land, end: land });
    }
    return out;
  }

  function createRun(cm, tier, opt) {
    opt = opt || {};
    const flights = buildFlights(cm);
    const inFlight = t => flights.some(f => t >= f.t0 && t < f.end);
    const cues = cm.cues.filter(c => TIERS[tier][c.tier || 'easy'] && !inFlight(c.t)).map((c, i) => Object.assign({ id: i, state: 'pending' }, c));
    const phr = cm.phrases.map(p => ({ id: p.id, t0: p.t0, t1: p.t1, total: 0, hit: 0, missed: 0, allowed: 0, hollow: false, done: false }));
    cues.forEach(c => { phr[c.phrase].total++; });
    phr.forEach(p => { p.allowed = Math.floor(p.total * (1 - HEAR_RATIO)); }); // may miss up to 30% of a phrase and still hear it
    // stardust: one mote per beat inside each flight (not on the landing beat), seeded smooth path
    const dust = []; let sd = 12345, rx = 0; const per = 60 / cm.bpm;
    flights.forEach(f => { const end = (f.land === null ? Math.min(f.end, f.t0 + 8) : f.land - 0.4); for (let t = f.t0 + 0.5; t < end; t += per) { sd = (sd * 16807) % 2147483647; rx = Math.max(-0.8, Math.min(0.8, rx + ((sd / 2147483647) - 0.5) * 1.1)); dust.push({ t, x: +rx.toFixed(3), got: false }); } });
    return {
      cm, tier, cues, phr, flights, dust, fi: 0, di: 0, flight: null, flying: false, lift: 0, roll: 0, landings: [],
      ship: { x: 0, y: 0 }, target: { x: 0, y: 0 },
      presses: [], events: [], next: 0, silence: false,
      stats: { perfect: 0, good: 0, miss: 0, combo: 0, max: 0, dust: 0 },
      cfg: { span: opt.span || 0.2, perfect: 0.05, good: 0.12, calib: (opt.calibMs || 0) / 1000, speed: BASE_SPEED * (opt.agility || 1) }
    };
  }

  function grade(run, c, g) {
    const s = run.stats;
    if (g === 'miss') {
      c.state = 'miss'; s.miss++; s.combo = 0; const p = run.phr[c.phrase]; p.missed++;
      run.events.push({ type: 'miss', phrase: c.phrase, t: c.t });
      if (!p.hollow && p.missed > p.allowed) { p.hollow = true; run.events.push({ type: 'hollow', phrase: c.phrase, until: p.t1 }); }
    } else {
      c.state = g; s[g]++; s.combo++; s.max = Math.max(s.max, s.combo); run.phr[c.phrase].hit++;
      run.events.push({ type: 'hit', grade: g, id: c.id });
    }
  }

  function inSilence(cm, t) { return cm.silences.some(s => t >= s.t0 && t < s.t1); }

  /* t = track time in seconds (same timeline as cue.t). Call every frame with a monotonic t. */
  function step(run, t, dt) {
    // road mode: left/right only, instant. During a silence flight the ship leaves the road and lands exactly on the next downbeat.
    const tx = Math.max(-1, Math.min(1, run.target.x));
    let f = run.flights[run.fi];
    if (f && !run.flight && t >= f.t0) { run.flight = { f, x0: run.ship.x }; run.flying = true; run.events.push({ type: 'takeoff', t }); }
    if (run.flight) {
      const F = run.flight.f;
      if (F.land !== null && t >= F.land) { // landing: first frame at or after the downbeat
        run.ship.x = tx; run.lift = 0; run.roll = 0; run.flight = null; run.flying = false; run.fi++;
        run.landings.push(t - F.land); run.events.push({ type: 'land', t, land: F.land, err: t - F.land });
      } else if (F.land === null) { run.ship.x = tx; run.lift = Math.min(1, (t - F.t0) / 1.5) * 0.7; run.roll = 0; }
      else {
        const u = (t - F.t0) / (F.land - F.t0), e = u * u * (3 - 2 * u); // smoothstep from take-off x to wherever the player points
        run.ship.x = run.flight.x0 + (tx - run.flight.x0) * e; run.lift = Math.sin(Math.PI * u); run.roll = u * Math.PI * 4;
      }
    } else { run.ship.x = tx; run.lift = 0; run.roll = 0; }
    run.ship.y = 0;
    for (; run.di < run.dust.length && run.dust[run.di].t <= t; run.di++) { // stardust collected if the ship is under it
      const m = run.dust[run.di];
      if (Math.abs(run.ship.x - m.x) < 0.2) { m.got = true; run.stats.dust++; run.events.push({ type: 'dust', t: m.t }); }
    }
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
    run.phr.forEach(p => { if (!p.done && t >= p.t1) { p.done = true; run.events.push({ type: 'phrase', id: p.id, heard: !p.hollow }); } });
  }

  function press(run, t) { run.presses.push(t); }

  function result(run) {
    const heard = run.phr.filter(p => !p.hollow).length, n = run.phr.length;
    return { heardFrac: heard / n, heard, phrases: n, full: heard === n, energy: Math.round(100 * heard / n) + run.stats.dust, stats: run.stats };
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
      if (run.flying) { const m = run.dust.slice(run.di).find(d => d.t >= t); if (m) run.target.x = m.x; return; }
      if (c) { run.target.x = c.x; run.target.y = c.y; }
    };
  }

  function simulate(cm, tier, skill, seed, dtFn) {
    const run = createRun(cm, tier), bot = makeBot(run, skill, seed); let dt = 1 / 60;
    let t = cm.startMark - 2;
    for (; t < cm.duration; t += dt) { if (dtFn) dt = dtFn(); bot(t); step(run, t, dt); if (isNaN(run.ship.x) || isNaN(run.ship.y)) throw new Error('NaN ship'); }
    step(run, t + 1, dt);
    const r = result(run); r.landings = run.landings; r.flights = run.flights.length; r.outro = run.flights.filter(f => f.land === null).length; r.maxDt = 0; return r;
  }

  root.RES = { buildFlights, createRun, step, press, result, makeBot, simulate, inSilence, BASE_SPEED };
  if (typeof module !== 'undefined') module.exports = root.RES;
})(typeof window !== 'undefined' ? window : globalThis);
