// Kalender: Monat / Woche, News, Feiertage, Trades, Analysen
(function (J) {
  const h = J.h;
  const FLAGS = { US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', JP: '🇯🇵', CN: '🇨🇳', HK: '🇭🇰' };
  const IMPACT = { High: 'hi', Medium: 'md', Low: 'lo', Holiday: 'hol' };
  const pref = (() => { try { return JSON.parse(localStorage.getItem('cal-pref')) || {}; } catch { return {}; } })();
  const P = Object.assign({ view: 'month', market: 'all', impacts: ['High', 'Medium'] }, pref);
  const savePref = () => { try { localStorage.setItem('cal-pref', JSON.stringify(P)); } catch { /* egal */ } };

  J.flag = c => FLAGS[c] || c;

  // Daten für einen Zeitraum sammeln
  async function collect(from, to) {
    const years = [...new Set([from.slice(0, 4), to.slice(0, 4)])];
    const [news, ...hol] = await Promise.all([J.api.news(from, to), ...years.map(y => J.api.holidays(Number(y)))]);
    const S = J.store.settings;
    const byDay = {};
    const day = k => (byDay[k] = byDay[k] || { news: [], holidays: [], trades: [], analyses: [] });
    for (const e of news) {
      if (e.impact === 'Holiday') { if (S.newsCurrencies.includes(e.currency)) day(e.time.slice(0, 10)).holidays.push({ name: e.title, country: e.currency, ff: true }); continue; }
      if (!S.newsCurrencies.includes(e.currency)) continue;
      day(e.time.slice(0, 10)).news.push(e);
    }
    for (const x of hol.flat()) if (x.date >= from && x.date <= to) day(x.date).holidays.push({ name: x.name, local: x.localName, country: x.country });
    for (const t of J.store.trades) {
      const k = (t.entryTime || '').slice(0, 10);
      if (k >= from && k <= to && (P.market === 'all' || t.market === P.market)) day(k).trades.push(t);
    }
    for (const a of J.store.analyses) {
      const k = (a.date || '').slice(0, 10);
      if (k >= from && k <= to && (P.market === 'all' || a.market === P.market)) day(k).analyses.push(a);
    }
    for (const d of Object.values(byDay)) {
      d.trades.sort((a, b) => a.entryTime.localeCompare(b.entryTime));
      d.news.sort((a, b) => a.time.localeCompare(b.time));
    }
    return { byDay, raw: news };
  }

  function sumByAccount(trades) {
    const res = {};
    for (const t of trades) {
      const c = J.calc(t);
      if (!c.closed) continue;
      const a = (res[t.account] = res[t.account] || { r: 0, pct: 0, n: 0, l: 0 });
      a.r += c.r; a.pct += c.pct; a.n++; if (c.outcome === 'loss') a.l++;
    }
    return res;
  }

  function tradeChip(t) {
    const c = J.calc(t);
    return h('a', { href: '#/trade/' + t.id, class: 'chip ' + (c.closed ? c.outcome : 'open'), title: `${J.market(t.market).name} · ${t.direction} · ${J.account(t.account).name}` },
      J.marketDot(t.market), `${t.market} ${t.direction === 'short' ? '▼' : '▲'} `, h('b', c.closed ? J.fmtR(c.r) : 'offen'),
      (t.violations || []).length ? h('span.warnmark', { title: 'Regelverstoß' }, ' ⚠') : null);
  }
  function analysisChip(a) {
    return h('a', { href: '#/analyse/' + a.id, class: 'chip ana', title: 'Analyse' }, '📊 ', J.marketDot(a.market), `${a.market} ${J.tf(a.timeframe).name}`);
  }

  // Detailansicht eines Tages
  function dayDetail(key, d) {
    d = d || { news: [], holidays: [], trades: [], analyses: [] };
    const S = J.store.settings;
    const news = d.news.filter(e => P.impacts.includes(e.impact));
    const sums = sumByAccount(d.trades);
    return h('div.daydetail',
      h('div.dd-head', h('h3', J.fmtDate(key)),
        h('div.actions',
          J.btn('+ Trade', () => J.go(`#/trade/neu?day=${key}`), 'small'),
          J.btn('+ Analyse', () => J.go(`#/analyse/neu?day=${key}`), 'small ghost'))),
      d.holidays.length ? h('div.hols', d.holidays.map(x => h('span.hol', `${J.flag(x.country)} ${x.name}`))) : null,
      Object.keys(sums).length ? h('div.daysum', Object.entries(sums).map(([acc, s]) =>
        h('span', `${J.account(acc).name}: `, h('b', { class: J.signClass(s.r) }, `${J.fmtR(s.r)} (${J.fmtPct(s.pct)})`), ` · ${s.n} Trades, ${s.l} Verlust(e)`))) : null,
      d.trades.length ? h('div.dd-sec', h('h4', 'Trades'), h('div.chips', d.trades.map(tradeChip))) : null,
      d.analyses.length ? h('div.dd-sec', h('h4', 'Analysen'), h('div.chips', d.analyses.map(analysisChip))) : null,
      h('div.dd-sec', h('h4', 'News (Forex Factory)'),
        news.length ? h('table.news', h('tbody', news.map(e => h('tr',
          h('td.t', J.fmtTime(e.time)), h('td', h('span', { class: 'imp ' + IMPACT[e.impact], title: e.impact })),
          h('td.cur', e.currency), h('td', e.title),
          h('td.fc', e.forecast ? `Prog. ${e.forecast}` : ''), h('td.fc', e.previous ? `Vorher ${e.previous}` : ''))))) :
          h('div.muted', d.news.length ? 'Keine News mit gewählter Wichtigkeit.' : 'Keine News gespeichert.')),
    );
  }

  function todayStrip(byDay) {
    const key = J.today(), d = byDay[key] || { news: [], trades: [] };
    const S = J.store.settings;
    const high = d.news.filter(e => e.impact === 'High');
    const sums = sumByAccount(d.trades);
    const expired = J.currentAnalyses().filter(a => a.expired);
    const items = [];
    for (const acc of S.accounts) {
      const s = sums[acc.id] || { r: 0, pct: 0, n: 0, l: 0 };
      const stop = s.l >= S.rules.maxLosses || s.pct >= S.rules.dailyTargetPct;
      items.push(h('div', { class: 'ts ' + (stop ? 'stop' : '') },
        h('b', acc.name), ` ${s.n} Trades · ${J.fmtPct(s.pct)} · ${s.l} Verlust(e)`,
        stop ? h('span.badge.neg', ' Schluss für heute') : null));
    }
    if (high.length) items.push(h('div.ts.newsx', '🔴 Heute: ', high.map(e => `${J.fmtTime(e.time)} ${e.currency} ${e.title}`).join(' · ')));
    if (expired.length) items.push(h('a.ts.warn', { href: '#/analysen' }, `⏰ ${expired.length} Analyse(n) abgelaufen – erneuern`));
    const wk = J.weekId(key), rv = J.store.reviews.find(r => r.id === wk);
    if (new Date().getDay() === S.rules.reviewWeekday || new Date().getDay() === 0) {
      if (!rv || !rv.done) items.push(h('a.ts.warn', { href: '#/review/' + wk }, '📝 Regel 10: Wochen-Review machen'));
    }
    return h('div.today', items);
  }

  J.renderCalendar = async (main, params) => {
    const anchor = params.get('d') || (J.readOnly ? window.__SNAPSHOT__.to : J.today());
    const isWeek = P.view === 'week';
    const range = isWeek ? J.weekRange(anchor) : (() => {
      const m = J.monthRange(anchor);
      return { from: J.weekStart(m.from), to: J.addDays(J.weekStart(m.to), 6), month: m };
    })();
    const ad = J.parse(anchor);
    const title = isWeek ? `KW ${J.weekId(anchor).split('-W')[1]} · ${J.fmtShort(range.from)} – ${J.fmtShort(range.to)}${ad.getFullYear()}` : `${J.MON[ad.getMonth()]} ${ad.getFullYear()}`;
    const shift = n => {
      const k = isWeek ? J.addDays(anchor, 7 * n) : J.dateKey(new Date(ad.getFullYear(), ad.getMonth() + n, 1));
      J.go('#/kalender?d=' + k);
    };
    const S = J.store.settings;
    const toolbar = h('div.toolbar',
      J.btn('‹', () => shift(-1), 'ghost'), J.btn('Heute', () => J.go('#/kalender?d=' + J.today()), 'ghost'), J.btn('›', () => shift(1), 'ghost'),
      h('div.seg', [['month', 'Monat'], ['week', 'Woche']].map(([v, l]) => h('button', { type: 'button', class: P.view === v ? 'on' : '', onclick: () => { P.view = v; savePref(); J.render(); } }, l))),
      J.sel(P, 'market', [['all', 'Alle Märkte'], ...S.markets.map(m => [m.id, m.name])], () => { savePref(); J.render(); }),
      h('div.seg', ['High', 'Medium', 'Low'].map(v => h('button', {
        type: 'button', class: (P.impacts.includes(v) ? 'on ' : '') + 'imp-' + IMPACT[v], title: 'News-Wichtigkeit',
        onclick: () => { P.impacts = P.impacts.includes(v) ? P.impacts.filter(x => x !== v) : [...P.impacts, v]; savePref(); J.render(); },
      }, { High: 'Hoch', Medium: 'Mittel', Low: 'Niedrig' }[v]))),
      J.readOnly ? null : J.btn('↻ News', async () => { await J.api.news(range.from, range.to, true); J.render(); J.toast('News aktualisiert'); }, 'ghost small'),
    );
    const body = h('div', h('div.muted', 'Lade …'));
    J.clear(main).append(J.page(title, [toolbar]), body);
    const { byDay } = await collect(range.from, range.to);
    J.clear(body);
    if (!J.readOnly) body.append(todayStrip(byDay));
    const sel = params.get('sel') || (anchor >= range.from && anchor <= range.to ? anchor : null);

    if (isWeek) {
      const days = [...Array(7)].map((_, i) => J.addDays(range.from, i));
      body.append(weekSummary(range.from, range.to), h('div.weekdays', days.map(k => dayDetail(k, byDay[k]))));
      return;
    }
    const grid = h('div.cal');
    ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So', 'Woche'].forEach(d => grid.append(h('div.cal-h', d)));
    const detail = h('div#daydetail');
    for (let wk = range.from; wk <= range.to; wk = J.addDays(wk, 7)) {
      for (let i = 0; i < 7; i++) {
        const k = J.addDays(wk, i), d = byDay[k] || {};
        const inMonth = k >= range.month.from && k <= range.month.to;
        const hi = (d.news || []).filter(e => e.impact === 'High').length;
        const md = (d.news || []).filter(e => e.impact === 'Medium').length;
        const sums = sumByAccount(d.trades || []);
        const tot = Object.values(sums).reduce((s, x) => s + x.r, 0);
        grid.append(h('div', {
          class: `cal-d ${inMonth ? '' : 'out'} ${k === J.today() ? 'today' : ''} ${k === sel ? 'sel' : ''} ${i >= 5 ? 'we' : ''}`,
          onclick: () => J.go(`#/kalender?d=${anchor}&sel=${k}`),
        },
          h('div.cal-top', h('span.dn', J.parse(k).getDate()),
            (d.trades || []).length ? h('span', { class: 'dr ' + J.signClass(tot) }, J.fmtR(tot)) : null),
          (d.holidays || []).length ? h('div.cal-hol', { title: d.holidays.map(x => `${x.country}: ${x.name}`).join('\n') },
            [...new Set(d.holidays.map(x => J.flag(x.country)))].join(' '), ' Feiertag') : null,
          (hi && P.impacts.includes('High')) || (md && P.impacts.includes('Medium')) ? h('div.cal-news',
            hi && P.impacts.includes('High') ? h('span.imp.hi') : null, hi && P.impacts.includes('High') ? `${hi} ` : null,
            md && P.impacts.includes('Medium') ? h('span.imp.md') : null, md && P.impacts.includes('Medium') ? `${md}` : null) : null,
          h('div.cal-items', (d.trades || []).slice(0, 4).map(tradeChip), (d.analyses || []).slice(0, 3).map(analysisChip)),
        ));
      }
      grid.append(weekCell(wk));
    }
    body.append(grid, detail);
    if (sel) {
      detail.append(dayDetail(sel, byDay[sel]));
      if (params.get('sel')) requestAnimationFrame(() => detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }
    else detail.append(h('div.muted.pad', 'Tag anklicken für Details (News, Feiertage, Trades, Analysen).'));
  };

  function weekCell(from) {
    const to = J.addDays(from, 6);
    const S = J.store.settings, wk = J.weekId(from);
    const rv = J.store.reviews.find(r => r.id === wk);
    return h('div.cal-w', { onclick: () => J.go('#/review/' + wk) },
      h('div.muted', 'KW ' + wk.split('-W')[1]),
      S.accounts.map(a => {
        const s = J.stats(J.filterTrades({ from, to, account: a.id, market: P.market }));
        return s.closed ? h('div', { title: a.name }, h('small', a.name.split(' ')[0] + ' '), h('b', { class: J.signClass(s.sumR) }, J.fmtR(s.sumR))) : null;
      }),
      h('div', { class: 'rv ' + (rv && rv.done ? 'done' : '') }, rv && rv.done ? '✓ Review' : 'Review'));
  }

  function weekSummary(from, to) {
    const S = J.store.settings;
    return h('div.kpis', S.accounts.map(a => {
      const s = J.stats(J.filterTrades({ from, to, account: a.id, market: P.market }));
      return J.kpi(a.name, J.fmtR(s.sumR), J.signClass(s.sumR), `${s.closed} Trades · Winrate ${s.winrate == null ? '–' : Math.round(s.winrate) + '%'} · ${J.fmtPct(s.sumPct)}`);
    }), h('a.kpi.link', { href: '#/review/' + J.weekId(from) }, h('div.kpi-l', 'Wochen-Review'), h('div.kpi-v', '📝 öffnen')));
  }

  J.dayNews = async key => J.api.news(key, key);
})(window.J);
