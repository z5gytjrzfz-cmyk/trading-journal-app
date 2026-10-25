// Kleine SVG-Diagramme
(function (J) {
  const NS = 'http://www.w3.org/2000/svg';
  const s = (tag, attrs, ...kids) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    kids.flat().forEach(k => k != null && el.append(k instanceof Node ? k : document.createTextNode(k)));
    return el;
  };

  // Equity-Kurve in R
  J.equityChart = (equity) => {
    const W = 720, H = 220, P = { l: 44, r: 12, t: 12, b: 24 };
    if (!equity.length) return J.h('div.empty', 'Noch keine abgeschlossenen Trades im Zeitraum.');
    const pts = [{ eq: 0 }, ...equity];
    const ys = pts.map(p => p.eq);
    let min = Math.min(0, ...ys), max = Math.max(0, ...ys);
    if (max - min < 1) { max += 0.5; min -= 0.5; }
    const x = i => P.l + (i / (pts.length - 1)) * (W - P.l - P.r);
    const y = v => P.t + ((max - v) / (max - min)) * (H - P.t - P.b);
    const ticks = [];
    const step = Math.max(0.5, Math.ceil((max - min) / 5));
    for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(v);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.eq).toFixed(1)}`).join('');
    const area = `${line}L${x(pts.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
    const last = pts[pts.length - 1].eq;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Equity-Kurve in R' },
      ticks.map(v => [
        s('line', { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v), class: v === 0 ? 'axis0' : 'grid' }),
        s('text', { x: P.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'tick' }, `${v > 0 ? '+' : ''}${v}R`),
      ]),
      s('path', { d: area, class: last >= 0 ? 'area pos' : 'area neg' }),
      s('path', { d: line, class: 'line' }),
      pts.slice(1).map((p, i) => s('circle', { cx: x(i + 1), cy: y(p.eq), r: 3.5, class: p.r >= 0 ? 'dot pos' : 'dot neg' },
        s('title', {}, `${J.fmtDateTime(p.t.entryTime)} · ${p.t.market} · ${J.fmtR(p.r)} → ${J.fmtR(p.eq)}`))),
    );
    return svg;
  };

  // Horizontale Balken (Summe R je Gruppe)
  J.barList = (groups, label) => {
    if (!groups.length) return J.h('div.empty', 'Keine Daten');
    const max = Math.max(...groups.map(g => Math.abs(g.s.sumR)), 0.5);
    return J.h('div.bars', groups.map(g => J.h('div.bar-row',
      J.h('div.bar-label', label ? label(g.key) : g.key),
      J.h('div.bar-track', J.h('div', {
        class: 'bar-fill ' + J.signClass(g.s.sumR),
        style: { width: `${(Math.abs(g.s.sumR) / max) * 50}%`, [g.s.sumR >= 0 ? 'left' : 'right']: '50%' },
      })),
      J.h('div.bar-val', J.h('b', { class: J.signClass(g.s.sumR) }, J.fmtR(g.s.sumR)),
        ` · ${g.s.closed} T · ${g.s.winrate == null ? '–' : Math.round(g.s.winrate) + '%'}`),
    )));
  };
})(window.J);
