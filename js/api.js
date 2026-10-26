// Datenzugriff. Drei Betriebsarten:
//  server   – am Laptop über den lokalen Server (localhost)
//  github   – Handy-Version im Internet, liest/schreibt direkt im privaten GitHub-Repository
//  snapshot – Nur-Lesen-Datei (Teilen); alle Daten stecken in window.__SNAPSHOT__
(function (J) {
  const snap = window.__SNAPSHOT__;
  J.mode = snap ? 'snapshot' : ['localhost', '127.0.0.1'].includes(location.hostname) ? 'server' : 'github';
  J.readOnly = J.mode === 'snapshot';
  J.store = { settings: null, trades: [], analyses: [], reviews: [] };
  const newsCache = new Map();
  const holidayCache = new Map();
  const gh = () => J.gh;
  const COLLS = ['trades', 'analyses', 'reviews'];
  const LABEL = { trades: 'Trade', analyses: 'Analyse', reviews: 'Wochen-Review' };

  async function req(method, url, body) {
    const res = await fetch(url, {
      method, headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error((await res.text()) || res.statusText);
    return res.json();
  }

  function mergeSettings(s) {
    const d = window.J_DEFAULTS;
    const merged = { ...d, ...s, rules: { ...d.rules, ...((s && s.rules) || {}) } };
    // neue Standard-Zeiteinheiten (z.B. 5min, 1min) ergänzen, ohne eigene Anpassungen zu überschreiben
    const tfs = [...(merged.timeframes || [])];
    d.timeframes.forEach((t, i) => { if (!tfs.some(x => x.id === t.id)) tfs.splice(Math.min(i, tfs.length), 0, t); });
    // neue Felder einer Zeiteinheit (z.B. Fragen) ergänzen, ohne eigene Werte zu überschreiben
    tfs.forEach((t, i) => { const def = d.timeframes.find(x => x.id === t.id); if (def) tfs[i] = { ...def, ...t }; });
    merged.timeframes = tfs;
    return merged;
  }
  const months = (from, to) => {
    const out = [];
    for (let d = new Date(from.slice(0, 7) + '-01T00:00'); J.dateKey(d).slice(0, 7) <= to.slice(0, 7); d.setMonth(d.getMonth() + 1)) out.push(J.dateKey(d).slice(0, 7));
    return out;
  };
  const readFile = file => new Promise((resolve, reject) => {
    const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file);
  });

  J.api = {
    async loadAll() {
      if (J.mode === 'github') {
        await gh().loadTree();
        const [settings, ...colls] = await Promise.all([
          gh().readJson('data/settings.json'),
          ...COLLS.map(c => gh().readMany(gh().paths(`data/${c}/`).filter(p => p.endsWith('.json')))),
        ]);
        J.store.settings = mergeSettings(settings || {});
        COLLS.forEach((c, i) => { J.store[c] = colls[i]; });
        return;
      }
      const data = snap || (await req('GET', '/api/all'));
      J.store.settings = mergeSettings(data.settings);
      J.store.trades = data.trades || [];
      J.store.analyses = data.analyses || [];
      J.store.reviews = data.reviews || [];
    },
    async save(coll, obj) {
      if (J.readOnly) throw new Error('Nur-Lesen-Ansicht');
      let saved;
      if (J.mode === 'github') {
        saved = { ...obj, updatedAt: new Date().toISOString() };
        await gh().writeJson(`data/${coll}/${obj.id}.json`, saved, `Handy: ${LABEL[coll]} gespeichert`);
      } else saved = await req('PUT', `/api/${coll}/${obj.id}`, obj);
      const list = J.store[coll];
      const i = list.findIndex(x => x.id === saved.id);
      if (i >= 0) list[i] = saved; else list.push(saved);
      J.sync.refresh();
      return saved;
    },
    async remove(coll, id) {
      if (J.readOnly) throw new Error('Nur-Lesen-Ansicht');
      if (J.mode === 'github') {
        const obj = J.store[coll].find(x => x.id === id);
        if (obj) await gh().writeJson(`data/papierkorb/${coll}/${id}.json`, obj, `Handy: ${LABEL[coll]} in Papierkorb`);
        await gh().remove(`data/${coll}/${id}.json`, `Handy: ${LABEL[coll]} gelöscht`);
      } else await req('DELETE', `/api/${coll}/${id}`);
      J.store[coll] = J.store[coll].filter(x => x.id !== id);
      J.sync.refresh();
    },
    async saveSettings(s) {
      if (J.mode === 'github') {
        await gh().writeJson('data/settings.json', s, 'Handy: Einstellungen gespeichert');
        J.store.settings = mergeSettings(s);
      } else J.store.settings = mergeSettings(await req('PUT', '/api/settings', s));
      J.sync.refresh();
    },
    async uploadImage(file) {
      const data = await readFile(file);
      if (J.mode === 'github') {
        const m = /^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/.exec(data);
        if (!m) throw new Error('Kein Bild');
        const name = `${J.today()}_${Math.random().toString(36).slice(2, 10)}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
        await gh().writeB64(`data/images/${name}`, m[2], 'Handy: Screenshot hochgeladen');
        gh().setLocalImage(name, file);
        return name;
      }
      return (await req('POST', '/api/images', { data })).file;
    },
    imgUrl(file) {
      if (J.mode === 'github') return gh().imgUrl(file);
      return snap ? (snap.images || {})[file] || (J.staticImages || {})[file] || '' : `/data/images/${encodeURIComponent(file)}`;
    },

    // News im Zeitraum [from, to] (YYYY-MM-DD)
    async news(from, to, refresh) {
      const inRange = e => e.time.slice(0, 10) >= from && e.time.slice(0, 10) <= to;
      if (snap) return (snap.news || []).filter(inRange);
      const key = from + to;
      if (!refresh && newsCache.has(key)) return newsCache.get(key);
      try {
        let events;
        if (J.mode === 'github') {
          // Die News holt der Laptop von Forex Factory und legt sie im Repository ab
          events = (await Promise.all(months(from, to).map(m => gh().readJson(`data/news/${m}.json`)))).flat().filter(Boolean).filter(inRange);
        } else {
          const r = await req('GET', `/api/news?from=${from}&to=${to}${refresh ? '&refresh=1' : ''}`);
          J.api.newsMeta = { lastFetch: r.lastFetch, lastError: r.lastError };
          events = r.events;
        }
        newsCache.set(key, events);
        return events;
      } catch { return []; }
    },
    async holidays(year) {
      if (snap) return (snap.holidays || []).filter(x => x.date.startsWith(String(year)));
      if (!holidayCache.has(year)) {
        try {
          if (J.mode === 'github') {
            const f = await gh().readJson(`data/holidays/${year}.json`);
            holidayCache.set(year, f ? Object.values(f.countries || {}).flat() : []);
          } else holidayCache.set(year, await req('GET', `/api/holidays?year=${year}`));
        } catch { return []; }
      }
      return holidayCache.get(year);
    },
    gitStatus: () => req('GET', '/api/git/status'),
    gitSync: () => req('POST', '/api/git/sync'),
    snapshot: opts => req('POST', '/api/snapshot', opts),
    reveal: file => req('POST', '/api/reveal', { file }),
    // Handy-Version: neu von GitHub laden (z.B. nach Einträgen am Laptop)
    async reload() { newsCache.clear(); holidayCache.clear(); await J.api.loadAll(); },
  };

  // Hilfen auf dem Datenbestand
  J.market = id => (J.store.settings.markets.find(m => m.id === id) || { id, name: id, currencies: ['USD'], color: '#888' });
  J.account = id => (J.store.settings.accounts.find(a => a.id === id) || { id, name: id, size: 100000, riskPct: 1 });
  J.tf = id => J.store.settings.timeframes.find(t => t.id === id) || { id, name: id, elements: [], validDays: 7 };
})(window.J);
