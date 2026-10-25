// Trades: Liste und Erfassung (Checkliste, Regel-Wächter, Nachbewertung)
(function (J) {
  const h = J.h;
  const P = { account: 'all', market: 'all', month: '', outcome: 'all' };

  J.tradeTable = (list) => {
    if (!list.length) return h('div.empty', 'Keine Trades.');
    return h('div.scroll', h('table.list', h('thead', h('tr',
      ['Datum', 'Konto', 'Markt', 'Richtung', 'Session', 'Checkliste', 'Ergebnis', '%', 'Haltedauer', 'Regeln'].map(x => h('th', x)))),
    h('tbody', list.map(t => {
      const c = J.calc(t), sc = J.checklistScore(t.checklist);
      const v = t.violations || [];
      return h('tr', { class: 'click', onclick: () => J.go('#/trade/' + t.id) },
        h('td', J.fmtDateTime(t.entryTime)), h('td', J.account(t.account).name),
        h('td', J.marketDot(t.market), t.market, t.aplus ? J.badge('A+', 'aplus') : null),
        h('td', { class: t.direction === 'short' ? 'neg' : 'pos' }, t.direction === 'short' ? '▼ Short' : '▲ Long'),
        h('td.small', c.session || ''), h('td', sc.answered ? `${sc.pct}%` : '–'),
        h('td', J.outcomeBadge(c)), h('td', { class: J.signClass(c.pct) }, c.closed ? J.fmtPct(c.pct) : ''),
        h('td.small', J.fmtDuration(c.holding)),
        h('td', v.length ? h('span.neg', { title: v.map(n => 'Regel ' + n).join(', ') }, `⚠ ${v.map(n => 'R' + n).join(' ')}`) : h('span.pos', '✓')));
    }))));
  };

  J.renderTrades = (main) => {
    const S = J.store.settings;
    const body = h('div');
    const draw = () => {
      let list = J.filterTrades({ account: P.account, market: P.market });
      if (P.month) list = list.filter(t => t.entryTime.startsWith(P.month));
      if (P.outcome !== 'all') list = list.filter(t => J.calc(t).outcome === P.outcome);
      const st = J.stats(list);
      J.clear(body).append(
        h('div.kpis', J.kpi('Trades', st.count, '', `${st.open} offen`), J.kpi('Winrate', st.winrate == null ? '–' : Math.round(st.winrate) + '%', '', `${st.wins} W · ${st.losses} L · ${st.be} BE`),
          J.kpi('Summe R', J.fmtR(st.sumR), J.signClass(st.sumR)), J.kpi('Regelverstöße', st.violations, st.violations ? 'neg' : 'pos')),
        J.card(null, J.tradeTable(list.slice().reverse())));
    };
    const months = [...new Set(J.store.trades.map(t => (t.entryTime || '').slice(0, 7)).filter(Boolean))].sort().reverse();
    J.clear(main).append(J.page('Trades', [
      h('div.toolbar',
        J.sel(P, 'account', [['all', 'Alle Konten'], ...S.accounts.map(a => [a.id, a.name])], draw),
        J.sel(P, 'market', [['all', 'Alle Märkte'], ...S.markets.map(m => [m.id, m.name])], draw),
        J.sel(P, 'month', [['', 'Alle Monate'], ...months.map(m => [m, `${J.MON[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`])], draw),
        J.sel(P, 'outcome', [['all', 'Alle'], ['win', 'Gewinner'], ['loss', 'Verlierer'], ['be', 'Break-Even'], ['open', 'Offen']], draw)),
      J.btn('+ Neuer Trade', () => J.go('#/trade/neu'), 'primary')], body));
    draw();
  };

  // Passende Analysen zum Einstiegszeitpunkt
  function analysesAt(market, time) {
    const res = {};
    for (const a of J.store.analyses) {
      if (a.market !== market || (time && a.date > time)) continue;
      if (!res[a.timeframe] || a.date > res[a.timeframe].date) res[a.timeframe] = a;
    }
    return J.store.settings.timeframes.map(tf => res[tf.id]).filter(Boolean);
  }

  function answerList(questions, store, opts) {
    let lastPhase = null;
    return h('div.qlist', questions.map(q => {
      store[q.id] = store[q.id] || {};
      const head = q.phase && q.phase !== lastPhase ? h('div.qphase', (lastPhase = q.phase)) : null;
      return [head, h('div.q',
        h('div.qt', q.text, q.invert ? h('span.inv', { title: '„Ja“ ist hier negativ' }, ' ⇄') : null),
        h('div.qa', J.seg(store[q.id], 'v', opts.choices, opts.onchange),
          q.detail ? J.inp(store[q.id], 'd', { placeholder: q.detail, class: 'qd' }) : null))];
    }));
  }

  J.renderTrade = async (main, id, params) => {
    const S = J.store.settings;
    let t = id === 'neu' ? null : J.byId(J.store.trades, id);
    if (id !== 'neu' && !t) { J.clear(main).append(h('div.empty', 'Trade nicht gefunden.')); return; }
    const isNew = !t;
    if (isNew) {
      const day = params.get('day');
      const market = params.get('market') || S.markets[0].id;
      const acc = S.accounts[S.accounts.length > 1 ? 1 : 0];
      const entryTime = day && day !== J.today() ? `${day}T09:00` : J.nowLocal();
      t = {
        id: J.uid('trd'), account: acc.id, market, direction: 'long', status: 'closed', entryTime, exitTime: '',
        entry: '', sl: '', tp: '', exit: '', riskPct: acc.riskPct, manualR: '',
        checklist: {}, execution: {}, emotions: {}, reflection: {}, images: [], notes: '',
        analysisIds: analysesAt(market, entryTime).map(a => a.id),
      };
    } else t = JSON.parse(JSON.stringify(t));
    const m = t;
    let news = [];

    const resultBox = h('div.result');
    const rulesBox = h('div.rules-box');
    const scoreBox = h('div.score');
    const analysesBox = h('div');

    const update = () => {
      const c = J.calc(m);
      J.clear(resultBox).append(h('div.kpis.compact',
        J.kpi('Ergebnis', c.r == null ? '–' : J.fmtR(c.r), J.signClass(c.r), m.manualR !== '' && m.manualR != null ? 'manuell' : 'aus Preisen'),
        J.kpi('In %', J.fmtPct(c.pct), J.signClass(c.pct)), J.kpi('In $', J.fmtUsd(c.usd), J.signClass(c.usd)),
        J.kpi('Risiko', `${J.num(c.riskPct, 2)}%`, '', J.fmtUsd(-c.riskUsd).replace('-', '')),
        J.kpi('Geplantes RRR', c.plannedRR == null ? '–' : `1:${J.num(c.plannedRR, 1)}`),
        J.kpi('Haltedauer', J.fmtDuration(c.holding)), J.kpi('Session', c.session || '–', c.session === 'Außerhalb' ? 'neg' : '')));
      const sc = J.checklistScore(m.checklist);
      J.clear(scoreBox).append(
        h('div', { class: 'score-main ' + (sc.answered ? (sc.pct >= S.rules.minChecklist ? 'pos' : 'neg') : 'muted') },
          sc.answered ? `${sc.pct}%` : '–', h('small', ` ${sc.ok}/${sc.total} erfüllt · min. ${S.rules.minChecklist}%`)),
        h('div.score-secs', Object.entries(sc.sections).map(([k, v]) => h('span', `${k}: `, h('b', v.pct == null ? '–' : v.pct + '%')))));
      const rules = J.checkRules(m, news);
      const fails = rules.filter(r => r.status === 'fail').length;
      J.clear(rulesBox).append(
        h('div', { class: 'rules-sum ' + (fails ? 'neg' : 'pos') }, fails ? `⚠ ${fails} Regel(n) verletzt` : '✓ Alle Regeln eingehalten'),
        h('ul.rules', rules.map(r => h('li', { class: r.status },
          h('span.ri', { ok: '✓', warn: '!', fail: '✗', na: '·' }[r.status]),
          h('div', h('b', `Regel ${r.n}`), ' ', h('span.muted', r.text), h('div.rd', r.detail))))));
    };
    const refreshNews = async () => {
      const day = (m.entryTime || '').slice(0, 10);
      news = day ? await J.dayNews(day) : [];
      update();
    };
    const drawAnalyses = () => {
      const list = analysesAt(m.market, m.entryTime);
      m.analysisIds = m.analysisIds || [];
      J.clear(analysesBox).append(list.length ? h('div.checks', list.map(a => h('label.check',
        h('input', { type: 'checkbox', checked: m.analysisIds.includes(a.id), onchange: e => {
          m.analysisIds = e.target.checked ? [...m.analysisIds, a.id] : m.analysisIds.filter(x => x !== a.id);
        } }),
        h('span', `${J.tf(a.timeframe).name} vom ${J.fmtShort(a.date)} `, J.biasBadge(a.bias), a.targetNext ? ` 🎯 ${a.targetNext} ` : ' ',
          h('a', { href: '#/analyse/' + a.id, target: '_blank' }, '↗'))))) :
        h('div.muted', 'Keine Analyse für diesen Markt vorhanden. ', J.link('Analyse anlegen', '#/analyse/neu?market=' + m.market)));
    };

    const onMarket = () => { m.analysisIds = analysesAt(m.market, m.entryTime).map(a => a.id); drawAnalyses(); refreshNews(); };
    const onAccount = () => { m.riskPct = J.account(m.account).riskPct; riskIn.value = m.riskPct; update(); };
    const riskIn = J.inp(m, 'riskPct', { type: 'number', step: '0.05', min: 0 }, update);

    const reflection = m.reflection = m.reflection || {};
    const form = J.lockable(
      J.card('Trade', h('div.grid4',
        J.field('Konto', J.sel(m, 'account', S.accounts.map(a => [a.id, a.name]), onAccount)),
        J.field('Markt', J.sel(m, 'market', S.markets.map(x => [x.id, x.name]), onMarket)),
        J.field('Richtung', J.seg(m, 'direction', [['long', '▲ Long', 'y'], ['short', '▼ Short', 'n']], update)),
        J.field('Status', J.seg(m, 'status', [['open', 'Offen', 'x'], ['closed', 'Geschlossen', 'y']], update)),
      ), h('div.grid4',
        J.field('Einstieg (Zeit)', J.inp(m, 'entryTime', { type: 'datetime-local' }, () => { update(); refreshNews(); drawAnalyses(); })),
        J.field('Ausstieg (Zeit)', J.inp(m, 'exitTime', { type: 'datetime-local' }, update)),
        J.field('Risiko in %', riskIn, 'Swing 1% · Daytrade 0,5%'),
        J.field('A+ Setup', J.chk(m, 'aplus', 'Ausnahme für Regel 1 & 2', update)),
      ), h('div.grid4',
        J.field('Entry', J.inp(m, 'entry', { type: 'number', step: 'any' }, update)),
        J.field('Stop-Loss', J.inp(m, 'sl', { type: 'number', step: 'any' }, update)),
        J.field('Take-Profit', J.inp(m, 'tp', { type: 'number', step: 'any' }, update)),
        J.field('Exit', J.inp(m, 'exit', { type: 'number', step: 'any' }, update)),
      ), h('div.grid4',
        J.field('Ergebnis in R (manuell)', J.inp(m, 'manualR', { type: 'number', step: '0.01', placeholder: 'leer = aus Preisen' }, update), 'z.B. bei Teilschließungen'),
        J.field('Stop-Loss vergrößert?', J.chk(m, 'slWidened', 'Ja, SL wurde vergrößert', update)),
      ), resultBox),
      J.card('Zugehörige Analysen', analysesBox),
      h('div.two',
        J.card('Signifikanz-Checkliste', scoreBox, (() => {
          const secs = {};
          S.checklist.forEach(q => (secs[q.section] = secs[q.section] || []).push(q));
          m.checklist = m.checklist || {};
          return Object.entries(secs).map(([sec, qs]) => h('div.qsec', h('h3', sec), answerList(qs, m.checklist, { choices: J.YNN, onchange: update })));
        })()),
        J.card('Regel-Wächter', rulesBox)),
      J.card('Screenshots', J.imagesField(m)),
      J.card('Nachbewertung · War meine Ausführung richtig?', answerList(S.executionQuestions, m.execution = m.execution || {}, { choices: J.YNP, onchange: update })),
      J.card('Nachbewertung · Habe ich meine Emotionen kontrolliert?', answerList(S.emotionQuestions, m.emotions = m.emotions || {}, { choices: J.YNP })),
      J.card('Reflexion', S.reflectionQuestions.map(q => J.field(q.text, J.txt(reflection, q.id)))),
      J.card('Notizen', J.txt(m, 'notes', { rows: 3, placeholder: 'Freie Notizen, Tags …' })),
    );

    async function save() {
      if (!m.entryTime) return J.toast('Bitte Einstiegszeit eintragen', 'err');
      m.violations = J.violations(m, news);
      m.checklistPct = J.checklistScore(m.checklist).pct;
      await J.api.save('trades', m);
      J.toast(m.violations.length ? `Gespeichert – ⚠ ${m.violations.length} Regelverstoß/-verstöße` : 'Trade gespeichert ✓', m.violations.length ? 'warn' : '');
      if (isNew) J.go('#/trade/' + m.id); else J.render();
    }
    async function del() {
      if (!J.confirm('Trade wirklich löschen? (Er wird in den Papierkorb-Ordner verschoben.)')) return;
      await J.api.remove('trades', m.id);
      J.go('#/trades');
    }
    const title = isNew ? 'Neuer Trade' : `${m.market} ${m.direction === 'short' ? 'Short' : 'Long'} · ${J.fmtDate(m.entryTime)}`;
    J.clear(main).append(J.page(title, [J.link('← Trades', '#/trades', 'btn ghost')], form, J.saveBar(save, isNew ? null : del)));
    drawAnalyses();
    update();
    refreshNews();
  };
})(window.J);
