(() => {
  'use strict';

  const GRID = 36;
  const CELL_COUNT = GRID * GRID;
  const START_YEAR = 2026;
  const HISTORY_LIMIT = 48;
  const ROAD_CAPACITY = 22;
  const MAX_HOUSEHOLDS = 1400;
  const SAVE_KEY = 'urbanLabV2Save';

  const COSTS = {
    road: 800, residential: 150, commercial: 180, industrial: 180, office: 220,
    park: 4500, school: 18000, hospital: 30000, station: 22000, bulldoze: 400
  };
  const UPKEEP = { road: 8, park: 150, school: 1000, hospital: 1800, station: 1200 };
  const ZONE_LABEL = { residential: '住宅地区', commercial: '商業地区', industrial: '工業地区', office: 'オフィス地区' };
  const KIND_LABEL = {
    empty: '空き地', road: '道路', residential: '住宅地区', commercial: '商業地区', industrial: '工業地区',
    office: 'オフィス地区', park: '公園', school: '学校', hospital: '病院', station: '駅'
  };
  const BASE_COLORS = {
    empty: '#102033', road: '#586575', residential: '#357bd7', commercial: '#d69a34', industrial: '#8b6542',
    office: '#8f5dd0', park: '#329560', school: '#3ca1b3', hospital: '#d44f62', station: '#c74ca5'
  };
  const BUILDING_COLORS = {
    residential: ['#4f91eb','#6ca8f0','#8abdf4'], commercial: ['#e4aa49','#e9bb6c','#f0ce95'],
    industrial: ['#9d774f','#b18c65','#c3a684'], office: ['#9f6fe0','#b18be9','#c7a8ef']
  };
  const BUILDING_CAPACITY = {
    residential: [0, 6, 14, 30],
    commercial: [0, 8, 18, 40],
    industrial: [0, 14, 30, 60],
    office: [0, 10, 24, 55]
  };
  const WAGES = { commercial: 58, industrial: 67, office: 92 };
  const JOB_EDU = { commercial: 0, industrial: 0, office: 1 };

  const canvas = document.getElementById('cityCanvas');
  const ctx = canvas.getContext('2d');
  const historyCanvas = document.getElementById('historyCanvas');
  const historyCtx = historyCanvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const els = {
    play: $('playBtn'), step: $('stepBtn'), reset: $('resetBtn'), save: $('saveBtn'), load: $('loadBtn'),
    palette: $('toolPalette'), layerTabs: $('layerTabs'), speed: $('speedRange'), speedLabel: $('speedLabel'),
    incomeTax: $('incomeTax'), propertyTax: $('propertyTax'), incomeTaxLabel: $('incomeTaxLabel'), propertyTaxLabel: $('propertyTaxLabel'),
    policyTransit: $('policyTransit'), policyAffordable: $('policyAffordable'), policyGreen: $('policyGreen'),
    simBadge: $('simBadge'), date: $('dateStat'), population: $('populationStat'), populationDelta: $('populationDelta'),
    budget: $('budgetStat'), balance: $('balanceStat'), happiness: $('happinessStat'), employment: $('employmentStat'), jobs: $('jobsStat'),
    commute: $('commuteStat'), traffic: $('trafficStat'), landValue: $('landValueStat'), pollution: $('pollutionStat'),
    housingCapacity: $('housingCapacityStat'), vacancy: $('vacancyStat'), vacantJobs: $('vacantJobsStat'), transitShare: $('transitShareStat'),
    schoolCoverage: $('schoolCoverageStat'), healthCoverage: $('healthCoverageStat'),
    demandR: $('demandR'), demandC: $('demandC'), demandI: $('demandI'), demandO: $('demandO'),
    demandRLabel: $('demandRLabel'), demandCLabel: $('demandCLabel'), demandILabel: $('demandILabel'), demandOLabel: $('demandOLabel'),
    demandExplanation: $('demandExplanation'), selectedCoord: $('selectedCoord'), cellDetails: $('cellDetails'), missions: $('missions'), missionScore: $('missionScore'),
    eventLog: $('eventLog'), eventCount: $('eventCount'), tooltip: $('tooltip'), mapLegend: $('mapLegend'), brushState: $('brushState')
  };

  let cells = [];
  let households = [];
  let month = 0;
  let budget = 235000;
  let monthlyBalance = 0;
  let playing = false;
  let timer = null;
  let selectedTool = 'inspect';
  let selectedLayer = 'landuse';
  let selectedIndex = null;
  let pointerDown = false;
  let lastPaintIndex = null;
  let cssWidth = 1000;
  let cssHeight = 650;
  let dpr = Math.min(2, window.devicePixelRatio || 1);
  let networkDirty = true;
  let roadComponent = new Int32Array(CELL_COUNT);
  let roadAccessCache = new Int32Array(CELL_COUNT);
  let roadNetworkVersion = 0;
  let marketIndex = 1;
  let eventModifiers = { jobs: 1, migration: 1, pollution: 1 };
  let eventTTL = 0;
  let previousPopulation = 0;
  let currentMetrics = null;
  let demands = { residential: 55, commercial: 50, industrial: 48, office: 42 };
  let history = [];
  let events = [];
  let commuteCache = new Map();

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const idx = (x, y) => y * GRID + x;
  const xy = i => ({ x: i % GRID, y: Math.floor(i / GRID) });
  const manhattan = (a, b) => {
    if (a < 0 || b < 0) return 999;
    const p = xy(a), q = xy(b);
    return Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
  };
  const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const fmtMoney = value => `${value < 0 ? '−' : ''}¥${Math.abs(Math.round(value)).toLocaleString('ja-JP')}`;
  const currentDateLabel = () => `${START_YEAR + Math.floor(month / 12)}年${(month % 12) + 1}月`;

  function makeCell(kind = 'empty') {
    return {
      kind,
      level: 0,
      developed: false,
      residents: 0,
      jobsUsed: 0,
      landValue: 45,
      pollution: 0,
      traffic: 0,
      happiness: 55,
      rent: 0,
      roadComponent: -1,
      demandPressure: 0
    };
  }

  function resetState() {
    cells = Array.from({ length: CELL_COUNT }, () => makeCell('empty'));
    households = [];
    month = 0;
    budget = 235000;
    monthlyBalance = 0;
    marketIndex = 1;
    eventModifiers = { jobs: 1, migration: 1, pollution: 1 };
    eventTTL = 0;
    events = [];
    history = [];
    selectedIndex = null;
    networkDirty = true;
    previousPopulation = 0;
    demands = { residential: 55, commercial: 50, industrial: 48, office: 42 };
    els.incomeTax.value = '9';
    els.propertyTax.value = '1.2';
    els.policyTransit.checked = false;
    els.policyAffordable.checked = false;
    els.policyGreen.checked = false;
    buildStarterCity();
    rebuildRoadNetwork();
    seedStarterHouseholds();
    runEconomyPass(true);
    previousPopulation = currentMetrics.population;
    pushHistory();
    addEvent('新都市計画が開始されました。道路接続と雇用のバランスを維持しながら人口3,000人を目指してください。', 'good');
  }

  function setCellKind(i, kind, developed = false, level = 0) {
    const next = makeCell(kind);
    next.developed = developed;
    next.level = level;
    cells[i] = next;
    networkDirty = true;
  }

  function buildStarterCity() {
    const roadLines = [8, 17, 26];
    for (let y = 4; y <= 31; y++) roadLines.forEach(x => setCellKind(idx(x, y), 'road'));
    for (let x = 4; x <= 31; x++) [8, 17, 26].forEach(y => setCellKind(idx(x, y), 'road'));

    const zoneRect = (x0, y0, x1, y1, kind, chance, level = 1) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = idx(x, y);
        if (cells[i].kind !== 'empty') continue;
        const developed = Math.random() < chance;
        setCellKind(i, kind, developed, developed ? level : 0);
      }
    };
    zoneRect(9, 9, 16, 16, 'residential', .60, 1);
    zoneRect(18, 9, 25, 16, 'commercial', .45, 1);
    zoneRect(9, 18, 16, 25, 'residential', .55, 1);
    zoneRect(18, 18, 25, 25, 'office', .36, 1);
    zoneRect(27, 18, 31, 25, 'industrial', .58, 1);
    zoneRect(4, 18, 7, 25, 'residential', .35, 1);

    setCellKind(idx(13, 13), 'park');
    setCellKind(idx(13, 22), 'park');
    setCellKind(idx(12, 12), 'school');
    setCellKind(idx(12, 21), 'hospital');
    setCellKind(idx(18, 18), 'station');
  }

  function residentialCapacity(i) {
    const c = cells[i];
    return c.kind === 'residential' && c.developed ? BUILDING_CAPACITY.residential[c.level] : 0;
  }

  function jobCapacity(i) {
    const c = cells[i];
    if (!c.developed || !['commercial','industrial','office'].includes(c.kind)) return 0;
    return Math.round(BUILDING_CAPACITY[c.kind][c.level] * eventModifiers.jobs);
  }

  function seedStarterHouseholds() {
    const homes = cells.map((c, i) => residentialCapacity(i) > 0 ? i : -1).filter(i => i >= 0);
    let target = Math.min(180, homes.reduce((s, i) => s + residentialCapacity(i), 0));
    while (households.length < target && households.length < MAX_HOUSEHOLDS) {
      const home = pick(homes.filter(i => cells[i].residents < residentialCapacity(i)));
      if (home === undefined) break;
      const h = createHousehold(home);
      households.push(h);
      cells[home].residents++;
    }
  }

  function createHousehold(home) {
    const sizeRoll = Math.random();
    const size = sizeRoll < .18 ? 1 : sizeRoll < .55 ? 2 : sizeRoll < .82 ? 3 : sizeRoll < .95 ? 4 : 5;
    const workers = size === 1 ? (Math.random() < .78 ? 1 : 0) : Math.min(2, Math.max(1, Math.round(size * rand(.35, .55))));
    const education = Math.random() < .28 ? 2 : Math.random() < .62 ? 1 : 0;
    const baseIncome = education === 2 ? rand(105, 175) : education === 1 ? rand(75, 125) : rand(48, 88);
    return { home, size, workers, education, income: baseIncome, work: -1, satisfaction: 60, commute: 0, transit: false, employedWorkers: 0, stress: 0 };
  }

  function neighbors4(i) {
    const { x, y } = xy(i);
    const out = [];
    if (x > 0) out.push(i - 1);
    if (x < GRID - 1) out.push(i + 1);
    if (y > 0) out.push(i - GRID);
    if (y < GRID - 1) out.push(i + GRID);
    return out;
  }

  function nearby(i, radius, predicate) {
    const { x, y } = xy(i);
    let score = 0;
    for (let yy = Math.max(0, y - radius); yy <= Math.min(GRID - 1, y + radius); yy++) {
      for (let xx = Math.max(0, x - radius); xx <= Math.min(GRID - 1, x + radius); xx++) {
        const d = Math.abs(xx - x) + Math.abs(yy - y);
        if (d > radius) continue;
        const j = idx(xx, yy);
        const v = predicate(cells[j], j, d);
        if (v) score += typeof v === 'number' ? v : 1;
      }
    }
    return score;
  }

  function rebuildRoadNetwork() {
    if (!networkDirty) return;
    roadComponent = new Int32Array(CELL_COUNT);
    roadComponent.fill(-1);
    roadAccessCache = new Int32Array(CELL_COUNT);
    roadAccessCache.fill(-2);
    let comp = 0;
    const queue = new Int32Array(CELL_COUNT);
    for (let start = 0; start < CELL_COUNT; start++) {
      if (cells[start].kind !== 'road' || roadComponent[start] !== -1) continue;
      let head = 0, tail = 0;
      queue[tail++] = start;
      roadComponent[start] = comp;
      while (head < tail) {
        const cur = queue[head++];
        for (const n of neighbors4(cur)) {
          if (cells[n].kind === 'road' && roadComponent[n] === -1) {
            roadComponent[n] = comp;
            queue[tail++] = n;
          }
        }
      }
      comp++;
    }
    cells.forEach((c, i) => { c.roadComponent = c.kind === 'road' ? roadComponent[i] : -1; });
    networkDirty = false;
    roadNetworkVersion++;
    commuteCache.clear();
  }

  function roadAccess(i) {
    const cached = roadAccessCache[i];
    if (cached !== -2) return cached;
    if (cells[i].kind === 'road') return (roadAccessCache[i] = i);
    const p = xy(i);
    let best = -1, bestDistance = Infinity;
    for (let y = Math.max(0, p.y - 4); y <= Math.min(GRID - 1, p.y + 4); y++) {
      for (let x = Math.max(0, p.x - 4); x <= Math.min(GRID - 1, p.x + 4); x++) {
        const distance = Math.abs(x - p.x) + Math.abs(y - p.y);
        if (distance === 0 || distance > 4) continue;
        const candidate = idx(x, y);
        if (cells[candidate].kind === 'road' && distance < bestDistance) { best = candidate; bestDistance = distance; }
      }
    }
    return (roadAccessCache[i] = best);
  }

  function sameRoadComponent(a, b) {
    const ra = roadAccess(a), rb = roadAccess(b);
    return ra >= 0 && rb >= 0 && roadComponent[ra] >= 0 && roadComponent[ra] === roadComponent[rb];
  }

  function shortestRoadPath(startCell, endCell) {
    const start = roadAccess(startCell), end = roadAccess(endCell);
    if (start < 0 || end < 0 || roadComponent[start] !== roadComponent[end]) return null;
    const key = `${roadNetworkVersion}:${start}:${end}`;
    if (commuteCache.has(key)) return commuteCache.get(key).slice();
    const parent = new Int32Array(CELL_COUNT);
    parent.fill(-1);
    const queue = new Int32Array(CELL_COUNT);
    let head = 0, tail = 0;
    queue[tail++] = start;
    parent[start] = start;
    while (head < tail) {
      const cur = queue[head++];
      if (cur === end) break;
      for (const n of neighbors4(cur)) {
        if (cells[n].kind !== 'road' || parent[n] !== -1) continue;
        parent[n] = cur;
        queue[tail++] = n;
      }
    }
    if (parent[end] === -1) return null;
    const path = [];
    let cur = end;
    while (cur !== start) { path.push(cur); cur = parent[cur]; }
    path.push(start);
    path.reverse();
    if (commuteCache.size > 1200) commuteCache.clear();
    commuteCache.set(key, path.slice());
    return path;
  }

  function hasNearbyFacility(i, kind, radius) {
    return nearby(i, radius, c => c.kind === kind) > 0;
  }

  function transitEligible(home, work) {
    if (!sameRoadComponent(home, work)) return false;
    const h = hasNearbyFacility(home, 'station', 4);
    const w = hasNearbyFacility(work, 'station', 4);
    return h && w;
  }

  function computeEnvironmentalFields() {
    cells.forEach(c => { c.pollution = 0; c.landValue = 42; c.happiness = 55; });
    for (let i = 0; i < CELL_COUNT; i++) {
      const c = cells[i];
      let pollution = 0;
      pollution += nearby(i, 5, (n, _j, d) => n.kind === 'industrial' && n.developed ? Math.max(0, (6 - d)) * n.level * 1.35 : 0);
      pollution += nearby(i, 2, (n, _j, d) => n.kind === 'road' ? Math.max(0, 3 - d) * n.traffic * .055 : 0);
      pollution -= nearby(i, 3, (n, _j, d) => n.kind === 'park' ? Math.max(0, 4 - d) * 1.8 : 0);
      if (els.policyGreen.checked) pollution *= .72;
      pollution *= eventModifiers.pollution;
      c.pollution = clamp(pollution, 0, 100);

      const road = roadAccess(i) >= 0 ? 9 : -16;
      const parks = nearby(i, 4, (n, _j, d) => n.kind === 'park' ? Math.max(0, 5 - d) * 2.2 : 0);
      const school = hasNearbyFacility(i, 'school', 6) ? 8 : 0;
      const health = hasNearbyFacility(i, 'hospital', 7) ? 7 : 0;
      const transit = hasNearbyFacility(i, 'station', 5) ? (els.policyTransit.checked ? 13 : 9) : 0;
      const retail = nearby(i, 3, (n, _j, d) => n.kind === 'commercial' && n.developed ? Math.max(0, 4 - d) * .7 : 0);
      const industryPenalty = nearby(i, 3, n => n.kind === 'industrial' && n.developed ? 3 : 0);
      c.landValue = clamp(38 + road + parks + school + health + transit + retail - industryPenalty - c.pollution * .42 - c.traffic * .08, 10, 150);
    }
  }

  function clearOccupancyAndTraffic() {
    cells.forEach(c => { c.residents = 0; c.jobsUsed = 0; c.traffic = 0; c.demandPressure = 0; });
    for (const h of households) if (h.home >= 0 && cells[h.home]) cells[h.home].residents++;
  }

  function findBestWork(h) {
    if (!h.workers) return { work: -1, employed: 0 };
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < CELL_COUNT; i++) {
      const c = cells[i];
      const capacity = jobCapacity(i);
      const available = capacity - c.jobsUsed;
      if (available <= 0) continue;
      if (!['commercial','industrial','office'].includes(c.kind) || !c.developed) continue;
      if (h.education < JOB_EDU[c.kind]) continue;
      if (!sameRoadComponent(h.home, i)) continue;
      const path = shortestRoadPath(h.home, i);
      if (!path) continue;
      const wage = WAGES[c.kind] * (1 + h.education * .12);
      const score = wage - path.length * 1.45 + Math.random() * 8;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best < 0 && h.education > 0) {
      const original = h.education;
      h.education = 0;
      const fallback = findBestWork(h);
      h.education = original;
      return fallback;
    }
    if (best < 0) return { work: -1, employed: 0 };
    const employed = Math.min(h.workers, Math.max(0, jobCapacity(best) - cells[best].jobsUsed));
    return { work: best, employed };
  }

  function assignJobsAndTraffic() {
    let transitTrips = 0;
    let totalTrips = 0;
    const shuffled = households.slice().sort(() => Math.random() - .5);
    for (const h of shuffled) {
      if (h.home < 0 || !cells[h.home]) continue;
      const currentValid = h.work >= 0 && jobCapacity(h.work) - cells[h.work].jobsUsed > 0 && sameRoadComponent(h.home, h.work) && h.education >= JOB_EDU[cells[h.work].kind];
      let work = h.work;
      let employed = 0;
      if (currentValid) {
        employed = Math.min(h.workers, jobCapacity(work) - cells[work].jobsUsed);
      }
      if (!currentValid || employed <= 0 || Math.random() < .10) {
        const match = findBestWork(h);
        work = match.work;
        employed = match.employed;
      }
      h.work = work;
      h.employedWorkers = employed;
      h.transit = false;
      h.commute = employed ? 90 : 0;
      if (work < 0 || employed <= 0) continue;
      cells[work].jobsUsed += employed;
      const path = shortestRoadPath(h.home, work);
      if (!path) { h.work = -1; h.employedWorkers = 0; continue; }
      totalTrips += employed;
      const useTransit = transitEligible(h.home, work) && Math.random() < (els.policyTransit.checked ? .72 : .48);
      h.transit = useTransit;
      if (useTransit) transitTrips += employed;
      const carFactor = useTransit ? (els.policyTransit.checked ? .14 : .27) : 1;
      for (const r of path) cells[r].traffic += employed * carFactor;
      h.commute = path.length * (useTransit ? (els.policyTransit.checked ? 1.55 : 1.9) : 2.25) + (useTransit ? 6 : 0);
    }
    for (const c of cells) if (c.kind === 'road') c.traffic = clamp((c.traffic / ROAD_CAPACITY) * 100, 0, 180);
    return { transitShare: totalTrips ? transitTrips / totalTrips : 0 };
  }

  function updateHouseholdEconomics(allowLeave = true) {
    let leavers = 0;
    for (const h of households) {
      if (h.home < 0 || !cells[h.home]) continue;
      const home = cells[h.home];
      const grossIncome = h.employedWorkers * h.income;
      const tax = grossIncome * (Number(els.incomeTax.value) / 100);
      let rent = home.rent || computeRent(h.home);
      if (els.policyAffordable.checked) rent *= .82;
      const rentBurden = grossIncome > 0 ? rent / (grossIncome * 2.1) : 1;
      const school = hasNearbyFacility(h.home, 'school', 6) ? 1 : 0;
      const health = hasNearbyFacility(h.home, 'hospital', 7) ? 1 : 0;
      const park = hasNearbyFacility(h.home, 'park', 4) ? 1 : 0;
      const unemploymentPenalty = h.workers ? (1 - h.employedWorkers / h.workers) * 28 : 0;
      h.satisfaction = clamp(
        56 + (home.landValue - 50) * .16 + park * 7 + school * 5 + health * 5
        - home.pollution * .34 - Math.max(0, h.commute - 30) * .22 - rentBurden * 22
        - Number(els.incomeTax.value) * .48 - unemploymentPenalty,
        0, 100
      );
      home.happiness += (h.satisfaction - home.happiness) * .28;
      const stressDelta = h.satisfaction < 35 ? 1 : h.satisfaction > 52 ? -1 : -.25;
      h.stress = clamp((h.stress || 0) + stressDelta, 0, 12);
      if (allowLeave && ((h.stress >= 4 && Math.random() < .14) || (grossIncome <= 0 && h.stress >= 3 && Math.random() < .08))) h._leave = true;
      else h._leave = false;
      if (h._leave) leavers++;
      h.netIncome = Math.max(0, grossIncome - tax - rent);
    }
    if (leavers) {
      households = households.filter(h => !h._leave);
      if (leavers >= 3) addEvent(`${leavers}世帯が住宅費・雇用・生活環境を理由に市外へ転出しました。`, 'warn');
    }
  }

  function computeRent(i) {
    const c = cells[i];
    if (c.kind !== 'residential' || !c.developed) return 0;
    const occupancy = residentialCapacity(i) ? c.residents / residentialCapacity(i) : 0;
    const base = 34 + c.landValue * .53 + c.level * 8;
    c.rent = clamp(base * (0.82 + occupancy * .36), 28, 150);
    return c.rent;
  }

  function computeMetrics(transitShare = 0) {
    const population = households.reduce((s, h) => s + h.size, 0);
    const workers = households.reduce((s, h) => s + h.workers, 0);
    const employed = households.reduce((s, h) => s + h.employedWorkers, 0);
    const jobs = cells.reduce((s, _c, i) => s + jobCapacity(i), 0);
    const jobsUsed = cells.reduce((s, c) => s + c.jobsUsed, 0);
    const housingCapacity = cells.reduce((s, _c, i) => s + residentialCapacity(i), 0);
    const occupiedHomes = households.length;
    const happiness = avg(households.map(h => h.satisfaction));
    const commute = avg(households.filter(h => h.employedWorkers > 0).map(h => h.commute));
    const trafficRoads = cells.filter(c => c.kind === 'road');
    const traffic = trafficRoads.length ? avg(trafficRoads.map(c => Math.min(100, c.traffic))) : 0;
    const developed = cells.filter(c => c.developed || ['park','school','hospital','station'].includes(c.kind));
    const landValue = developed.length ? avg(developed.map(c => c.landValue)) : 0;
    const pollution = developed.length ? avg(developed.map(c => c.pollution)) : 0;
    const schoolCovered = households.filter(h => hasNearbyFacility(h.home, 'school', 6)).length;
    const healthCovered = households.filter(h => hasNearbyFacility(h.home, 'hospital', 7)).length;
    const totalRent = households.reduce((s, h) => s + computeRent(h.home), 0);
    return {
      population, workers, employed, employment: workers ? employed / workers : 1,
      jobs, jobsUsed, vacantJobs: Math.max(0, jobs - jobsUsed), housingCapacity,
      vacancy: housingCapacity ? Math.max(0, 1 - occupiedHomes / housingCapacity) : 1,
      happiness, commute, traffic, landValue, pollution, transitShare,
      schoolCoverage: households.length ? schoolCovered / households.length : 0,
      healthCoverage: households.length ? healthCovered / households.length : 0,
      totalRent
    };
  }

  function computeDemand(metrics) {
    const taxDrag = (Number(els.incomeTax.value) - 8) * 2.1 + (Number(els.propertyTax.value) - 1.2) * 5;
    const employmentGap = clamp((metrics.vacantJobs - Math.max(0, metrics.workers - metrics.employed)) / 8, -25, 25);
    const residentialRents = [];
    for (let i = 0; i < CELL_COUNT; i++) {
      const c = cells[i];
      if (c.kind === 'residential' && c.developed) residentialRents.push(c.rent || computeRent(i));
    }
    const affordability = clamp(70 - avg(residentialRents) * .5, -20, 30);
    const educatedShare = households.length ? households.filter(h => h.education >= 1).length / households.length : .4;
    demands.residential = clamp(48 + employmentGap + (metrics.happiness - 55) * .65 + affordability * .35 - taxDrag + (els.policyAffordable.checked ? 7 : 0), 0, 100);
    demands.commercial = clamp(38 + metrics.population / 45 + metrics.happiness * .22 - metrics.vacantJobs * .05 - taxDrag * .7, 0, 100);
    demands.industrial = clamp(52 * marketIndex + (1 - metrics.employment) * 30 - metrics.pollution * .22 - taxDrag * .45 - (els.policyGreen.checked ? 8 : 0), 0, 100);
    demands.office = clamp(28 + metrics.population / 65 + educatedShare * 33 + metrics.landValue * .12 - taxDrag * .65, 0, 100);
  }

  function developZones() {
    const candidates = [];
    for (let i = 0; i < CELL_COUNT; i++) {
      const c = cells[i];
      if (!['residential','commercial','industrial','office'].includes(c.kind)) continue;
      if (roadAccess(i) < 0) continue;
      const demand = demands[c.kind];
      if (!c.developed) {
        const chance = clamp((demand - 42) / 180 + c.landValue / 1800, 0, .33);
        if (Math.random() < chance) candidates.push({ i, type: 'build', score: demand + c.landValue * .2 });
      } else if (c.level < 3) {
        const occupancy = c.kind === 'residential'
          ? (residentialCapacity(i) ? c.residents / residentialCapacity(i) : 0)
          : (jobCapacity(i) ? c.jobsUsed / jobCapacity(i) : 0);
        const threshold = c.kind === 'residential' ? .72 : .58;
        const chance = demand > 62 && c.landValue > 55 && occupancy > threshold ? .055 + (demand - 60) / 900 : 0;
        if (Math.random() < chance) candidates.push({ i, type: 'upgrade', score: demand + c.landValue * .3 });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const limit = clamp(1 + Math.floor(currentMetrics.population / 900), 1, 5);
    for (const item of candidates.slice(0, limit)) {
      const c = cells[item.i];
      if (item.type === 'build') { c.developed = true; c.level = 1; }
      else c.level++;
    }
  }

  function findHousingForNewHousehold(h) {
    let best = -1, bestScore = -Infinity;
    for (let i = 0; i < CELL_COUNT; i++) {
      const c = cells[i];
      const cap = residentialCapacity(i);
      if (!cap || c.residents >= cap || roadAccess(i) < 0) continue;
      const rent = computeRent(i);
      const affordability = h.income * Math.max(1, h.workers);
      const score = c.landValue * .55 - c.pollution * .5 - rent / Math.max(35, affordability) * 24 + (hasNearbyFacility(i, 'station', 4) ? 8 : 0) + Math.random() * 8;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  function migrateHouseholds() {
    const base = Math.round((demands.residential - 45) / 8 * eventModifiers.migration);
    const arrivals = clamp(base + Math.floor(rand(-2, 4)), 0, 14);
    let added = 0;
    for (let n = 0; n < arrivals && households.length < MAX_HOUSEHOLDS; n++) {
      const probe = createHousehold(-1);
      const home = findHousingForNewHousehold(probe);
      if (home < 0) break;
      probe.home = home;
      households.push(probe);
      cells[home].residents++;
      added++;
    }
    if (added >= 5) addEvent(`${added}世帯が雇用機会と住宅供給を求めて転入しました。`, 'good');
  }

  function householdRelocation() {
    for (const h of households) {
      if (h.home < 0 || !cells[h.home]) continue;
      if (h.satisfaction >= 48 && Math.random() > .035) continue;
      const current = h.home;
      const target = findHousingForNewHousehold(h);
      if (target < 0 || target === current) continue;
      const currentScore = cells[current].landValue - computeRent(current) * .25 - cells[current].pollution * .4;
      const targetScore = cells[target].landValue - computeRent(target) * .25 - cells[target].pollution * .4 - manhattan(current, target) * .5;
      if (targetScore > currentScore + 5) {
        h.home = target;
      }
    }
  }

  function computeBudget(metrics) {
    const incomeBase = households.reduce((s, h) => s + h.income * h.employedWorkers, 0);
    const incomeTaxRevenue = incomeBase * (Number(els.incomeTax.value) / 100) * 3.0;
    const propertyBase = cells.reduce((s, c) => s + (c.developed ? c.landValue * Math.max(1, c.level) : 0), 0);
    const propertyRevenue = propertyBase * (Number(els.propertyTax.value) / 100) * 5.0;
    const roadCost = cells.filter(c => c.kind === 'road').length * UPKEEP.road;
    const parkCost = cells.filter(c => c.kind === 'park').length * UPKEEP.park;
    const schoolCost = cells.filter(c => c.kind === 'school').length * UPKEEP.school;
    const hospitalCost = cells.filter(c => c.kind === 'hospital').length * UPKEEP.hospital;
    const stationCost = cells.filter(c => c.kind === 'station').length * UPKEEP.station;
    const transitPolicy = els.policyTransit.checked ? 4000 : 0;
    const affordablePolicy = els.policyAffordable.checked ? households.length * 8 : 0;
    monthlyBalance = incomeTaxRevenue + propertyRevenue - roadCost - parkCost - schoolCost - hospitalCost - stationCost - transitPolicy - affordablePolicy;
    budget += monthlyBalance;
    if (budget < -60000) {
      budget = -60000;
      if (month % 6 === 0) addEvent('財政危機です。新規建設を抑え、税率または都市規模を見直してください。', 'bad');
    }
  }

  function maybeRandomEvent() {
    if (eventTTL > 0) {
      eventTTL--;
      if (eventTTL === 0) {
        eventModifiers = { jobs: 1, migration: 1, pollution: 1 };
        marketIndex = 1;
        addEvent('一時的な外部ショックが収束し、市場環境が平常化しました。', 'good');
      }
      return;
    }
    if (Math.random() > .035) return;
    const r = Math.random();
    eventTTL = 8 + Math.floor(Math.random() * 8);
    if (r < .25) {
      marketIndex = 1.24; eventModifiers.jobs = 1.12; eventModifiers.migration = 1.15;
      addEvent('地域景気が拡大。企業投資と転入需要が一時的に高まります。', 'good');
    } else if (r < .50) {
      marketIndex = .78; eventModifiers.jobs = .88; eventModifiers.migration = .78;
      addEvent('景気後退。企業の採用余力と転入需要が低下しています。', 'bad');
    } else if (r < .75) {
      eventModifiers.pollution = 1.32;
      addEvent('大気停滞が発生。工業地域と幹線道路周辺で汚染影響が増幅します。', 'warn');
    } else {
      eventModifiers.migration = 1.35;
      addEvent('近隣地域から人口流入。住宅需要が急増しています。', 'good');
    }
  }

  function runEconomyPass(initial = false) {
    rebuildRoadNetwork();
    clearOccupancyAndTraffic();
    computeEnvironmentalFields();
    const commuteInfo = assignJobsAndTraffic();
    computeEnvironmentalFields();
    updateHouseholdEconomics(false);
    clearOccupancyAndTraffic();
    const commuteInfo2 = assignJobsAndTraffic();
    computeEnvironmentalFields();
    currentMetrics = computeMetrics((commuteInfo.transitShare + commuteInfo2.transitShare) / 2);
    computeDemand(currentMetrics);
    if (!initial) {
      developZones();
      migrateHouseholds();
      householdRelocation();
      clearOccupancyAndTraffic();
      const finalCommute = assignJobsAndTraffic();
      computeEnvironmentalFields();
      updateHouseholdEconomics();
      currentMetrics = computeMetrics(finalCommute.transitShare);
      computeDemand(currentMetrics);
      computeBudget(currentMetrics);
    }
    updateUI();
  }

  function simulateMonth() {
    if (budget <= -60000 && Math.random() < .2) {
      addEvent('債務上限に達しているため、一部の都市投資が停止しています。', 'bad');
    }
    month++;
    maybeRandomEvent();
    runEconomyPass(false);
    if (month % 3 === 0) pushHistory();
  }

  function addEvent(message, type = '') {
    events.unshift({ month, message, type });
    events = events.slice(0, 30);
    renderEvents();
  }

  function toolCost(kind) { return COSTS[kind] || 0; }

  function canReplace(kind, oldKind) {
    if (kind === 'inspect') return false;
    if (kind === 'bulldoze') return oldKind !== 'empty';
    return oldKind === 'empty' || ['residential','commercial','industrial','office'].includes(oldKind);
  }

  function placeTool(i) {
    if (selectedTool === 'inspect') { selectedIndex = i; updateSelectedCell(); draw(); return; }
    const c = cells[i];
    if (!canReplace(selectedTool, c.kind)) return;
    if (selectedTool === 'bulldoze') {
      if (budget < COSTS.bulldoze) { addEvent('撤去費用が不足しています。', 'bad'); return; }
      const affected = households.filter(h => h.home === i).length;
      budget -= COSTS.bulldoze;
      households = households.filter(h => h.home !== i);
      for (const h of households) if (h.work === i) { h.work = -1; h.employedWorkers = 0; }
      setCellKind(i, 'empty');
      if (affected) addEvent(`${affected}世帯が再開発による立退きで市外へ転出しました。`, 'warn');
    } else {
      const cost = toolCost(selectedTool);
      if (budget < cost) { addEvent(`${KIND_LABEL[selectedTool]}の建設資金が不足しています。`, 'bad'); return; }
      budget -= cost;
      const displaced = households.filter(h => h.home === i).length;
      if (displaced) households = households.filter(h => h.home !== i);
      for (const h of households) if (h.work === i) { h.work = -1; h.employedWorkers = 0; }
      const isZone = ['residential','commercial','industrial','office'].includes(selectedTool);
      setCellKind(i, selectedTool, false, isZone ? 0 : 0);
      if (displaced) addEvent(`${displaced}世帯が再開発で転出しました。`, 'warn');
    }
    selectedIndex = i;
    runEconomyPass(true);
  }

  function pointerToCell(event) {
    const rect = canvas.getBoundingClientRect();
    const x = clamp(Math.floor((event.clientX - rect.left) / rect.width * GRID), 0, GRID - 1);
    const y = clamp(Math.floor((event.clientY - rect.top) / rect.height * GRID), 0, GRID - 1);
    return { i: idx(x, y), x, y, localX: event.clientX - rect.left, localY: event.clientY - rect.top };
  }

  function setTool(tool) {
    selectedTool = tool;
    els.palette.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    els.brushState.textContent = tool === 'inspect' ? '調査モード' : `${KIND_LABEL[tool] || '撤去'}を配置`;
    canvas.style.cursor = tool === 'inspect' ? 'help' : 'crosshair';
  }

  function setLayer(layer) {
    selectedLayer = layer;
    els.layerTabs.querySelectorAll('[data-layer]').forEach(b => b.classList.toggle('active', b.dataset.layer === layer));
    updateMapLegend();
    draw();
  }

  function heatColor(value, min, max, hueA, hueB, sat = 68, light = 48) {
    const t = clamp((value - min) / Math.max(.0001, max - min), 0, 1);
    const hue = hueA + (hueB - hueA) * t;
    return `hsl(${hue} ${sat}% ${light}%)`;
  }

  function cellFill(c) {
    if (selectedLayer === 'traffic') {
      if (c.kind === 'road') return heatColor(Math.min(100, c.traffic), 0, 100, 142, 2, 72, 49);
      return '#101a26';
    }
    if (selectedLayer === 'value') return heatColor(c.landValue, 15, 130, 210, 42, 68, 48);
    if (selectedLayer === 'pollution') return heatColor(c.pollution, 0, 80, 145, 350, 66, 46);
    if (selectedLayer === 'happiness') return heatColor(c.happiness, 20, 90, 2, 135, 65, 45);
    if (c.developed && BUILDING_COLORS[c.kind]) return BUILDING_COLORS[c.kind][Math.max(0, c.level - 1)];
    return BASE_COLORS[c.kind];
  }

  function drawBuildingGlyph(c, px, py, cw, ch) {
    if (selectedLayer !== 'landuse') return;
    if (c.kind === 'road') {
      const alpha = clamp(c.traffic / 100, 0, .65);
      if (alpha > .05) { ctx.fillStyle = `rgba(255,189,88,${alpha})`; ctx.fillRect(px + cw*.42, py, cw*.16, ch); }
      return;
    }
    if (c.developed && ['residential','commercial','industrial','office'].includes(c.kind)) {
      ctx.fillStyle = 'rgba(5,12,20,.35)';
      const pad = cw * .18;
      ctx.fillRect(px + pad, py + pad, cw - pad*2, ch - pad*2);
      ctx.fillStyle = 'rgba(255,255,255,.36)';
      const floors = c.level;
      for (let f = 0; f < floors; f++) ctx.fillRect(px + cw*.28, py + ch*(.68 - f*.14), cw*.44, Math.max(1, ch*.06));
    } else if (['park','school','hospital','station'].includes(c.kind)) {
      ctx.fillStyle = 'rgba(255,255,255,.88)';
      ctx.font = `800 ${Math.max(8, cw*.36)}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const glyph = c.kind === 'park' ? 'P' : c.kind === 'school' ? 'S' : c.kind === 'hospital' ? '+' : 'T';
      ctx.fillText(glyph, px + cw/2, py + ch/2 + .5);
    }
  }

  function draw() {
    if (!cells.length) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cw = cssWidth / GRID, ch = cssHeight / GRID;
    ctx.save();
    ctx.scale(dpr, dpr);
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const i = idx(x, y), c = cells[i], px = x*cw, py = y*ch;
        ctx.fillStyle = cellFill(c);
        ctx.fillRect(px, py, cw + .35, ch + .35);
        if (selectedLayer === 'landuse' && ['residential','commercial','industrial','office'].includes(c.kind) && !c.developed) {
          ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = .7;
          ctx.strokeRect(px + 1.2, py + 1.2, Math.max(0,cw-2.4), Math.max(0,ch-2.4));
        }
        drawBuildingGlyph(c, px, py, cw, ch);
      }
    }
    if (selectedIndex !== null) {
      const p = xy(selectedIndex);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.strokeRect(p.x*cw + 1.5, p.y*ch + 1.5, Math.max(0,cw-3), Math.max(0,ch-3));
    }
    ctx.restore();
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    cssWidth = Math.max(320, rect.width);
    cssHeight = Math.max(320, rect.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(cssWidth*dpr), h = Math.round(cssHeight*dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    resizeHistory();
    draw(); drawHistory();
  }

  function resizeHistory() {
    const rect = historyCanvas.getBoundingClientRect();
    const w = Math.max(280, rect.width), h = Math.max(120, rect.height);
    const nw = Math.round(w*dpr), nh = Math.round(h*dpr);
    if (historyCanvas.width !== nw || historyCanvas.height !== nh) { historyCanvas.width = nw; historyCanvas.height = nh; }
  }

  function pushHistory() {
    if (!currentMetrics) return;
    history.push({ population: currentMetrics.population, happiness: currentMetrics.happiness, traffic: currentMetrics.traffic, budget });
    if (history.length > HISTORY_LIMIT) history.shift();
    drawHistory();
  }

  function drawHistory() {
    if (!history.length) return;
    const rect = historyCanvas.getBoundingClientRect();
    const w = Math.max(280, rect.width), h = Math.max(120, rect.height);
    historyCtx.clearRect(0,0,historyCanvas.width,historyCanvas.height);
    historyCtx.save(); historyCtx.scale(dpr,dpr);
    historyCtx.strokeStyle = 'rgba(255,255,255,.055)'; historyCtx.lineWidth = 1;
    for (let k=1;k<4;k++){ const y=h*k/4; historyCtx.beginPath(); historyCtx.moveTo(0,y); historyCtx.lineTo(w,y); historyCtx.stroke(); }
    const series = [
      { key:'population', color:'#66a7ff' }, { key:'happiness', color:'#6bd9a2' }, { key:'traffic', color:'#f0a35f' }, { key:'budget', color:'#c68bff' }
    ];
    for (const s of series) {
      const vals = history.map(v => v[s.key]);
      const min = Math.min(...vals), max = Math.max(...vals);
      historyCtx.strokeStyle = s.color; historyCtx.lineWidth = 1.7; historyCtx.beginPath();
      vals.forEach((v, i) => {
        const x = vals.length === 1 ? 0 : i/(vals.length-1)*(w-4)+2;
        const t = max === min ? .5 : (v-min)/(max-min);
        const y = h - (t*(h-18)+9);
        if (i===0) historyCtx.moveTo(x,y); else historyCtx.lineTo(x,y);
      });
      historyCtx.stroke();
    }
    historyCtx.restore();
  }

  function updateMapLegend() {
    if (selectedLayer === 'landuse') {
      const kinds = ['residential','commercial','industrial','office','road','park','school','hospital','station'];
      els.mapLegend.innerHTML = kinds.map(k => `<span class="legend-item"><i class="legend-dot" style="background:${BASE_COLORS[k]}"></i>${KIND_LABEL[k]}</span>`).join('');
    } else {
      const label = selectedLayer === 'traffic' ? '低交通 → 高渋滞' : selectedLayer === 'value' ? '低地価 → 高地価' : selectedLayer === 'pollution' ? '低汚染 → 高汚染' : '低幸福 → 高幸福';
      els.mapLegend.innerHTML = `<span>${label}</span>`;
    }
  }

  function updateUI() {
    if (!currentMetrics) return;
    const m = currentMetrics;
    els.date.textContent = currentDateLabel();
    els.population.textContent = Math.round(m.population).toLocaleString('ja-JP');
    const delta = m.population - previousPopulation;
    els.populationDelta.textContent = `${delta > 0 ? '+' : ''}${delta}人 / 前回`;
    els.populationDelta.style.color = delta > 0 ? '#72dca4' : delta < 0 ? '#ef8c91' : '';
    previousPopulation = m.population;
    els.budget.textContent = fmtMoney(budget);
    els.budget.style.color = budget < 0 ? '#ff9fa5' : '';
    els.balance.textContent = `収支 ${fmtMoney(monthlyBalance)}/月`;
    els.balance.style.color = monthlyBalance < 0 ? '#ef8c91' : '#8eddb0';
    els.happiness.textContent = m.happiness.toFixed(1);
    els.employment.textContent = `${(m.employment*100).toFixed(1)}%`;
    els.jobs.textContent = `${Math.round(m.jobsUsed)} / ${Math.round(m.jobs)} jobs`;
    els.commute.textContent = m.commute.toFixed(1);
    els.traffic.textContent = m.traffic.toFixed(1);
    els.landValue.textContent = m.landValue.toFixed(1);
    els.pollution.textContent = m.pollution.toFixed(1);
    els.housingCapacity.textContent = Math.round(m.housingCapacity).toLocaleString('ja-JP');
    els.vacancy.textContent = `${(m.vacancy*100).toFixed(1)}%`;
    els.vacantJobs.textContent = Math.round(m.vacantJobs).toLocaleString('ja-JP');
    els.transitShare.textContent = `${(m.transitShare*100).toFixed(1)}%`;
    els.schoolCoverage.textContent = `${(m.schoolCoverage*100).toFixed(0)}%`;
    els.healthCoverage.textContent = `${(m.healthCoverage*100).toFixed(0)}%`;
    els.incomeTaxLabel.textContent = `${els.incomeTax.value}%`;
    els.propertyTaxLabel.textContent = `${Number(els.propertyTax.value).toFixed(1)}%`;
    updateDemandUI(); updateSelectedCell(); updateMissions(); renderEvents(); draw(); drawHistory();
  }

  function updateDemandUI() {
    const pairs = [
      ['residential',els.demandR,els.demandRLabel],['commercial',els.demandC,els.demandCLabel],['industrial',els.demandI,els.demandILabel],['office',els.demandO,els.demandOLabel]
    ];
    for (const [k,bar,label] of pairs) { bar.style.width = `${demands[k]}%`; label.textContent = Math.round(demands[k]); }
    const strongest = Object.entries(demands).sort((a,b)=>b[1]-a[1])[0];
    els.demandExplanation.textContent = `${ZONE_LABEL[strongest[0]]}の需要が最も高い状態です。道路接続、空室・求人、税率、幸福度、地価を変えると需要も変化します。`;
  }

  function updateSelectedCell() {
    if (selectedIndex === null) { els.selectedCoord.textContent='—'; els.cellDetails.className='detail-stack muted'; els.cellDetails.textContent='マップ上の地点を調査してください。'; return; }
    const c = cells[selectedIndex], p=xy(selectedIndex);
    els.selectedCoord.textContent = `(${p.x+1}, ${p.y+1})`;
    const cap = residentialCapacity(selectedIndex), jobs = jobCapacity(selectedIndex);
    const road = roadAccess(selectedIndex);
    const rows = [
      ['用途', KIND_LABEL[c.kind]],
      ['開発状態', ['residential','commercial','industrial','office'].includes(c.kind) ? (c.developed ? `Lv.${c.level}` : '未開発') : '—'],
      ['道路接続', road >= 0 ? `接続 (系統${roadComponent[road]+1})` : '未接続'],
      ['住民', cap ? `${c.residents} / ${cap}世帯` : '—'],
      ['雇用', jobs ? `${c.jobsUsed} / ${jobs}` : '—'],
      ['家賃', c.kind==='residential'&&c.developed ? computeRent(selectedIndex).toFixed(1) : '—'],
      ['地価', c.landValue.toFixed(1)],
      ['汚染', c.pollution.toFixed(1)],
      ['交通負荷', c.kind==='road' ? c.traffic.toFixed(1) : '—'],
      ['幸福度', c.happiness.toFixed(1)]
    ];
    els.cellDetails.className='detail-stack';
    els.cellDetails.innerHTML = rows.map(([a,b])=>`<div class="detail-row"><span>${a}</span><b>${b}</b></div>`).join('');
  }

  function updateMissions() {
    const m = currentMetrics;
    const missions = [
      { title:'人口3,000人', detail:`現在 ${Math.round(m.population).toLocaleString('ja-JP')}人`, done:m.population>=3000 },
      { title:'幸福度72以上', detail:`現在 ${m.happiness.toFixed(1)}`, done:m.happiness>=72 },
      { title:'渋滞35未満', detail:`現在 ${m.traffic.toFixed(1)}`, done:m.traffic<35 && m.population>900 },
      { title:'黒字財政', detail:`月次 ${fmtMoney(monthlyBalance)}`, done:monthlyBalance>0 && m.population>900 }
    ];
    const done = missions.filter(x=>x.done).length;
    els.missionScore.textContent = `${done} / ${missions.length}`;
    els.missions.innerHTML = missions.map(m=>`<div class="mission ${m.done?'done':''}"><span class="check">${m.done?'✓':'•'}</span><span><b>${m.title}</b><small>${m.detail}</small></span></div>`).join('');
  }

  function renderEvents() {
    els.eventCount.textContent = `${events.length}件`;
    els.eventLog.innerHTML = events.length ? events.map(e=>`<div class="event ${e.type}"><time>${START_YEAR+Math.floor(e.month/12)}年${(e.month%12)+1}月</time><p>${e.message}</p></div>`).join('') : '<div class="muted">まだイベントはありません。</div>';
  }

  function saveGame() {
    const payload = { cells, households, month, budget, monthlyBalance, marketIndex, eventModifiers, eventTTL, history, events,
      settings:{ incomeTax:els.incomeTax.value, propertyTax:els.propertyTax.value, transit:els.policyTransit.checked, affordable:els.policyAffordable.checked, green:els.policyGreen.checked } };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    addEvent('都市データをこのブラウザに保存しました。', 'good');
  }

  function loadGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { addEvent('保存データがありません。', 'warn'); return; }
    try {
      const s = JSON.parse(raw);
      cells = s.cells; households = s.households; month=s.month; budget=s.budget; monthlyBalance=s.monthlyBalance||0;
      marketIndex=s.marketIndex||1; eventModifiers=s.eventModifiers||{jobs:1,migration:1,pollution:1}; eventTTL=s.eventTTL||0; history=s.history||[]; events=s.events||[];
      els.incomeTax.value=s.settings?.incomeTax||'9'; els.propertyTax.value=s.settings?.propertyTax||'1.2';
      els.policyTransit.checked=!!s.settings?.transit; els.policyAffordable.checked=!!s.settings?.affordable; els.policyGreen.checked=!!s.settings?.green;
      networkDirty=true; rebuildRoadNetwork(); runEconomyPass(true); addEvent('保存した都市を読み込みました。', 'good');
    } catch { addEvent('保存データの読み込みに失敗しました。', 'bad'); }
  }

  function setPlaying(next) {
    playing = next;
    els.play.textContent = playing ? '❚❚ 一時停止' : '▶ 再生';
    els.simBadge.textContent = playing ? '実行中' : '停止中';
    els.simBadge.classList.toggle('running', playing);
    restartTimer();
  }

  function restartTimer() {
    if (timer) clearInterval(timer);
    timer=null;
    if (!playing) return;
    const speed=Number(els.speed.value);
    timer=setInterval(simulateMonth, Math.max(90, 920/speed));
  }

  function hardReset() {
    setPlaying(false);
    resetState();
    resizeCanvas();
    updateMapLegend();
    updateUI();
  }

  els.palette.addEventListener('click', e => { const b=e.target.closest('[data-tool]'); if(b) setTool(b.dataset.tool); });
  els.layerTabs.addEventListener('click', e => { const b=e.target.closest('[data-layer]'); if(b) setLayer(b.dataset.layer); });
  els.play.addEventListener('click',()=>setPlaying(!playing));
  els.step.addEventListener('click',simulateMonth);
  els.reset.addEventListener('click',hardReset);
  els.save.addEventListener('click',saveGame);
  els.load.addEventListener('click',loadGame);
  els.speed.addEventListener('input',()=>{ els.speedLabel.textContent=`${els.speed.value}×`; restartTimer(); });
  [els.incomeTax,els.propertyTax,els.policyTransit,els.policyAffordable,els.policyGreen].forEach(el=>el.addEventListener('input',()=>{ runEconomyPass(true); }));

  canvas.addEventListener('pointerdown', e => { pointerDown=true; canvas.setPointerCapture?.(e.pointerId); const p=pointerToCell(e); lastPaintIndex=null; placeTool(p.i); lastPaintIndex=p.i; });
  canvas.addEventListener('pointermove', e => {
    const p=pointerToCell(e), c=cells[p.i];
    els.tooltip.hidden=false; els.tooltip.style.left=`${p.localX}px`; els.tooltip.style.top=`${p.localY}px`;
    els.tooltip.innerHTML=`<strong>${KIND_LABEL[c.kind]}${c.developed?` Lv.${c.level}`:''}</strong><br>地価 ${c.landValue.toFixed(0)} / 汚染 ${c.pollution.toFixed(0)}${c.kind==='road'?`<br>交通負荷 ${c.traffic.toFixed(0)}`:''}`;
    if (pointerDown && selectedTool!=='inspect' && p.i!==lastPaintIndex) { placeTool(p.i); lastPaintIndex=p.i; }
  });
  const endPointer=()=>{ pointerDown=false; lastPaintIndex=null; };
  canvas.addEventListener('pointerup',endPointer); canvas.addEventListener('pointercancel',endPointer); canvas.addEventListener('pointerleave',()=>{ els.tooltip.hidden=true; endPointer(); });

  if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(canvas); else window.addEventListener('resize',resizeCanvas);

  resetState();
  updateMapLegend();
  requestAnimationFrame(()=>{ resizeCanvas(); updateUI(); });
})();
