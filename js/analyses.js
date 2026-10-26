// Märkte & Analysen (Daily / 4h / 1h / 15min)
(function (J) {
  const h = J.h;
  const LEVEL_KINDS = ['Schwelle', 'Support', 'Resistance', 'FVG', 'Liquidität', 'Fib-Zone', 'POC / Volumen', 'Trendline', 'Ziel'];
  const LEVEL_STATUS = ['intakt', 'angelaufen', 'gebrochen', 'zu Gunsten gebrochen'];
  const SITUATIONS = ['', 'Läuft ein Ziel an', 'Zwischen zwei Zielen', 'In wichtigem Bereich', 'Ziel erreicht', 'Schwellenbruch'];

  J.isExpired = a => a.validUntil && a.validUntil < J.today();

  // Neueste Analyse je Markt + Zeiteinheit
  J.currentAnalyses = (market) => {
    const best = {};
    for (const a of J.store.analyses) {
      if (market && a.market !== market) continue;
      const k = a.market + '|' + a.timeframe;
      if (!best[k] || (a.date || '') > (best[k].date || '')) best[k] = a;
    }
    return Object.values(best).map(a => ({ ...a, expired: J.isExpired(a) }));
  };
  J.latestAnalysis = (market, tf) => J.currentAnalyses(market).find(a => a.timeframe === tf);

  function cell(a, market, tf) {
    if (!a) return h('td.mx-empty', J.link('+ anlegen', `#/analyse/neu?market=${market}&tf=${tf}`, 'muted'));
    return h('td', { class: a.expired ? 'expired' : '' }, h('a.mx', { href: '#/analyse/' + a.id },
      J.biasBadge(a.bias),
      a.targetNext ? h('div.small', '🎯 ', a.targetNext) : null,
      a.situation ? h('div.small.muted', a.situation) : null,
      h('div.small', { class: a.expired ? 'neg' : 'muted' }, a.expired ? `abgelaufen ${J.fmtShort(a.validUntil)}` : `gültig bis ${J.fmtShort(a.validUntil)}`)));
  }

  J.renderAnalysesOverview = (main) => {
    const S = J.store.settings;
    const cur = J.currentAnalyses();
    const recent = [...J.store.analyses].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 30);
    J.clear(main).append(J.page('Märkte & Analysen', [J.btn('+ Neue Analyse', () => J.go('#/analyse/neu'), 'primary')],
      J.card('Aktuelle Lage je Markt',
        h('div.scroll', h('table.matrix',
          h('thead', h('tr', h('th', 'Markt'), S.timeframes.map(tf => h('th', tf.name)))),
          h('tbody', S.markets.map(m => h('tr',
            h('th', h('a', { href: '#/markt/' + m.id }, J.marketDot(m.id), m.name)),
            S.timeframes.map(tf => cell(cur.find(a => a.market === m.id && a.timeframe === tf.id), m.id, tf.id)))))))),
      J.card('Letzte Analysen', analysisTable(recent)),
    ));
  };

  function analysisTable(list) {
    if (!list.length) return h('div.empty', 'Noch keine Analysen.');
    return h('div.scroll', h('table.list', h('thead', h('tr', ['Datum', 'Markt', 'TF', 'Bias', 'Lage', 'Nächstes Ziel', 'Gültig bis'].map(x => h('th', x)))),
      h('tbody', list.map(a => h('tr', { class: 'click', onclick: () => J.go('#/analyse/' + a.id) },
        h('td', J.fmtDate(a.date)), h('td', J.marketDot(a.market), a.market), h('td', J.tf(a.timeframe).name),
        h('td', J.biasBadge(a.bias)), h('td', a.situation || ''), h('td', a.targetNext || ''),
        h('td', { class: J.isExpired(a) ? 'neg' : '' }, J.fmtShort(a.validUntil)))))));
  }

  J.renderMarket = (main, id) => {
    const m = J.market(id), S = J.store.settings;
    const cur = J.currentAnalyses(id);
    const hist = J.store.analyses.filter(a => a.market === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const trades = J.filterTrades({ market: id });
    const st = J.stats(trades);
    J.clear(main).append(J.page([J.marketDot(id), ' ', m.name], [
      J.btn('+ Analyse', () => J.go('#/analyse/neu?market=' + id), 'primary'),
      J.btn('+ Trade', () => J.go('#/trade/neu?market=' + id), 'ghost')],
      h('div.kpis', J.kpi('Trades gesamt', st.closed), J.kpi('Winrate', st.winrate == null ? '–' : Math.round(st.winrate) + '%'),
        J.kpi('Summe R', J.fmtR(st.sumR), J.signClass(st.sumR)), J.kpi('Ø R', J.fmtR(st.avgR), J.signClass(st.avgR))),
      h('div.tf-cards', S.timeframes.map(tf => {
        const a = cur.find(x => x.timeframe === tf.id);
        return h('section.card.tfc', h('h2', tf.name, a ? h('span', ' ', J.biasBadge(a.bias)) : null),
          a ? [
            h('div.small', { class: a.expired ? 'neg' : 'muted' }, `${J.fmtDate(a.date)} · gültig bis ${J.fmtShort(a.validUntil)}${a.expired ? ' (abgelaufen)' : ''}`),
            a.relation ? h('div', a.relation === 'with' ? '↗ in übergeordneter Richtung' : '↘ gegen übergeordnete Richtung') : null,
            a.situation ? h('div', h('b', 'Lage: '), a.situation) : null,
            a.targetNext ? h('div', h('b', '🎯 Ziel: '), a.targetNext, a.targetNextNote ? ` (${a.targetNextNote})` : '') : null,
            a.targetInter ? h('div', h('b', 'Zwischenziel: '), a.targetInter) : null,
            (a.levels || []).length ? h('ul.levels', a.levels.slice(0, 8).map(l => h('li', h('b', l.price || ''), ` ${l.kind}`, l.status && l.status !== 'intakt' ? h('span.muted', ` · ${l.status}`) : null))) : null,
            (a.images || [])[0] ? h('img.preview', { src: J.api.imgUrl(a.images[0].file), 'data-file': a.images[0].file, onclick: () => J.lightbox(J.api.imgUrl(a.images[0].file)) }) : null,
            J.link('Öffnen →', '#/analyse/' + a.id),
          ] : h('div.muted', 'Noch keine Analyse. ', J.link('Jetzt anlegen', `#/analyse/neu?market=${id}&tf=${tf.id}`)));
      })),
      J.card('Verlauf der Analysen', analysisTable(hist)),
      J.card('Trades in diesem Markt', J.tradeTable(trades.slice().reverse().slice(0, 30))),
    ));
  };

  J.renderAnalysis = (main, id, params) => {
    const S = J.store.settings;
    let a = id === 'neu' ? null : J.byId(J.store.analyses, id);
    if (id !== 'neu' && !a) { J.clear(main).append(h('div.empty', 'Analyse nicht gefunden.')); return; }
    const isNew = !a;
    if (isNew) {
      const market = params.get('market') || S.markets[0].id;
      const tf = params.get('tf') || 'D';
      const prev = J.latestAnalysis(market, tf);
      const day = params.get('day');
      a = {
        id: J.uid('ana'), market, timeframe: tf, date: day ? `${day}T08:00` : J.nowLocal(), bias: prev ? prev.bias : '',
        levels: prev ? JSON.parse(JSON.stringify(prev.levels || [])) : [],
        targetNext: prev ? prev.targetNext : '', targetInter: prev ? prev.targetInter : '',
        elements: {}, images: [], _prefilled: !!prev,
      };
      a.validUntil = J.addDays(a.date.slice(0, 10), J.tf(tf).validDays);
    } else a = JSON.parse(JSON.stringify(a));

    const m = a;
    const form = h('div');
    const draw = () => {
      const tf = J.tf(m.timeframe);
      const levelsBox = h('div');
      const drawLevels = () => {
        J.clear(levelsBox).append(
          h('div.levels-list', (m.levels || []).map((l, i) => h('div.level-row',
            h('div.level-top',
              J.field('Preis / Zone', J.inp(l, 'price', { placeholder: 'z.B. 2650–2660' })),
              J.field('Art', J.sel(l, 'kind', LEVEL_KINDS)),
              J.field('Status', J.sel(l, 'status', LEVEL_STATUS)),
              J.readOnly ? h('span') : h('button.x', { type: 'button', title: 'Entfernen', onclick: () => { m.levels.splice(i, 1); drawLevels(); } }, '×')),
            J.field('Notiz', J.txt(l, 'note', { rows: 4, placeholder: 'Warum ist diese Schwelle wichtig? Wurde sie gebrochen, wie reagiert der Preis?' }))))),
          J.btn('+ Schwelle / Zone', () => { m.levels.push({ price: '', kind: 'Schwelle', status: 'intakt', note: '' }); drawLevels(); }, 'small ghost'));
      };
      drawLevels();
      J.clear(form).append(J.lockable(
        m._prefilled && isNew ? h('div.note', 'ℹ️ Schwellen, Ziele und Bias wurden aus der letzten Analyse übernommen – bitte aktualisieren.') : null,
        J.card('Grunddaten', h('div.grid4',
          J.field('Markt', J.sel(m, 'market', S.markets.map(x => [x.id, x.name]))),
          J.field('Zeiteinheit', J.sel(m, 'timeframe', S.timeframes.map(x => [x.id, x.name]), () => {
            m.validUntil = J.addDays(m.date.slice(0, 10), J.tf(m.timeframe).validDays); draw();
          })),
          J.field('Datum', J.inp(m, 'date', { type: 'datetime-local' })),
          J.field('Gültig bis', J.inp(m, 'validUntil', { type: 'date' }), `Standard: ${tf.validDays} Tag(e)`),
        )),
        J.card('Richtung & Ziele', h('p.guide', '❓ ', tf.guide),
          h('div.grid4',
            J.field('Bias / Trend', J.seg(m, 'bias', [['bullish', '▲ Bullish', 'y'], ['neutral', '◆ Neutral', 'x'], ['bearish', '▼ Bearish', 'n']])),
            m.timeframe !== 'D' ? J.field('Zur übergeordneten TF', J.seg(m, 'relation', [['with', 'in Richtung', 'y'], ['against', 'gegen', 'n']])) : h('div'),
            J.field('Lage', J.sel(m, 'situation', SITUATIONS.map(s => [s, s || '–']))),
            J.field('Aktueller Preis', J.inp(m, 'price', { placeholder: 'optional' })),
          ),
          h('div.grid2',
            J.field('Nächstes Ziel', J.txt(m, 'targetNext', { rows: 5, placeholder: 'Preis / Zone und kurze Beschreibung' })),
            J.field('Warum dieses Ziel?', J.txt(m, 'targetNextNote', { rows: 5, placeholder: 'z.B. Daily-FVG, Equal Highs, POC …' })),
            J.field('Zwischenziel', J.txt(m, 'targetInter', { rows: 5, placeholder: 'Preis / Zone und kurze Beschreibung' })),
            J.field('Welches Ziel wird angelaufen?', J.txt(m, 'runningTarget', { rows: 5, placeholder: 'z.B. oberes Ziel – oder liegen wir zwischen zwei Zielen?' })),
          ),
          J.field('Antwort auf die Leitfrage', J.txt(m, 'guideAnswer', { rows: 6, placeholder: 'Richtung, Ziele, Schwellen, wichtiger Bereich …' })),
          m.timeframe !== 'D' ? J.field('Werden schon theoretische Trades sichtbar?', J.txt(m, 'theoretical', { rows: 5 })) : null,
        ),
        J.card('Schwellen, Zonen & Schwellenbrüche', levelsBox),
        J.card(`Checkliste ${tf.name}-Chart`, h('div.checks', tf.elements.map((e, i) => {
          m.elements = m.elements || {};
          return J.chk(m.elements, String(i), e);
        }))),
        J.card('Screenshots', J.imagesField(m)),
        J.card('Fazit / Notizen', J.txt(m, 'summary', { rows: 6 })),
      ), J.saveBar(save, isNew ? null : del));
    };
    async function save() {
      delete m._prefilled; delete m.expired;
      await J.api.save('analyses', m);
      J.toast('Analyse gespeichert ✓');
      if (isNew) J.go('#/analyse/' + m.id); else J.render();
    }
    async function del() {
      if (!J.confirm('Analyse wirklich löschen? (Sie wird in den Papierkorb-Ordner verschoben.)')) return;
      await J.api.remove('analyses', m.id);
      J.go('#/analysen');
    }
    draw();
    const title = isNew ? 'Neue Analyse' : `Analyse ${m.market} · ${J.tf(m.timeframe).name}`;
    J.clear(main).append(J.page(title, [J.link('← Markt', '#/markt/' + m.market, 'btn ghost')], form));
  };
})(window.J);
