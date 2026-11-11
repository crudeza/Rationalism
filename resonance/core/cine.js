/* RESONANCE cinematics (D-20). Pure planning + pose, no rendering. Runs headless and in the browser.
   Big moments (camera sweep, route tilt) only run where the tier has no cue, start on a downbeat, and sit in a
   silence/flight or on a phrase boundary. Atmosphere (ring wave) runs in parallel and never moves the camera. */
(function (root) {
  const RES = typeof require !== 'undefined' ? require('./core.js') : root.RES;
  const TIERS = { easy: { easy: 1 }, normal: { easy: 1, normal: 1 }, elite: { easy: 1, normal: 1, elite: 1 } };
  const SWEEP_AMP = 0.07, TILT_AMP = 0.07, WAVE_BARS = 1, AMP_MAX = 0.1; // [TUNE] amplitudes as fraction of W / radians

  const bar = cm => cm.beatsPerBar * 60 / cm.bpm;
  const ceilDown = (cm, t) => cm.startMark + Math.ceil((t - cm.startMark) / bar(cm) - 1e-6) * bar(cm);
  // the cue times the game actually presents: same filter as core.createRun (cues inside a flight are removed)
  const tierTimes = (cm, tier) => { const fl = RES.buildFlights(cm); return cm.cues.filter(c => TIERS[tier][c.tier || 'easy'] && !fl.some(f => c.t >= f.t0 && c.t < f.end)).map(c => c.t); };
  const allTimes = cm => cm.cues.map(c => c.t);
  const count = (ts, a, b) => ts.reduce((n, t) => n + (t >= a && t < b ? 1 : 0), 0);

  function plan(cm, tier) {
    const ts = tierTimes(cm, tier), b = bar(cm), flights = RES.buildFlights(cm), out = [], rej = [];
    const inFlight = t => flights.some(f => t >= f.t0 && t < f.end);
    // 1. camera sweep: inside each silence flight, from the first downbeat after the silence to its landing
    for (const F of flights) {
      if (F.land === null) continue;
      const t0 = ceilDown(cm, F.t0), t1 = F.land;
      if (t1 - t0 < b * 0.5) { rej.push({ kind: 'sweep', t0, why: 'too short' }); continue; }
      if (count(ts, t0, t1) > 0) { rej.push({ kind: 'sweep', t0, why: 'cue in window' }); continue; }
      out.push({ kind: 'sweep', t0, t1, amp: SWEEP_AMP, big: true });
    }
    // 2. ring wave: parallel atmosphere on the densest phrase (the drop). Never moves the camera.
    // density comes from the whole map (elite), so the drop is the same phrase on every difficulty
    const all = allTimes(cm);
    let best = null;
    for (const p of cm.phrases) { const n = count(all, p.t0, p.t1); if (!best || n > best.n) best = { p, n }; }
    if (best) out.push({ kind: 'wave', t0: best.p.t0, t1: best.p.t0 + WAVE_BARS * b, amp: 0, big: false, density: best.n });
    // 3. route tilt: first phrase boundary whose next bar holds no cue of this tier
    for (const p of cm.phrases) {
      if (p.id === 0) continue;
      if (count(ts, p.t0, p.t0 + b) > 0 || inFlight(p.t0)) continue;
      out.push({ kind: 'tilt', t0: p.t0, t1: p.t0 + b, amp: TILT_AMP, big: true }); break;
    }
    return { moments: out, rejected: rej };
  }

  /* Validator: returns a list of rule violations (empty = pass). */
  function check(cm, tier, moments) {
    const ts = tierTimes(cm, tier), b = bar(cm), errs = [];
    const onGrid = t => Math.abs((t - cm.startMark) / b - Math.round((t - cm.startMark) / b)) < 1e-3;
    const flights = RES.buildFlights(cm);
    for (const m of moments) {
      if (!(m.t0 < m.t1) || m.t1 > cm.duration) errs.push([m.kind, 'bad range']);
      if (Math.abs(m.amp) > AMP_MAX) errs.push([m.kind, 'amplitude over limit']);
      if (m.kind === 'wave' && m.amp !== 0) errs.push([m.kind, 'atmosphere moved the camera']);
      if (!m.big) continue;
      if (count(ts, m.t0, m.t1) > 0) errs.push([m.kind, 'cue inside window']);
      if (!onGrid(m.t0)) errs.push([m.kind, 'not on a downbeat']);
      const inSil = flights.some(f => m.t0 >= f.t0 && m.t0 < f.end);
      const onPhrase = cm.phrases.some(p => Math.abs(p.t0 - m.t0) < 0.01);
      if (!inSil && !onPhrase) errs.push([m.kind, 'not in a silence or phrase boundary']);
    }
    return errs;
  }

  /* Pose at track time t. yaw: horizontal shift of the lane (x W); roll: radians; wave: 0..1 progress or null. */
  function pose(moments, t) {
    let yaw = 0, roll = 0, wave = null;
    for (const m of moments) {
      if (t < m.t0 || t >= m.t1) continue;
      const u = (t - m.t0) / (m.t1 - m.t0), e = Math.sin(Math.PI * u);
      if (m.kind === 'sweep') yaw += m.amp * e;
      else if (m.kind === 'tilt') roll += m.amp * e;
      else if (m.kind === 'wave') wave = { u };
    }
    return { yaw, roll, wave };
  }

  root.CINE = { plan, check, pose, AMP_MAX };
  if (typeof module !== 'undefined') module.exports = root.CINE;
})(typeof window !== 'undefined' ? window : globalThis);
