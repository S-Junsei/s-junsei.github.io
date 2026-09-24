import { EMPTY, GROUP_A, GROUP_B, SchellingModel } from './model.js';
import { drawHistoryChart } from './chart.js';

const $ = (id) => document.getElementById(id);

const els = {
  board: $('boardCanvas'),
  history: $('historyCanvas'),
  thresholdRange: $('thresholdRange'),
  thresholdValue: $('thresholdValue'),
  sizeRange: $('sizeRange'),
  sizeValue: $('sizeValue'),
  vacancyRange: $('vacancyRange'),
  vacancyValue: $('vacancyValue'),
  groupARange: $('groupARange'),
  groupAValue: $('groupAValue'),
  speedRange: $('speedRange'),
  speedValue: $('speedValue'),
  neighborhood: $('neighborhoodSelect'),
  moveStrategy: $('moveStrategySelect'),
  wrap: $('wrapCheckbox'),
  seed: $('seedInput'),
  newSeed: $('newSeedButton'),
  reset: $('resetButton'),
  step: $('stepButton'),
  play: $('playButton'),
  round: $('roundMetric'),
  satisfaction: $('satisfactionMetric'),
  similarity: $('similarityMetric'),
  unhappy: $('unhappyMetric'),
  moves: $('movesMetric'),
  status: $('statusLine'),
  interpretation: $('interpretationText'),
  inspectorEmpty: $('inspectorEmpty'),
  inspectorContent: $('inspectorContent'),
  residentBadge: $('residentBadge'),
  residentStatus: $('residentStatus'),
  residentPosition: $('residentPosition'),
  sameCount: $('sameCount'),
  otherCount: $('otherCount'),
  emptyCount: $('emptyCount'),
  residentSimilarity: $('residentSimilarity'),
  residentFormula: $('residentFormula'),
};

let model;
let history = [];
let timer = null;
let selectedIndex = -1;
let lastMoves = 0;

const percent = (value, digits = 0) => `${(value * 100).toFixed(digits)}%`;

function readConfig() {
  return {
    size: Number(els.sizeRange.value),
    vacancyRate: Number(els.vacancyRange.value) / 100,
    groupARatio: Number(els.groupARange.value) / 100,
    threshold: Number(els.thresholdRange.value) / 100,
    neighborhood: els.neighborhood.value,
    moveStrategy: els.moveStrategy.value,
    wrap: els.wrap.checked,
    seed: els.seed.value.trim() || 'schelling',
  };
}

function syncLabels() {
  els.thresholdValue.textContent = `${els.thresholdRange.value}%`;
  els.sizeValue.textContent = `${els.sizeRange.value}×${els.sizeRange.value}`;
  els.vacancyValue.textContent = `${els.vacancyRange.value}%`;
  els.groupAValue.textContent = `${els.groupARange.value}%`;
  els.speedValue.textContent = `${els.speedRange.value} round/s`;
}

function resetModel() {
  stop();
  selectedIndex = -1;
  lastMoves = 0;
  model = new SchellingModel(readConfig());
  history = [model.metrics()];
  syncLabels();
  renderAll();
  els.status.textContent = '初期配置を生成しました。まず「1ラウンド進める」を押して変化を観察してください。';
}

function updateModelRulesWithoutReset() {
  if (!model) return;
  model.configure({
    threshold: Number(els.thresholdRange.value) / 100,
    neighborhood: els.neighborhood.value,
    moveStrategy: els.moveStrategy.value,
    wrap: els.wrap.checked,
  });
  history = [...history.slice(0, -1), model.metrics()];
  renderAll();
}

function setupBoardCanvas() {
  const canvas = els.board;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const size = Math.max(280, Math.floor(Math.min(rect.width, rect.height || rect.width)));
  const pixelSize = Math.max(1, Math.floor(size * dpr));

  if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
    canvas.width = pixelSize;
    canvas.height = pixelSize;
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, size };
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  ctx.beginPath();

  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  const r = Math.min(Math.max(radius, 0), Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawBoard() {
  const { ctx, size } = setupBoardCanvas();
  const n = model.size;
  const cell = size / n;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#eef1f4';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < model.board.length; i += 1) {
    const type = model.board[i];
    const { x, y } = model.coords(i);
    const px = x * cell;
    const py = y * cell;
    const gap = Math.max(0.7, cell * 0.08);
    const radius = Math.max(1.6, cell * 0.16);

    roundedRectPath(ctx, px + gap, py + gap, cell - gap * 2, cell - gap * 2, radius);
    ctx.fillStyle = type === GROUP_A ? '#2166d1' : type === GROUP_B ? '#e15445' : '#dfe4ea';
    ctx.fill();

    if (type !== EMPTY && !model.isSatisfied(i)) {
      ctx.strokeStyle = '#f3a712';
      ctx.lineWidth = Math.max(1.2, cell * 0.11);
      ctx.stroke();
    }
  }

  if (selectedIndex >= 0) {
    const { x, y } = model.coords(selectedIndex);
    ctx.strokeStyle = '#18212a';
    ctx.lineWidth = Math.max(2, cell * 0.12);
    ctx.strokeRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);

    for (const neighbor of model.neighborIndices(selectedIndex)) {
      const c = model.coords(neighbor);
      ctx.fillStyle = 'rgba(24,33,42,.14)';
      ctx.fillRect(c.x * cell, c.y * cell, cell, cell);
    }
  }
}

function renderMetrics() {
  const m = model.metrics();
  els.round.textContent = m.round;
  els.satisfaction.textContent = percent(m.satisfactionRate, 1);
  els.similarity.textContent = percent(m.meanSimilarity, 1);
  els.unhappy.textContent = m.unhappy.toLocaleString('ja-JP');
  els.moves.textContent = `累計移動 ${m.totalMoves.toLocaleString('ja-JP')}（前回 ${lastMoves}）`;

  const initial = history[0];
  const delta = m.meanSimilarity - initial.meanSimilarity;
  if (m.round === 0) {
    els.interpretation.textContent = `初期状態の平均同類率は ${percent(m.meanSimilarity, 1)}。条件を変えずにラウンドを進め、局所的な移動だけでこの値がどう変わるか見てください。`;
  } else {
    const sign = delta >= 0 ? '+' : '';
    els.interpretation.textContent = `初期状態と比べ、平均同類率は ${sign}${(delta * 100).toFixed(1)}ポイント。満足率は ${percent(m.satisfactionRate, 1)} です。`;
  }
}

function renderInspector() {
  if (selectedIndex < 0 || model.board[selectedIndex] === EMPTY) {
    els.inspectorEmpty.hidden = false;
    els.inspectorContent.hidden = true;
    return;
  }

  const type = model.board[selectedIndex];
  const stats = model.neighborStats(selectedIndex, type);
  const satisfied = stats.similarity >= model.threshold;
  const { x, y } = model.coords(selectedIndex);

  els.inspectorEmpty.hidden = true;
  els.inspectorContent.hidden = false;
  els.residentBadge.textContent = type === GROUP_A ? 'A' : 'B';
  els.residentBadge.style.background = type === GROUP_A ? '#2166d1' : '#e15445';
  els.residentStatus.textContent = satisfied ? '満足している' : '不満を感じている';
  els.residentStatus.style.color = satisfied ? '#2e7d32' : '#b56b00';
  els.residentPosition.textContent = `列 ${x + 1}・行 ${y + 1}`;
  els.sameCount.textContent = stats.same;
  els.otherCount.textContent = stats.other;
  els.emptyCount.textContent = stats.empty;
  els.residentSimilarity.textContent = percent(stats.similarity, 0);

  if (stats.occupied === 0) {
    els.residentFormula.textContent = '周囲に他の住民がいないため、この実装では同類率を100%として満足と扱います。';
  } else {
    els.residentFormula.textContent = `${stats.same} ÷ (${stats.same} + ${stats.other}) = ${percent(stats.similarity, 0)}。必要条件 ${percent(model.threshold, 0)} と比較して判定します。空き地 ${stats.empty} マスは分母に入りません。`;
  }
}

function renderAll() {
  drawBoard();
  renderMetrics();
  renderInspector();
  drawHistoryChart(els.history, history);
}

function advanceOne() {
  const result = model.step();
  lastMoves = result.moves;
  history.push(result.metrics);
  if (history.length > 500) history.shift();
  renderAll();

  if (result.metrics.unhappy === 0) {
    els.status.textContent = `全住民が満足しました。${result.metrics.round} ラウンドで停止。`;
    stop();
  } else if (result.moves === 0) {
    els.status.textContent = `不満な住民は ${result.metrics.unhappy} 人いますが、現在の移動ルールでは動ける場所がありません。`;
    stop();
  } else {
    els.status.textContent = `${result.moves} 人が移動。不満な住民は現在 ${result.metrics.unhappy} 人です。`;
  }
}

function start() {
  if (timer) return;
  const fps = Number(els.speedRange.value);
  timer = window.setInterval(advanceOne, 1000 / fps);
  els.play.textContent = '❚❚ 一時停止';
  els.play.setAttribute('aria-pressed', 'true');
}

function stop() {
  if (timer) window.clearInterval(timer);
  timer = null;
  if (els.play) {
    els.play.textContent = '▶ 連続再生';
    els.play.setAttribute('aria-pressed', 'false');
  }
}

function restartTimerIfNeeded() {
  if (!timer) return;
  stop();
  start();
}

function randomSeed() {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  els.seed.value = `${bytes[0].toString(36)}-${bytes[1].toString(36)}`;
  resetModel();
}

els.board.addEventListener('pointerdown', (event) => {
  const rect = els.board.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * model.size);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * model.size);
  if (x < 0 || y < 0 || x >= model.size || y >= model.size) return;
  const index = model.index(x, y);
  selectedIndex = model.board[index] === EMPTY ? -1 : index;
  renderAll();
});

els.reset.addEventListener('click', resetModel);
els.step.addEventListener('click', () => { stop(); advanceOne(); });
els.play.addEventListener('click', () => (timer ? stop() : start()));
els.newSeed.addEventListener('click', randomSeed);
els.speedRange.addEventListener('input', () => { syncLabels(); restartTimerIfNeeded(); });

for (const input of [els.sizeRange, els.vacancyRange, els.groupARange]) {
  input.addEventListener('input', syncLabels);
  input.addEventListener('change', resetModel);
}

els.seed.addEventListener('change', resetModel);
els.thresholdRange.addEventListener('input', () => { syncLabels(); updateModelRulesWithoutReset(); });
els.neighborhood.addEventListener('change', updateModelRulesWithoutReset);
els.moveStrategy.addEventListener('change', updateModelRulesWithoutReset);
els.wrap.addEventListener('change', updateModelRulesWithoutReset);

document.querySelectorAll('.preset').forEach((button) => {
  button.addEventListener('click', () => {
    els.thresholdRange.value = String(Number(button.dataset.threshold) * 100);
    syncLabels();
    updateModelRulesWithoutReset();
  });
});

window.addEventListener('resize', () => renderAll());
window.addEventListener('beforeunload', stop);

syncLabels();
resetModel();
