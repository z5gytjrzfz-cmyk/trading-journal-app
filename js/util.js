// Hilfsfunktionen: DOM-Bau, Formatierung, Datum
window.J = window.J || {};
(function (J) {
  // h('div.klasse#id', {attrs}, ...kinder)
  J.h = function h(sel, attrs, ...kids) {
    const [, tag = 'div', rest = ''] = /^([a-z0-9]*)(.*)$/i.exec(sel);
    const el = document.createElement(tag || 'div');
    rest.replace(/([.#])([\w-]+)/g, (_, t, n) => { if (t === '.') el.classList.add(n); else el.id = n; });
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    let deferredValue;
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'value') deferredValue = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'class') String(v).split(' ').filter(Boolean).forEach(c => el.classList.add(c));
      else if (k in el && k !== 'list' && k !== 'type') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    const add = k => {
      if (k == null || k === false) return;
      if (Array.isArray(k)) k.forEach(add);
      else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    };
    kids.forEach(add);
    if (deferredValue !== undefined) el.value = deferredValue;
    return el;
  };
  const h = J.h;

  J.uid = (prefix) => `${prefix || 'x'}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  J.pad = n => String(n).padStart(2, '0');
  J.dateKey = d => `${d.getFullYear()}-${J.pad(d.getMonth() + 1)}-${J.pad(d.getDate())}`;
  J.nowLocal = () => { const d = new Date(); return `${J.dateKey(d)}T${J.pad(d.getHours())}:${J.pad(d.getMinutes())}`; };
  J.today = () => J.dateKey(new Date());
  J.parse = s => (s ? new Date(s.length === 10 ? s + 'T00:00' : s) : null);
  J.addDays = (key, n) => { const d = J.parse(key); d.setDate(d.getDate() + n); return J.dateKey(d); };
  J.minutesBetween = (a, b) => (a && b ? Math.round((J.parse(b) - J.parse(a)) / 60000) : null);

  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const WDL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  J.WD = WD; J.WDL = WDL; J.MON = MON;
  J.fmtDate = s => { if (!s) return '–'; const d = J.parse(s); return `${WD[d.getDay()]} ${J.pad(d.getDate())}.${J.pad(d.getMonth() + 1)}.${d.getFullYear()}`; };
  J.fmtShort = s => { if (!s) return '–'; const d = J.parse(s); return `${J.pad(d.getDate())}.${J.pad(d.getMonth() + 1)}.`; };
  J.fmtTime = s => (s && s.length > 10 ? s.slice(11, 16) : '');
  J.fmtDateTime = s => (s ? `${J.fmtDate(s)} ${J.fmtTime(s)}` : '–');
  J.fmtDuration = min => {
    if (min == null || isNaN(min)) return '–';
    if (min < 60) return `${min} min`;
    if (min < 60 * 24) return `${Math.floor(min / 60)}h ${J.pad(min % 60)}min`;
    const d = Math.floor(min / 1440), hh = Math.round((min % 1440) / 60);
    return `${d} T ${hh} h`;
  };
  const num = (v, d = 2) => Number(v).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  J.num = num;
  J.fmtR = r => (r == null || isNaN(r) ? '–' : `${r > 0 ? '+' : ''}${num(r, 2)}R`);
  J.fmtPct = p => (p == null || isNaN(p) ? '–' : `${p > 0 ? '+' : ''}${num(p, 2)}%`);
  J.fmtUsd = v => (v == null || isNaN(v) ? '–' : `${v > 0 ? '+' : ''}${num(v, 0)} $`);
  J.signClass = v => (v > 0.0001 ? 'pos' : v < -0.0001 ? 'neg' : 'neu');

  // ISO-Woche
  J.weekId = key => {
    const d = J.parse(key); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const w1 = new Date(d.getFullYear(), 0, 4);
    const wk = 1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
    return `${d.getFullYear()}-W${J.pad(wk)}`;
  };
  J.weekStart = key => { const d = J.parse(key); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return J.dateKey(d); };
  J.weekRange = key => { const from = J.weekStart(key); return { from, to: J.addDays(from, 6) }; };
  J.weekRangeFromId = id => {
    const [y, w] = id.split('-W').map(Number);
    const jan4 = J.dateKey(new Date(y, 0, 4));
    return J.weekRange(J.addDays(J.weekStart(jan4), (w - 1) * 7));
  };
  J.monthRange = key => {
    const d = J.parse(key);
    return { from: J.dateKey(new Date(d.getFullYear(), d.getMonth(), 1)), to: J.dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
  };

  J.esc = s => String(s == null ? '' : s);
  J.toast = (msg, kind) => {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'show ' + (kind || '');
    clearTimeout(J._toastT); J._toastT = setTimeout(() => (t.className = ''), 3200);
  };
  J.clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  J.go = hash => { location.hash = hash; };
  J.byId = (arr, id) => arr.find(x => x.id === id);

  J.lightbox = (src) => {
    const box = h('div.lightbox', { onclick: () => box.remove() }, h('img', { src }));
    document.body.append(box);
  };
  J.confirm = msg => window.confirm(msg);
})(window.J);
