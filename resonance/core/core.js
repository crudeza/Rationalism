/* RESONANCE core: cues, scoring, silences. No rendering, no audio: runs headless (bot) and in the browser. */
(function (root) {
  const BASE_SPEED = 1.6; // normalised corridor units/s, same as validate_cuemap.py
  const HEAR_RATIO = 0.7; // [TUNE] share of a phrase's cues that must be hit for it to stay full
  const CAM_EDGE = 0.45;  // [TUNE] seconds to push the camera in / pull it back
  const FLIP_LEAD = 0.3, FLIP_TAIL = 0.35, FLIP_BEATS = 4; // [TUNE] one flip per 4 beats, never touching the landing
  const OUTRO_MAX = 8;    // [TUNE] seconds of flips in the final silence
  const TIERS = { easy: { easy: 1 }, normal: { easy: 1, normal: 1 }, elite: { easy: 1, normal: 1, elite: 1 } };
  const ss = u => u * u * (3 - 2 * u);

  /* Silence specials: each silence (merged if the landing would overlap the next) becomes one flip sequence that
     ends exactly on the next downbeat (bar line). The final silence of the track is an outro (land = null). */
  function buildFlights(cm) {
    const bar = cm.beatsPerBar * 60 / cm.bpm, sl = cm.silences.slice().sort((a, b) => a.t0 - b.t0), out = [];
    const nextDown = t => cm.startMark + Math.ceil((t - cm.startMark) / bar - 0.02) * bar;
    for (let i = 0; i < sl.length; i++) {
      let t0 = sl[i].t0, t1 = sl[i].t1;
      if (t1 >= cm.duration - 1) { out.push({ t0, land: null, end: cm.duration }); continue; }
      let land = nextDown(t1);
      while (i + 1 < sl.length && sl[i + 1].t0 < land) { i++; t1 = sl[i].t1; if (t1 >= cm.duration - 1) { land = null; break; } land = nextDown(t1); }
      if (land === null) { out.push({ t0, land: null, end: cm.duration }); continue; }
      out.push({ t0, land, end: land });
    }
    return out;
  }

  /* Flip plan for one special: flips fill [s0,s1], n whole flips of equal length (about FLIP_BEATS beats each). */
  function flipPlan(cm, F) {
    const per = 60 / cm.bpm, s0 = F.t0 + FLIP_LEAD;
    const s1 = F.land === null ? Math.min(F.end - 0.5, F.t0 + OUTRO_MAX) : F.land - FLIP_TAIL;
    const w = Math.max(0.5, s1 - s0), n = Math.max(1, Math.round(w / (per * FLIP_BEATS)));
    return { s0, s1: s0 + w, n, d: w / n };
  }

  function createRun(cm, tier, opt) {
    opt = opt || {};
    const flights = buildFlights(cm);
    flights.forEach(f => { f.plan = flipPlan(cm, f); });
    const inFlight = t => flights.some(f => t >= f.t0 && t < f.end);
    const cues = cm.cues.filter(c => TIERS[tier][c.tier || 'easy'] && !inFlight(c.t)).map((c, i) => Object.assign({ id: i, state: 'pending' }, c));
    const phr = cm.phrases.map(p => ({ id: p.id, t0: p.t0, t1: p.t1, total: 0, hit: 0, missed: 0, allowed: 0, hollow: false, done: false }));
    cues.forEach(c => { phr[c.phrase].total++; });
    phr.forEach(p => { p.allowed = Math.floor(p.total * (1 - HEAR_RATIO)); }); // may miss up to 30% of a phrase and still hear it
    return {
      cm, tier, cues, phr, flights, fi: 0, flight: null, flying: false,
      cam: 0, lift: 0, pitch: 0, roll: 0, flipI: -1, flipKind: 'pitch', flipCount: 0, landings: [],
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

  function resetPose(run) { run.cam = 0; run.lift = 0; run.pitch = 0; run.roll = 0; run.flipI = -1; }

  /* Pose of the ship and camera during a special. cam: 0 = normal chase view, 1 = close follow. */
  function poseFlight(run, F, t) {
    const a = Math.min(1, (t - F.t0) / CAM_EDGE), b = F.land === null ? 1 : Math.min(1, (F.land - t) / CAM_EDGE);
    run.cam = ss(Math.max(0, Math.min(a, b)));
    const P = F.plan; run.lift = 0; run.pitch = 0; run.roll = 0;
    if (t >= P.s0 && t < P.s1) {
      const u = (t - P.s0) / P.d, i = Math.min(P.n - 1, Math.floor(u)), fu = u - i, e = ss(fu), ang = Math.PI * 2 * e;
      const kind = i % 2 === 0 ? 'pitch' : 'roll';
      if (i !== run.flipI) { run.flipI = i; run.flipKind = kind; run.flipCount++; run.events.push({ type: 'flip', i, n: P.n, kind, t }); }
      if (kind === 'pitch') run.pitch = ang; else run.roll = ang * (i % 4 === 1 ? 1 : -1);
      run.lift = Math.sin(Math.PI * fu);
    }
  }

  /* t = track time in seconds (same timeline as cue.t). Call every frame with a monotonic t. */
  function step(run, t, dt) {
    // Road mode: left/right only, instant. Silences are flips: the ship stays under the player's control, does a
    // special flip with the camera close behind it, and the road game resumes exactly on the next downbeat.
    const tx = Math.max(-1, Math.min(1, run.target.x));
    const f = run.flights[run.fi];
    if (f && !run.flight && t >= f.t0) { run.flight = { f }; run.flying = true; run.events.push({ type: 'takeoff', t }); }
    run.ship.x = tx; run.ship.y = 0;
    if (run.flight) {
      const F = run.flight.f;
      if (F.land !== null && t >= F.land) { // landing: first frame at or after the downbeat
        resetPose(run); run.flight = null; run.flying = false; run.fi++;
        run.landings.push(t - F.land); run.events.push({ type: 'land', t, land: F.land, err: t - F.land });
      } else poseFlight(run, F, t);
    } else resetPose(run);
    run.silence = inSilence(run.cm, t);
    const cf = run.cfg;
    for (; run.next < run.cues.length; run.next++) {
      const c = run.cues[run.next], tj = c.t + cf.calib;
      if (c.type === 'pulse') {
        let bi = -1, bd = 9; // look for a press within the good window
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
      if (c) { run.target.x = c.x; run.target.y = c.y; }
    };
  }

  function simulate(cm, tier, skill, seed, dtFn) {
    const run = createRun(cm, tier), bot = makeBot(run, skill, seed); let dt = 1 / 60;
    let t = cm.startMark - 2;
    for (; t < cm.duration; t += dt) { if (dtFn) dt = dtFn(); bot(t); step(run, t, dt); if (isNaN(run.ship.x) || isNaN(run.pitch) || isNaN(run.roll) || isNaN(run.cam)) throw new Error('NaN'); }
    step(run, t + 1, dt);
    const r = result(run); r.landings = run.landings; r.flights = run.flights.length; r.outro = run.flights.filter(f => f.land === null).length; r.flips = run.flipCount; r.maxDt = 0; return r;
  }

  root.RES = { buildFlights, flipPlan, createRun, step, press, result, makeBot, simulate, inSilence, BASE_SPEED };
  if (typeof module !== 'undefined') module.exports = root.RES;
})(typeof window !== 'undefined' ? window : globalThis);
