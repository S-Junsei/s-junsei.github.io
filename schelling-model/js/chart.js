function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(280, Math.floor(rect.width));
  const height = Math.max(180, Math.floor(rect.height));
  const pixelWidth = Math.max(1, Math.floor(width * dpr));
  const pixelHeight = Math.max(1, Math.floor(height * dpr));

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

export function drawHistoryChart(canvas, history) {
  const { ctx, width, height } = setupCanvas(canvas);
  const pad = { left: 42, right: 16, top: 18, bottom: 30 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#dfe4ea';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#65707c';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let i = 0; i <= 4; i += 1) {
    const value = i / 4;
    const y = pad.top + plotH * (1 - value);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.fillText(`${Math.round(value * 100)}%`, pad.left - 8, y);
  }

  ctx.strokeStyle = '#aeb7c2';
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, pad.top + plotH);
  ctx.lineTo(width - pad.right, pad.top + plotH);
  ctx.stroke();

  if (history.length <= 1) return;

  const maxRound = Math.max(1, history.at(-1).round);
  const xFor = (round) => pad.left + (round / maxRound) * plotW;
  const yFor = (value) => pad.top + (1 - value) * plotH;

  const drawSeries = (key, strokeStyle) => {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    history.forEach((entry, i) => {
      const x = xFor(entry.round);
      const y = yFor(entry[key]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  drawSeries('satisfactionRate', '#2e7d32');
  drawSeries('meanSimilarity', '#6a48d7');

  ctx.fillStyle = '#65707c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`round ${maxRound}`, width - pad.right - 24, height - pad.bottom + 9);
}
