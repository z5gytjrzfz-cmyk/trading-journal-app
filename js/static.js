// Fertig aufgebaute Ansicht für die Teilen-Datei. Wird angezeigt, wenn kein JavaScript läuft
// (z.B. iPhone-Vorschau aus WhatsApp, Mail, AirDrop oder der Dateien-App).
(function (J) {
  const h = J.h;
  const ANS = { yes: ['✓ Ja', 'pos'], no: ['✗ Nein', 'neg'], partly: ['~ Teils', 'warn'], na: ['n.a.', 'muted'] };

  function answer(q, a) {
    const v = (a || {}).v;
    if (!v) return h('span.muted', '–');
    const [t, cls] = ANS[v] || [v, ''];
    const good = v === 'na' ? 'muted' : ((q.invert ? v === 'no' : v === 'yes') ? 'pos' : v === 'partly' ? 'warn' : 'neg');
    return h('span', { class: good || cls }, t, (a || {}).d ? ` (${a.d})` : '');
  }
  const qa = (questions, store) => h('table.st-qa', h('tbody', questions.map(q => h('tr', h('td', q.text), h('td.nowrap', answer(q, (store || {})[q.id]))))));
  const text = (label, v) => (v ? h('div.st-text', h('b', label), h('p', v)) : null);
  let withImages = true;
  const imgs = list => (withImages && (list || []).length ? h('div.st-imgs', list.map(i => h('figure',
    h('img', { src: J.api.imgUrl(i.file), 'data-file': i.file }), i.caption ? h('figcaption', i.caption) : null))) : null);
  const facts = pairs => h('div.st-facts', pairs.filter(p => p[1] != null && p[1] !== '').map(([k, v]) => h('div', h('span.muted', k), h('b', v))));

  function tradeBlock(t) {
    const S = J.store.settings, c = J.calc(t), sc = J.checklistScore(t.checklist);
    const secs = {};
    S.checklist.forEach(q => (secs[q.section] = secs[q.section] || []).push(q));
    const reflection = S.reflectionQuestions.map(q => text(q.text, (t.reflection || {})[q.id]));
    return h('section.card.st-item', { id: 't-' + t.id },
      h('h3', `${J.fmtDateTime(t.entryTime)} · ${J.market(t.market).name} · ${t.direction === 'short' ? '▼ Short' : '▲ Long'} `,
        J.outcomeBadge(c), t.aplus ? J.badge('A+', 'aplus') : null),
      facts([['Konto', J.account(t.account).name], ['Ergebnis', c.closed ? `${J.fmtR(c.r)} · ${J.fmtPct(c.pct)} · ${J.fmtUsd(c.usd)}` : 'offen'],
        ['Risiko', `${J.num(c.riskPct, 2)}%`], ['Entry', t.entry], ['Stop-Loss', t.sl], ['Take-Profit', t.tp], ['Exit', t.exit],
        ['Geplantes RRR', c.plannedRR == null ? null : `1:${J.num(c.plannedRR, 1)}`], ['Haltedauer', J.fmtDuration(c.holding)],
        ['Session', c.session], ['Checkliste', sc.answered ? `${sc.pct}%` : 'nicht ausgefüllt'],
        ...J.ratingSections(S).map(sec => [`Signifikanz ${sec}`, J.RATING_LABEL[((t.rating || {})[sec] || {}).v] || null])]),
      (t.violations || []).length ? h('div.st-viol', '⚠ Regelverstoß: ', t.violations.map(n => `Regel ${n} – ${S.ruleTexts[n - 1]}`).join(' · ')) : h('div.pos.small', '✓ Regelkonform'),
      imgs(t.images),
      h('details', h('summary', 'Signifikanz-Checkliste'), Object.entries(secs).map(([s, qs]) => [h('h4', s), qa(qs, t.checklist)])),
      h('details', h('summary', 'Nachbewertung: Ausführung & Emotionen'), qa(S.executionQuestions, t.execution), h('h4', 'Emotionen'), qa(S.emotionQuestions, t.emotions)),
      reflection, text('Notizen', t.notes));
  }

  function analysisBlock(a) {
    const tf = J.tf(a.timeframe);
    return h('section.card.st-item', { id: 'a-' + a.id },
      h('h3', `${J.fmtDate(a.date)} · ${J.market(a.market).name} · ${tf.name} `, J.biasBadge(a.bias),
        J.isCurrentAnalysis(a) ? null : J.badge('📦 archiviert')),
      facts([['Gültig bis', J.fmtDate(a.validUntil)], ['Zur übergeordneten TF', a.relation === 'with' ? 'in Richtung' : a.relation === 'against' ? 'gegen' : null],
        ['Lage', a.situation], ['Nächstes Ziel', a.targetNext ? `${a.targetNext}${a.targetNextNote ? ' (' + a.targetNextNote + ')' : ''}` : null],
        ['Zwischenziel', a.targetInter], ['Angelaufenes Ziel', a.runningTarget], ['Preis', a.price]]),
      (a.levels || []).length ? h('table.list.st-levels', h('thead', h('tr', ['Preis / Zone', 'Art', 'Status', 'Notiz'].map(x => h('th', x)))),
        h('tbody', a.levels.map(l => h('tr', h('td', l.price || ''), h('td', l.kind || ''), h('td', l.status || ''), h('td', l.note || ''))))) : null,
      tf.elements.length ? h('ul.st-checks', tf.elements.map((e, i) => h('li', { class: (a.elements || {})[i] ? 'pos' : 'muted' }, (a.elements || {})[i] ? '✓ ' : '○ ', e))) : null,
      (tf.questions || []).filter(q => ['direction', 'area', 'text'].includes(q.kind)).map(q => text(q.text, (a.qa || {})[q.id])),
      text('Leitfrage', a.guideAnswer), text('Theoretische Trades', a.theoretical), text('Fazit', a.summary), imgs(a.images));
  }

  J.buildStaticReport = ({ from, to, account, images }) => {
    withImages = images !== false;
    const S = J.store.settings;
    const trades = J.filterTrades({ from, to, account });
    const linked = new Set(trades.flatMap(t => t.analysisIds || []));
    const analyses = J.store.analyses.filter(a => ((a.date || '').slice(0, 10) >= from && (a.date || '').slice(0, 10) <= to) || linked.has(a.id))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const reviews = J.store.reviews.filter(r => r.from <= to && r.to >= from).sort((a, b) => b.id.localeCompare(a.id));
    const accounts = account && account !== 'all' ? S.accounts.filter(a => a.id === account) : S.accounts;
    const st = J.stats(trades), closed = trades.filter(t => J.calc(t).closed);
    const viol = J.ruleViolationCounts(trades);
    const el = h('div.page.st',
      h('h1', '📈 Trading Journal'),
      h('p.muted', `Nur-Lesen-Ansicht · ${J.fmtDate(from)} – ${J.fmtDate(to)} · ${account && account !== 'all' ? J.account(account).name : 'alle Konten'}`),
      h('p.note.small', 'Am Computer im Browser geöffnet gibt es die volle, klickbare Ansicht mit Kalender und Filtern.'),
      h('nav.st-toc', h('a', { href: '#st-stats' }, 'Auswertung'), h('a', { href: '#st-analyses' }, `Analysen (${analyses.length})`),
        h('a', { href: '#st-trades' }, `Trades (${trades.length})`), h('a', { href: '#st-reviews' }, `Wochen-Reviews (${reviews.length})`)),
      h('h2#st-stats', 'Auswertung'),
      h('div.kpis', accounts.map(a => {
        const s = J.stats(trades.filter(t => t.account === a.id));
        return J.kpi(a.name, J.fmtR(s.sumR), J.signClass(s.sumR), `${s.closed} Trades · Winrate ${s.winrate == null ? '–' : Math.round(s.winrate) + '%'} · ${J.fmtPct(s.sumPct)} · ${J.fmtUsd(s.sumUsd)}`);
      }), J.kpi('Regelverstöße', st.violations, st.violations ? 'neg' : 'pos', `in ${st.tradesWithViolations} Trades`)),
      J.card('Equity-Kurve (R)', J.equityChart(st.equity)),
      J.card('Nach Markt', J.barList(J.groupStats(closed, t => t.market), k => J.market(k).name)),
      viol.length ? J.card('Regelverstöße', h('ul.toplist', viol.map(x => h('li', h('b', `${x.c}×`), ` Regel ${x.n}: ${S.ruleTexts[x.n - 1]}`)))) : null,
      h('h2#st-analyses', 'Analysen'),
      analyses.length ? analyses.map(analysisBlock) : h('p.muted', 'Keine Analysen im Zeitraum.'),
      h('h2#st-trades', 'Trades'),
      trades.length ? trades.slice().reverse().map(tradeBlock) : h('p.muted', 'Keine Trades im Zeitraum.'),
      h('h2#st-reviews', 'Wochen-Reviews'),
      reviews.length ? reviews.map(r => h('section.card.st-item',
        h('h3', `KW ${r.id.split('-W')[1]} · ${J.fmtShort(r.from)} – ${J.fmtShort(r.to)}${r.to.slice(0, 4)} `, r.done ? J.badge('✓ erledigt', 'pos') : null,
          r.rating ? J.badge(`Zufriedenheit ${r.rating}/5`) : null),
        h('table.st-qa', h('tbody', S.ruleTexts.map((rt, i) => {
          const x = (r.rules || {})[i + 1] || {};
          return h('tr', h('td', `Regel ${i + 1}: ${rt}`, x.note ? h('div.muted', x.note) : null),
            h('td.nowrap', x.v === 'kept' ? h('span.pos', '✓ eingehalten') : x.v === 'broken' ? h('span.neg', '✗ gebrochen') : h('span.muted', '–')));
        }))),
        h('details', h('summary', 'Ausführung & Emotionen der Woche'), qa(S.executionQuestions, r.execution), h('h4', 'Emotionen'), qa(S.emotionQuestions, r.emotions)),
        S.reflectionQuestions.map(q => text(q.text, (r.reflection || {})[q.id])),
        S.reviewQuestions.map(q => text(q.text, (r.answers || {})[q.id])))) : h('p.muted', 'Keine Reviews im Zeitraum.'),
    );
    return el.outerHTML;
  };
})(window.J);
