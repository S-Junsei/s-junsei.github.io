function el(tag, attrs = {}, children = []) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  children.forEach(child => node.appendChild(child));
  return node;
}

function addText(svg, x, y, text, cls = 'label', anchor = 'start') {
  const t = el('text', { x, y, class: cls, 'text-anchor': anchor });
  t.textContent = text;
  svg.appendChild(t);
  return t;
}

function makeCanvas(targetId, width = 520, height = 380) {
  const root = document.getElementById(targetId);
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': targetId });
  root.appendChild(svg);
  svg.appendChild(el('rect', { x: 0, y: 0, width, height, rx: 24, class: 'svg-bg' }));
  return svg;
}

function mapPoint(x, y, ox = 90, oy = 310, sx = 80, sy = 40) {
  return [ox + x * sx, oy - y * sy];
}

function drawPoint(svg, x, y, labelText, cls = 'point') {
  svg.appendChild(el('circle', { cx: x, cy: y, r: 5.5, class: cls }));
  addText(svg, x + 10, y - 10, labelText, 'label');
}

function drawRightAngle(svg, x, y, dirX, dirY, size = 14) {
  const p1 = [x + dirX * size, y];
  const p2 = [x + dirX * size, y + dirY * size];
  const p3 = [x, y + dirY * size];
  svg.appendChild(el('path', { d: `M ${x} ${y} L ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]} L ${p3[0]} ${p3[1]}`, class: 'right-angle' }));
}

function drawArc(svg, cx, cy, r, startDeg, endDeg, cls = 'angle-arc') {
  const toRad = deg => deg * Math.PI / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg > startDeg ? 1 : 0;
  svg.appendChild(el('path', { d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`, class: cls }));
}

function note(svg, x, y, lines) {
  const width = 175;
  const height = 24 + lines.length * 18;
  svg.appendChild(el('rect', { x, y, width, height, rx: 12, class: 'note-box' }));
  lines.forEach((line, i) => addText(svg, x + 12, y + 22 + i * 18, line, 'note-text'));
}

function drawSetup() {
  const svg = makeCanvas('diagram-setup');
  const A = mapPoint(0, 6), B = mapPoint(0, 0), C = mapPoint(2, 0), D = mapPoint(1.8, 0.6);
  const center = mapPoint(1, 0);
  const radius = 80;

  svg.appendChild(el('line', { x1: B[0], y1: B[1], x2: A[0], y2: A[1], class: 'main-line' }));
  svg.appendChild(el('line', { x1: B[0], y1: B[1], x2: C[0], y2: C[1], class: 'main-line' }));
  svg.appendChild(el('line', { x1: A[0], y1: A[1], x2: C[0], y2: C[1], class: 'main-line' }));
  svg.appendChild(el('circle', { cx: center[0], cy: center[1], r: radius, class: 'circle-line' }));
  svg.appendChild(el('line', { x1: A[0], y1: A[1], x2: D[0], y2: D[1], class: 'highlight' }));
  svg.appendChild(el('line', { x1: D[0], y1: D[1], x2: C[0], y2: C[1], class: 'highlight-2' }));
  drawRightAngle(svg, B[0], B[1], 1, -1, 16);

  drawPoint(svg, A[0], A[1], 'A');
  drawPoint(svg, B[0], B[1], 'B');
  drawPoint(svg, C[0], C[1], 'C');
  drawPoint(svg, D[0], D[1], 'D', 'point-special');

  addText(svg, 110, 115, 'AB = 6', 'sub-label');
  addText(svg, 155, 325, 'BC = 2', 'sub-label');
  addText(svg, 170, 170, 'AC = 2√10', 'sub-label');
  addText(svg, 230, 250, 'CD = √10 / 5', 'sub-label');
  note(svg, 300, 38, ['AB は円への接線', '⇒ AB² = AD・AC', '⇒ CD = AC - AD']);
}

function drawE() {
  const svg = makeCanvas('diagram-e');
  const A = mapPoint(0, 6), B = mapPoint(0, 0), C = mapPoint(2, 0), E = mapPoint(4.5, 0);

  svg.appendChild(el('polygon', { points: `${A[0]},${A[1]} ${B[0]},${B[1]} ${E[0]},${E[1]}`, class: 'soft-fill' }));
  svg.appendChild(el('line', { x1: B[0], y1: B[1], x2: A[0], y2: A[1], class: 'main-line' }));
  svg.appendChild(el('line', { x1: A[0], y1: A[1], x2: E[0], y2: E[1], class: 'main-line' }));
  svg.appendChild(el('line', { x1: B[0], y1: B[1], x2: E[0], y2: E[1], class: 'main-line' }));
  svg.appendChild(el('line', { x1: A[0], y1: A[1], x2: C[0], y2: C[1], class: 'highlight' }));

  drawPoint(svg, A[0], A[1], 'A');
  drawPoint(svg, B[0], B[1], 'B');
  drawPoint(svg, C[0], C[1], 'C', 'point-special');
  drawPoint(svg, E[0], E[1], 'E', 'point-special');

  drawArc(svg, A[0], A[1], 34, 90, 40);
  drawArc(svg, A[0], A[1], 52, 90, 15);
  addText(svg, 115, 120, 'AC が ∠BAE を二等分', 'sub-label');
  addText(svg, 176, 322, 'BC = 2', 'sub-label');
  addText(svg, 340, 322, 'CE = 5/2', 'sub-label');
  addText(svg, 258, 160, 'AE = 15/2', 'sub-label');
  note(svg, 298, 52, ['BC : CE = BA : AE', '2 : CE = 6 : AE', '⇒ AE = 3CE']);
}

function drawF() {
  const svg = makeCanvas('diagram-f');
  const A = mapPoint(0, 6), B = mapPoint(0, 0), D = mapPoint(1.8, 0.6), E = mapPoint(4.5, 0), F = mapPoint(3.6, 1.2), C = mapPoint(2, 0);

  svg.appendChild(el('polygon', { points: `${A[0]},${A[1]} ${B[0]},${B[1]} ${D[0]},${D[1]}`, class: 'soft-fill' }));
  svg.appendChild(el('polygon', { points: `${A[0]},${A[1]} ${D[0]},${D[1]} ${F[0]},${F[1]}`, class: 'soft-fill-2' }));

  svg.appendChild(el('line', { x1: A[0], y1: A[1], x2: C[0], y2: C[1], class: 'main-line' }));
  svg.appendChild(el('line', { x1: A[0], y1: A[1], x2: E[0], y2: E[1], class: 'main-line' }));
  svg.appendChild(el('line', { x1: B[0], y1: B[1], x2: F[0], y2: F[1], class: 'main-line' }));
  svg.appendChild(el('line', { x1: A[0], y1: A[1], x2: D[0], y2: D[1], class: 'highlight' }));
  svg.appendChild(el('line', { x1: D[0], y1: D[1], x2: F[0], y2: F[1], class: 'highlight-2' }));

  drawRightAngle(svg, D[0], D[1], -1, -1, 12);
  drawArc(svg, A[0], A[1], 34, 90, 18);
  drawArc(svg, A[0], A[1], 34, 18, -20);

  drawPoint(svg, A[0], A[1], 'A');
  drawPoint(svg, B[0], B[1], 'B');
  drawPoint(svg, C[0], C[1], 'C');
  drawPoint(svg, D[0], D[1], 'D', 'point-special');
  drawPoint(svg, E[0], E[1], 'E');
  drawPoint(svg, F[0], F[1], 'F', 'point-special');

  addText(svg, 110, 112, '∠BAD = ∠DAF', 'sub-label');
  addText(svg, 278, 195, 'DF = BD', 'sub-label');
  addText(svg, 308, 225, '⇒ DF / FB = 1 / 2', 'sub-label');
  note(svg, 296, 44, ['△ABD ≡ △AFD', 'AD 共通', '直角 + 1つの角']);
}

function drawG() {
  const svg = makeCanvas('diagram-g');
  const A = mapPoint(0, 6), B = mapPoint(0, 0), E = mapPoint(4.5, 0), G = mapPoint(0, 2.25), I = mapPoint(1.03, 2.44);

  svg.appendChild(el('polygon', { points: `${A[0]},${A[1]} ${B[0]},${B[1]} ${E[0]},${E[1]}`, class: 'soft-fill' }));
  svg.appendChild(el('line', { x1: B[0], y1: B[1], x2: A[0], y2: A[1], class: 'main-line' }));
  svg.appendChild(el('line', { x1: A[0], y1: A[1], x2: E[0], y2: E[1], class: 'main-line' }));
  svg.appendChild(el('line', { x1: B[0], y1: B[1], x2: E[0], y2: E[1], class: 'main-line' }));
  svg.appendChild(el('line', { x1: E[0], y1: E[1], x2: G[0], y2: G[1], class: 'highlight' }));

  drawArc(svg, E[0], E[1], 32, 180, 127);
  drawArc(svg, E[0], E[1], 48, 180, 127);

  drawPoint(svg, A[0], A[1], 'A');
  drawPoint(svg, B[0], B[1], 'B');
  drawPoint(svg, E[0], E[1], 'E');
  drawPoint(svg, G[0], G[1], 'G', 'point-special');
  drawPoint(svg, I[0], I[1], 'I', 'point-special');

  addText(svg, 112, 220, 'AG = 5', 'sub-label');
  addText(svg, 112, 300, 'GB = 3', 'sub-label');
  addText(svg, 260, 162, 'AE = 15/2', 'sub-label');
  addText(svg, 270, 310, 'EB = 9/2', 'sub-label');
  note(svg, 295, 46, ['EI は ∠AEB の二等分線', 'AG : GB = AE : EB', '= 5 : 3']);
}

function drawVolume() {
  const svg = makeCanvas('diagram-volume', 520, 400);
  const B = [80, 295], C = [220, 315], D = [270, 225], G = [60, 195], Fp = [355, 108];

  svg.appendChild(el('polygon', { points: `${B[0]},${B[1]} ${C[0]},${C[1]} ${D[0]},${D[1]} ${G[0]},${G[1]}`, class: 'base-polygon' }));
  svg.appendChild(el('polygon', { points: `${Fp[0]},${Fp[1]} ${B[0]},${B[1]} ${C[0]},${C[1]}`, class: 'side-triangle' }));
  svg.appendChild(el('polygon', { points: `${Fp[0]},${Fp[1]} ${C[0]},${C[1]} ${D[0]},${D[1]}`, class: 'side-triangle' }));
  svg.appendChild(el('polygon', { points: `${Fp[0]},${Fp[1]} ${D[0]},${D[1]} ${G[0]},${G[1]}`, class: 'side-triangle' }));
  svg.appendChild(el('polygon', { points: `${Fp[0]},${Fp[1]} ${G[0]},${G[1]} ${B[0]},${B[1]}`, class: 'side-triangle' }));
  svg.appendChild(el('line', { x1: Fp[0], y1: Fp[1], x2: D[0], y2: D[1], class: 'height-line' }));

  drawPoint(svg, B[0], B[1], 'B');
  drawPoint(svg, C[0], C[1], 'C');
  drawPoint(svg, D[0], D[1], 'D');
  drawPoint(svg, G[0], G[1], 'G');
  drawPoint(svg, Fp[0], Fp[1], 'F′', 'point-special');

  addText(svg, 325, 170, '高さ = DF′ = 3√10 / 5', 'sub-label');
  addText(svg, 85, 168, '底面 BCDG', 'sub-label');
  note(svg, 290, 34, ['底面積 = 21 / 8', '高さ = 3√10 / 5', 'V = (1/3) × 底面積 × 高さ', '= 21√10 / 40']);
}

window.addEventListener('DOMContentLoaded', () => {
  drawSetup();
  drawE();
  drawF();
  drawG();
  drawVolume();
});
