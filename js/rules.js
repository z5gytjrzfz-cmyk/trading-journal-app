// Trade-Berechnungen, Signifikanz-Score und Regel-Wächter
(function (J) {
  const EPS = 0.05;

  J.sessionOf = (time) => {
    if (!time) return null;
    const hm = J.fmtTime(time);
    const s = J.store.settings.sessions.find(x => hm >= x.from && hm <= x.to);
    return s ? s.name : 'Außerhalb';
  };

  // Abgeleitete Werte eines Trades
  J.calc = (t) => {
    const acc = J.account(t.account);
    const riskPct = t.riskPct != null && t.riskPct !== '' ? Number(t.riskPct) : acc.riskPct;
    const dir = t.direction === 'short' ? -1 : 1;
    const entry = Number(t.entry), sl = Number(t.sl), tp = Number(t.tp), exit = Number(t.exit);
    const riskDist = t.entry && t.sl ? (entry - sl) * dir : null;
    const plannedRR = riskDist > 0 && t.tp ? ((tp - entry) * dir) / riskDist : null;
    let r = null;
    if (t.manualR != null && t.manualR !== '') r = Number(t.manualR);
    else if (riskDist > 0 && t.exit) r = ((exit - entry) * dir) / riskDist;
    const closed = t.status !== 'open' && r != null;
    const pct = r != null ? r * riskPct : null;
    const usd = pct != null ? (pct / 100) * acc.size : null;
    const outcome = !closed ? 'open' : r > EPS ? 'win' : r < -EPS ? 'loss' : 'be';
    return {
      riskPct, r, pct, usd, plannedRR, closed, outcome,
      riskUsd: (riskPct / 100) * acc.size,
      holding: J.minutesBetween(t.entryTime, t.exitTime),
      session: J.sessionOf(t.entryTime),
      day: (t.entryTime || '').slice(0, 10),
    };
  };

  // Signifikanz-Checkliste: erfüllte Punkte / (alle Punkte – nicht zutreffende)
  J.checklistScore = (answers, items) => {
    items = items || J.store.settings.checklist;
    answers = answers || {};
    const calc = list => {
      let total = 0, ok = 0, answered = 0;
      for (const it of list) {
        const a = (answers[it.id] || {}).v;
        if (a === 'na') continue;
        total++;
        if (a) answered++;
        if ((it.invert && a === 'no') || (!it.invert && a === 'yes')) ok++;
      }
      return { total, ok, answered, pct: total ? Math.round((ok / total) * 100) : null };
    };
    const sections = {};
    for (const it of items) (sections[it.section] = sections[it.section] || []).push(it);
    return {
      ...calc(items),
      sections: Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, calc(v)])),
    };
  };

  // Regel-Wächter. news = Events des Tages
  J.checkRules = (t, news) => {
    const S = J.store.settings, R = S.rules, c = J.calc(t);
    const out = [];
    const add = (n, status, detail) => out.push({ n, text: S.ruleTexts[n - 1], status, detail });
    if (!t.entryTime) return out;
    const others = J.store.trades.filter(o => o.id !== t.id && o.entryTime && o.entryTime.slice(0, 10) === c.day);
    const before = others.filter(o => o.exitTime && o.exitTime <= t.entryTime).map(o => ({ o, c: J.calc(o) })).filter(x => x.c.closed);
    const sameAcc = before.filter(x => x.o.account === t.account);
    const exempt = !!t.aplus;

    const losses = sameAcc.filter(x => x.c.outcome === 'loss').length;
    if (losses >= R.maxLosses) add(1, exempt ? 'warn' : 'fail', `${losses} Verlusttrades vorher heute${exempt ? ' – A+ Ausnahme' : ''}`);
    else add(1, 'ok', `${losses} Verlust(e) vorher heute`);

    const dayPct = sameAcc.reduce((s, x) => s + (x.c.pct || 0), 0);
    if (dayPct >= R.dailyTargetPct) add(2, exempt ? 'warn' : 'fail', `Tag schon bei ${J.fmtPct(dayPct)}${exempt ? ' – A+ Ausnahme' : ''}`);
    else add(2, 'ok', `Tag bisher ${J.fmtPct(dayPct)}`);

    const sc = J.checklistScore(t.checklist);
    if (!sc.answered) add(3, 'warn', 'Checkliste noch nicht ausgefüllt');
    else add(3, sc.pct >= R.minChecklist ? 'ok' : 'fail', `${sc.pct}% erfüllt (min. ${R.minChecklist}%)`);

    if (!t.sl) add(4, 'fail', 'Kein Stop-Loss eingetragen');
    else if (t.slWidened) add(4, 'fail', 'Stop-Loss wurde vergrößert');
    else add(4, 'ok', 'SL definiert');

    const accRisk = J.account(t.account).riskPct;
    add(5, c.riskPct > accRisk + 1e-9 ? 'fail' : 'ok', `${J.num(c.riskPct, 2)}% Risiko (max. ${J.num(accRisk, 2)}%)`);

    add(6, c.session === 'Außerhalb' ? 'fail' : 'ok', c.session === 'Außerhalb' ? `Einstieg ${J.fmtTime(t.entryTime)} außerhalb der Hauptsession` : c.session);

    const documented = sc.answered > 0 && (!c.closed || Object.values(t.execution || {}).some(x => x && x.v));
    add(7, documented ? 'ok' : 'warn', documented ? 'Dokumentiert' : 'Checkliste/Nachbewertung fehlt noch');

    const tEntry = J.parse(t.entryTime);
    const recentLoss = before.filter(x => x.c.outcome === 'loss')
      .find(x => (tEntry - J.parse(x.o.exitTime)) / 60000 < R.cooldownLossMin);
    add(8, recentLoss ? 'fail' : 'ok', recentLoss ? `Verlust um ${J.fmtTime(recentLoss.o.exitTime)} – zu kurz danach` : 'Kein Verlust in den letzten 15 min');

    const cur = J.market(t.market).currencies;
    const relevant = (news || []).filter(e => R.newsImpacts.includes(e.impact) && cur.includes(e.currency));
    const after = relevant.find(e => { const d = (tEntry - J.parse(e.time)) / 60000; return d >= 0 && d < R.cooldownNewsMin; });
    const soon = relevant.find(e => { const d = (J.parse(e.time) - tEntry) / 60000; return d > 0 && d <= R.cooldownNewsMin; });
    if (after) add(9, 'fail', `News ${J.fmtTime(after.time)} ${after.currency} ${after.title}`);
    else if (soon) add(9, 'warn', `Achtung: News um ${J.fmtTime(soon.time)} (${soon.currency} ${soon.title})`);
    else add(9, 'ok', 'Keine relevanten News kurz davor');
    return out;
  };

  J.violations = (t, news) => J.checkRules(t, news).filter(r => r.status === 'fail').map(r => r.n);
})(window.J);
