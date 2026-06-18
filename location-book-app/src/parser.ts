/* Fuzzlecheck shooting-schedule parser + location model builder. Pure JS. */

// ---- raw text -> {scenes, days, regions} -------------------------------
export function parseSchedule(text: string) {
  const lines = text.split(/\r?\n/);
  const DAY_RE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{2}\/\d{2}\/\d{4})\s+-\s+(.+?)\s*$/;
  const REGION_RE = /^(.+?)\s+-\s+(Summer|Winter|Autumn|Spring)\s*$/i;
  const SCENE_RE = /^(\d+\.\d+[a-z]?)\s+((?:INT|EXT|I\+E)\/[A-Z]{2,4})\s+(.*)$/;
  const SYN_START = /(summer|winter|autumn|spring)\s+\d+\s*[-/]\s*\d{4}/i;
  const TAIL_RE = /\s+(\d+(?:\s+\d+\/\d+)?|\d+\/\d+)((?:\s+[\dab]+(?:,\s*[\dab]+)*)?)(\s+\d+)?\s*$/;

  const scenes: any[] = [], days: any[] = [], regions: string[] = [];
  let curRegion: string | null = null, curDay: any = null, shootCounter = 0, pending: any = null;

  function flush() { if (pending) { scenes.push(pending); pending = null; } }

  function parseSyn(chunk: string) {
    let season = null, storyNum = null, year = null, syn: string = chunk;
    let m: RegExpMatchArray | null = chunk.match(/^(summer|winter|autumn|spring)\s+(\d+)\s*[-/]\s*(\d{4})\s+(.*)$/i);
    if (m) { season = m[1].toLowerCase(); storyNum = m[2]; year = m[3]; syn = m[4]; }
    else { m = chunk.match(/^-?\s*(\d+)\s*[-/]\s*(\d{4})\s+(.*)$/); if (m) { storyNum = m[1]; year = m[2]; syn = m[3]; } }
    syn = syn.replace(/\s*pgs\b.*$/i, '').trim();
    return { season, storyNum, year, synopsis: syn };
  }

  for (const raw of lines) {
    const line = raw.replace(/ /g, ' ').trimEnd();
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
      if (gm && /pgs/i.test(rest)) { head = rest.slice(0, gm.index).trim(); synObj = parseSyn(rest.slice(gm.index!).trim()); }
      else if (/\bpgs\b/i.test(rest)) {
        const pi = rest.search(/-?\s*\d+\s*[-/]\s*\d{4}\s+/);
        if (pi > 0) { head = rest.slice(0, pi).trim(); synObj = parseSyn(rest.slice(pi).trim()); }
      }
      let setPath = head, pageLength = null, cast = null, extras = null;
      const tm = head.match(TAIL_RE);
      if (tm) { pageLength = tm[1].trim(); cast = (tm[2] || '').trim() || null; extras = tm[3] ? +tm[3].trim() : null; setPath = head.slice(0, tm.index).trim(); }
      setPath = setPath.replace(/\/\s*$/, '').trim();
      const segs = setPath.split(/\/+/).map((s: string) => s.trim()).filter(Boolean);
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
function lev(a: string, b: string) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_: any, i: number) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function norm(s: string) {
  return s.replace(/[‘’]/g, "'").replace(/\([^)]*\)/g, ' ')
    .replace(/\bposs\.?\s*croatia\b/ig, ' ').replace(/\?/g, ' ').replace(/\s+/g, ' ').trim();
}
function keyOf(s: string) { return norm(s).toLowerCase().replace(/\b(\w+)(\s+\1\b)+/g, '$1').trim(); }

// Build the per-location model from a parsed schedule.
export function buildModel(parsed: { scenes: any[], days: any[], regions: string[] }) {
  const { scenes, days } = parsed;
  const counts: Record<string, { count: number, display: string }> = {};
  for (const s of scenes) { const k = keyOf(s.location); (counts[k] = counts[k] || { count: 0, display: norm(s.location) }).count++; }
  const keys = Object.keys(counts).sort((a, b) => counts[b].count - counts[a].count);
  const canon: Record<string, string> = {}, accepted: string[] = [];
  for (const k of keys) {
    let target: string | null = null;
    const words = k.split(' ');
    for (let cut = words.length - 1; cut >= 1 && !target; cut--) {
      const pre = words.slice(0, cut).join(' ');
      if (accepted.includes(pre)) target = pre;
    }
    if (!target) for (const a of accepted)
      if (Math.abs(a.length - k.length) <= 2 && Math.min(a.length, k.length) >= 8 && lev(a, k) <= 2) { target = a; break; }
    if (target) canon[k] = target; else { accepted.push(k); canon[k] = k; }
  }

  const dayByNum: Record<number, any> = {}; for (const d of days) if (d.dayNumber != null) dayByNum[d.dayNumber] = d;

  const locs: Record<string, any> = {};
  scenes.forEach((s: any, i: number) => {
    const ck = canon[keyOf(s.location)];
    if (!locs[ck]) locs[ck] = { id: ck, name: counts[ck] ? counts[ck].display : ck, scenes: [], dayNums: new Set(), regions: new Set(), sets: new Set() };
    const L = locs[ck];
    L.scenes.push({ ...s, idx: i });
    if (s.dayNumber != null) L.dayNums.add(s.dayNumber);
    if (s.region) L.regions.add(s.region);
    if (s.segments.length > 1) L.sets.add(s.segments.slice(1).join(' / '));
  });

  const list = Object.values(locs).map((L: any) => {
    const dayNums = [...L.dayNums].sort((a: number, b: number) => a - b);
    const shootDates = dayNums.map((n: number) => dayByNum[n]).filter(Boolean)
      .map((d: any) => ({ dayNumber: d.dayNumber, date: d.date, weekday: d.weekday }));
    return {
      id: L.id, name: L.name,
      regions: [...L.regions], sets: [...L.sets],
      dayNums, shootDates,
      sceneCount: L.scenes.length,
      scenes: L.scenes.sort((a: any, b: any) => (a.dayNumber || 99) - (b.dayNumber || 99) || a.idx - b.idx)
    };
  }).sort((a: any, b: any) => b.sceneCount - a.sceneCount);

  return { locations: list, days, regions: parsed.regions, sceneTotal: scenes.length };
}

// ---- Alternative parser for column-per-line Fuzzlecheck format --------
// Some exports put each scene field on its own line:
//   EXT/DAY 2b, 3b, 8             ← type/tod + cast
//   Y/ House Milan/ yard Kosinj   ← [country/] setpath [location-tag]
//   1.79 2                        ← scene-number + pages
//   pgs
//   summer 01 - 1987 synopsis...  ← synopsis
// Day header: "Day #N - Mon DD/MM/YYYY - Pages: N N/NExtras: N"
export function parseScheduleV2(text: string): { scenes: any[]; days: any[]; regions: string[] } {
  const lines = text.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
  const TYPE_RE = /^(INT|EXT|I\+E)\/(DAY|NIGHT|DFN|DNS|D\/N|EVE|DAWN|DUSK|TWILIGHT)\b/;
  const DAY_RE = /^Day #(\d+)\s*-\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{2}\/\d{2}\/\d{4})\s*-\s*(.+)$/;
  const REGION_RE = /^(.+?)\s*-\s*(Summer|Winter|Autumn|Spring)\s*$/i;
  const SCENENUM_RE = /^(\d+\.\d+[a-z0-9p]*)\s+([\d\/]+)\s*$/;
  const SYN_RE = /^(summer|winter|autumn|spring)\s+(\d+)\s*[-\/]\s*(\d{4})\s+(.*)$/i;

  const scenes: any[] = [], days: any[] = [], regions: string[] = [];
  let curDay: any = null, curRegion: string | null = null, shootCounter = 0;

  function parseSynStr(s: string) {
    const m = s.match(SYN_RE);
    if (!m) return { season: null, storyNum: null, year: null, synopsis: s || null };
    return { season: m[1].toLowerCase(), storyNum: m[2], year: m[3], synopsis: m[4].trim() };
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Day header
    const dm = line.match(DAY_RE);
    if (dm) {
      const rest = dm[4];
      const off = /Day Off/i.test(rest);
      if (!off) shootCounter++;
      const pm = rest.match(/Pages:\s*([\d\s\/]+?)(?:Extras|$)/);
      const em = rest.match(/Extras:\s*(\d+)/);
      curDay = { weekday: dm[2], date: dm[3], dayNumber: off ? null : parseInt(dm[1]),
        off, pages: pm ? pm[1].trim() : null, region: curRegion, extras: em ? parseInt(em[1]) : 0 };
      days.push(curDay); i++; continue;
    }

    // Region banner
    const rm = line.match(REGION_RE);
    if (rm && !TYPE_RE.test(line)) {
      curRegion = line;
      if (!regions.includes(line)) regions.push(line);
      if (curDay) curDay.region = line;
      i++; continue;
    }

    // Scene block starting with TYPE/TOD
    if (TYPE_RE.test(line)) {
      const tm = line.match(/^(INT|EXT|I\+E)\/([\w\/]+)\s*(.*)/);
      if (!tm) { i++; continue; }
      const [, type, tod, castRaw] = tm;
      const cast = castRaw.trim() || null;

      // Next line: [country/] setpath [location-tag]
      i++;
      if (i >= lines.length) break;
      const setLine = lines[i];
      let country: string | null = null, setPath = setLine;
      const cm = setLine.match(/^([A-Z])\/\s+(.+)$/);
      if (cm) { country = cm[1]; setPath = cm[2]; }

      // Next line: scene-number + pages
      i++;
      if (i >= lines.length) break;
      let sceneNum: string | null = null, pageLength: string | null = null;
      const nm = lines[i].match(SCENENUM_RE);
      if (nm) { sceneNum = nm[1]; pageLength = nm[2]; i++; } else { i++; }

      // Skip "pgs" line
      if (i < lines.length && /^pgs$/i.test(lines[i])) i++;

      // Synopsis line
      let synObj: any = { season: null, storyNum: null, year: null, synopsis: null };
      if (i < lines.length && SYN_RE.test(lines[i])) {
        synObj = parseSynStr(lines[i]); i++;
      }

      if (!sceneNum) continue;

      const segs = setPath.split(/\/+/).map((s: string) => s.trim()).filter(Boolean);
      const location = segs[0] || setPath;

      scenes.push({
        number: sceneNum, type, tod, country, setPath, segments: segs, location,
        pageLength, cast, extras: null,
        dayNumber: curDay ? curDay.dayNumber : null,
        date: curDay ? curDay.date : null,
        region: curRegion, idx: scenes.length,
        ...synObj,
      });
      continue;
    }

    i++;
  }

  return { scenes, days, regions };
}
