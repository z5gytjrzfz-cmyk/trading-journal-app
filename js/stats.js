// Kennzahlen für Auswertungen
(function (J) {
  J.filterTrades = ({ from, to, account, market } = {}) => J.store.trades.filter(t => {
    const d = (t.entryTime || '').slice(0, 10);
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (account && account !== 'all' && t.account !== account) return false;
    if (market && market !== 'all' && t.market !== market) return false;
    return true;
  }).sort((a, b) => a.entryTime.localeCompare(b.entryTime));

  J.stats = (trades) => {
    const rows = trades.map(t => ({ t, c: J.calc(t) }));
    const closed = rows.filter(x => x.c.closed);
    const wins = closed.filter(x => x.c.outcome === 'win');
    const losses = closed.filter(x => x.c.outcome === 'loss');
    const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
    const grossWin = sum(wins, x => x.c.r), grossLoss = -sum(losses, x => x.c.r);
    let eq = 0, peak = 0, maxDD = 0;
    const equity = closed.map(x => {
      eq += x.c.r; peak = Math.max(peak, eq); maxDD = Math.min(maxDD, eq - peak);
      return { t: x.t, r: x.c.r, eq };
    });
    const decided = wins.length + losses.length;
    const holds = closed.map(x => x.c.holding).filter(v => v != null);
    return {
      count: rows.length, open: rows.length - closed.length, closed: closed.length,
      wins: wins.length, losses: losses.length, be: closed.length - decided,
      winrate: decided ? (wins.length / decided) * 100 : null,
      sumR: sum(closed, x => x.c.r), sumPct: sum(closed, x => x.c.pct), sumUsd: sum(closed, x => x.c.usd),
      avgR: closed.length ? sum(closed, x => x.c.r) / closed.length : null,
      avgWin: wins.length ? grossWin / wins.length : null,
      avgLoss: losses.length ? -grossLoss / losses.length : null,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
      best: closed.length ? Math.max(...closed.map(x => x.c.r)) : null,
      worst: closed.length ? Math.min(...closed.map(x => x.c.r)) : null,
      avgHold: holds.length ? Math.round(holds.reduce((a, b) => a + b, 0) / holds.length) : null,
      maxDD, equity,
      violations: rows.reduce((s, x) => s + (x.t.violations || []).length, 0),
      tradesWithViolations: rows.filter(x => (x.t.violations || []).length).length,
      rows,
    };
  };

  // Gruppierung nach beliebigem Schlüssel
  J.groupStats = (trades, keyFn, order) => {
    const groups = new Map();
    for (const t of trades) {
      const k = keyFn(t);
      if (k == null) continue;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(t);
    }
    const keys = order ? order.filter(k => groups.has(k)) : [...groups.keys()].sort();
    return keys.map(k => ({ key: k, s: J.stats(groups.get(k)) }));
  };

  J.scoreBucket = t => {
    const p = J.checklistScore(t.checklist).pct;
    if (p == null || !J.checklistScore(t.checklist).answered) return 'nicht ausgefüllt';
    return p >= 85 ? '85–100%' : p >= 70 ? '70–84%' : p >= 50 ? '50–69%' : 'unter 50%';
  };

  // Häufigste "schlechte" Antworten (Fehler / Emotionen)
  J.badAnswers = (trades, questions, field) => {
    const res = questions.map(q => {
      let bad = 0, answered = 0;
      for (const t of trades) {
        const a = ((t[field] || {})[q.id] || {}).v;
        if (!a || a === 'na') continue;
        answered++;
        if ((q.invert && a === 'yes') || (!q.invert && a === 'no') || a === 'partly') bad++;
      }
      return { q, bad, answered };
    });
    return res.filter(x => x.answered).sort((a, b) => b.bad - a.bad);
  };

  J.ruleViolationCounts = trades => {
    const counts = {};
    for (const t of trades) for (const n of t.violations || []) counts[n] = (counts[n] || 0) + 1;
    return Object.entries(counts).map(([n, c]) => ({ n: Number(n), c })).sort((a, b) => b.c - a.c);
  };
})(window.J);
