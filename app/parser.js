/* Fuzzlecheck shooting-schedule parser + location model builder.
   Pure JS, attaches LB.parseSchedule / LB.buildModel to window.LB.        */
(function () {
  "use strict";

  // ---- raw text -> {scenes, days, regions} -------------------------------
  function parseSchedule(text) {
    const lines = text.split(/\r?\n/);
    const DAY_RE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{2}\/\d{2}\/\d{4})\s+-\s+(.+?)\s*$/;
    const REGION_RE = /^(.+?)\s+-\s+(Summer|Winter|Autumn|Spring)\s*$/i;
    const SCENE_RE = /^(\d+\.\d+[a-z]?)\s+((?:INT|EXT|I\+E)\/[A-Z]{2,4})\s+(.*)$/;
    const SYN_START = /(summer|winter|autumn|spring)\s+\d+\s*[-/]\s*\d{4}/i;
    const TAIL_RE = /\s+(\d+(?:\s+\d+\/\d+)?|\d+\/\d+)((?:\s+[\dab]+(?:,\s*[\dab]+)*)?)(\s+\d+)?\s*$/;

    const scenes = [], days = [], regions = [];
    let curRegion = null, curDay = null, shootCounter = 0, pending = null;

    function flush() { if (pending) { scenes.push(pending); pending = null; } }

    function parseSyn(chunk) {
      let season = null, storyNum = null, year = null, syn = chunk;
      let m = chunk.match(/^(summer|winter|autumn|spring)\s+(\d+)\s*[-/]\s*(\d{4})\s+(.*)$/i);
      if (m) { season = m[1].toLowerCase(); storyNum = m[2]; year = m[3]; syn = m[4]; }
      else { m = chunk.match(/^-?\s*(\d+)\s*[-/]\s*(\d{4})\s+(.*)$/); if (m) { storyNum = m[1]; year = m[2]; syn = m[3]; } }
      syn = syn.replace(/\s*pgs\b.*$/i, '').trim();
      return { season, storyNum, year, synopsis: syn };
    }

    for (let raw of lines) {
      const line = raw.replace(/\u00a0/g, ' ').trimEnd();
      const t = line.trim();
      if (!t) continue;
      if (/page #/.test(t)) continue;
      if (/^--\s*\d+\s+of\s+\d+\s*--$/.test(t)) continue;
      if (/^Shooting Schedule/i.test(t)) continue;
      const em = t.match(/Extras:\s*(\d+)/);
      if (/^\s*Extras:/.test(line)) { if (curDay && em) curDay.extras = +em[1]; continue; }

      const dm = t.match(DAY_RE);
      if (dm) {
        flush();
        const rest = dm[3], off = /Day Off/i.test(rest);
        let num = null; const nm = rest.match(/Day #(\d+)/);
        if (!off) { shootCounter++; num = nm ? +nm[1] : shootCounter; }
        const pm = rest.match(/Pages:\s*(.+)$/);
        curDay = { weekday: dm[1], date: dm[2], dayNumber: num, off, pages: pm ? pm[1].trim() : null, region: curRegion, extras: 0 };
        days.push(curDay);
        continue;
      }
      if (t === 'SHOOT START') continue;
      const rm = t.match(REGION_RE);
      if (rm && !SCENE_RE.test(t)) { curRegion = t; if (!regions.includes(t)) regions.push(t); if (curDay) curDay.region = t; continue; }

      const sm = t.match(SCENE_RE);
      if (sm) {
        flush();
        const number = sm[1], tt = sm[2]; let rest = sm[3];
        const [type, tod] = tt.split('/');
        let country = null; const cm = rest.match(/^([A-Z])\/\s+/); if (cm) { country = cm[1]; rest = rest.slice(cm[0].length); }
        let head = rest, synObj = null;
        const gm = rest.match(SYN_START);
        if (gm && /pgs/i.test(rest)) { head = rest.slice(0, gm.index).trim(); synObj = parseSyn(rest.slice(gm.index).trim()); }
        else if (/\bpgs\b/i.test(rest)) {
          const pi = rest.search(/-?\s*\d+\s*[-/]\s*\d{4}\s+/);
          if (pi > 0) { head = rest.slice(0, pi).trim(); synObj = parseSyn(rest.slice(pi).trim()); }
        }
        let setPath = head, pageLength = null, cast = null, extras = null;
        const tm = head.match(TAIL_RE);
        if (tm) { pageLength = tm[1].trim(); cast = (tm[2] || '').trim() || null; extras = tm[3] ? +tm[3].trim() : null; setPath = head.slice(0, tm.index).trim(); }
        setPath = setPath.replace(/\/\s*$/, '').trim();
        const segs = setPath.split(/\/+/).map(s => s.trim()).filter(Boolean);
        const location = segs[0] || setPath || '(unknown)';
        pending = {
          number, type, tod, country, setPath, segments: segs, location, pageLength, cast, extras,
          dayNumber: curDay ? curDay.dayNumber : null, date: curDay ? curDay.date : null, region: curRegion,
          season: null, storyNum: null, year: null, synopsis: null
        };
        if (synObj) Object.assign(pending, synObj);
        continue;
      }
      if (pending && !pending.synopsis && /\bpgs\b/i.test(t)) { Object.assign(pending, parseSyn(t)); continue; }
      if (pending && /\bpgs\b/i.test(t)) continue;
      if (pending) pending.notes = (pending.notes ? pending.notes + '; ' : '') + t;
    }
    flush();
    return { scenes, days, regions };
  }

  // ---- location name normalisation + fuzzy merge -------------------------
  function lev(a, b) {
    const m = a.length, n = b.length;
    const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function norm(s) {
    return s.replace(/[\u2018\u2019]/g, "'").replace(/\([^)]*\)/g, ' ')
      .replace(/\bposs\.?\s*croatia\b/ig, ' ').replace(/\?/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function keyOf(s) { return norm(s).toLowerCase().replace(/\b(\w+)(\s+\1\b)+/g, '$1').trim(); }

  // Build the per-location model from a parsed schedule.
  function buildModel(parsed) {
    const { scenes, days } = parsed;
    const counts = {};
    for (const s of scenes) { const k = keyOf(s.location); (counts[k] = counts[k] || { count: 0, display: norm(s.location) }).count++; }
    const keys = Object.keys(counts).sort((a, b) => counts[b].count - counts[a].count);
    const canon = {}, accepted = [];
    for (const k of keys) {
      let target = null;
      const words = k.split(' ');
      for (let cut = words.length - 1; cut >= 1 && !target; cut--) {
        const pre = words.slice(0, cut).join(' ');
        if (accepted.includes(pre)) target = pre;
      }
      if (!target) for (const a of accepted)
        if (Math.abs(a.length - k.length) <= 2 && Math.min(a.length, k.length) >= 8 && lev(a, k) <= 2) { target = a; break; }
      if (target) canon[k] = target; else { accepted.push(k); canon[k] = k; }
    }

    const dayByNum = {}; for (const d of days) if (d.dayNumber != null) dayByNum[d.dayNumber] = d;

    const locs = {};
    scenes.forEach((s, i) => {
      const ck = canon[keyOf(s.location)];
      if (!locs[ck]) locs[ck] = { id: ck, name: counts[ck] ? counts[ck].display : ck, scenes: [], dayNums: new Set(), regions: new Set(), sets: new Set() };
      const L = locs[ck];
      L.scenes.push({ ...s, idx: i });
      if (s.dayNumber != null) L.dayNums.add(s.dayNumber);
      if (s.region) L.regions.add(s.region);
      if (s.segments.length > 1) L.sets.add(s.segments.slice(1).join(' / '));
    });

    const list = Object.values(locs).map(L => {
      const dayNums = [...L.dayNums].sort((a, b) => a - b);
      const shootDates = dayNums.map(n => dayByNum[n]).filter(Boolean)
        .map(d => ({ dayNumber: d.dayNumber, date: d.date, weekday: d.weekday }));
      return {
        id: L.id, name: L.name,
        regions: [...L.regions], sets: [...L.sets],
        dayNums, shootDates,
        sceneCount: L.scenes.length,
        scenes: L.scenes.sort((a, b) => (a.dayNumber || 99) - (b.dayNumber || 99) || a.idx - b.idx)
      };
    }).sort((a, b) => b.sceneCount - a.sceneCount);

    return { locations: list, days, regions: parsed.regions, sceneTotal: scenes.length };
  }

  window.LB = window.LB || {};
  window.LB.parseSchedule = parseSchedule;
  window.LB.buildModel = buildModel;
})();
