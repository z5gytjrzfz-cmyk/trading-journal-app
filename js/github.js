// Speicher direkt im privaten GitHub-Repository (für die Handy-Version, die ohne Laptop läuft).
// Zugang: persönlicher Zugangsschlüssel (fine-grained token), nur im Browser des Handys gespeichert.
(function (J) {
  const CFG_KEY = 'gh-cfg', CACHE_KEY = 'gh-cache';
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* Speicher voll: ohne Zwischenspeicher weiter */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* egal */ } },
  };

  const enc = new TextEncoder(), dec = new TextDecoder();
  const toB64 = str => { const b = enc.encode(str); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
  const fromB64 = b64 => dec.decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
  const encPath = p => p.split('/').map(encodeURIComponent).join('/');

  let tree = new Map();          // Pfad -> sha
  let cache = store.get(CACHE_KEY, {}); // Pfad -> { sha, data }
  const imageUrls = new Map();   // Dateiname -> Object-URL
  const imageLoading = new Map();

  const gh = J.gh = {
    cfg: store.get(CFG_KEY, null),
    configured() { return !!(gh.cfg && gh.cfg.token && gh.cfg.owner && gh.cfg.repo); },
    defaultOwner() { return location.hostname.endsWith('.github.io') ? location.hostname.split('.')[0] : ''; },
    saveCfg(cfg) { gh.cfg = cfg; store.set(CFG_KEY, cfg); },
    logout() { store.del(CFG_KEY); store.del(CACHE_KEY); gh.cfg = null; },

    async call(method, path, body, accept) {
      const { owner, repo, token } = gh.cfg;
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
        method, cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, Accept: accept === 'raw' ? 'application/vnd.github.raw' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const err = new Error(res.status === 401 ? 'Zugangsschlüssel ungültig oder abgelaufen' : res.status === 404 ? 'Repository nicht gefunden oder kein Zugriff' : `GitHub-Fehler ${res.status}`);
        err.status = res.status; throw err;
      }
      return accept === 'raw' ? res : res.status === 204 ? null : res.json();
    },
    async test() { await gh.call('GET', ''); },

    async loadTree() {
      const r = await gh.call('GET', `/git/trees/${gh.cfg.branch || 'main'}?recursive=1`);
      tree = new Map(r.tree.filter(x => x.type === 'blob').map(x => [x.path, x.sha]));
    },
    has: path => tree.has(path),
    paths: prefix => [...tree.keys()].filter(p => p.startsWith(prefix)),

    async readJson(path) {
      const sha = tree.get(path);
      if (!sha) return null;
      if (cache[path] && cache[path].sha === sha) return cache[path].data;
      const blob = await gh.call('GET', `/git/blobs/${sha}`);
      const data = JSON.parse(fromB64(blob.content));
      cache[path] = { sha, data };
      return data;
    },
    async readMany(paths) {
      const out = [];
      let i = 0;
      const worker = async () => { while (i < paths.length) { const p = paths[i++]; try { const d = await gh.readJson(p); if (d) out.push(d); } catch (e) { console.warn(p, e); } } };
      await Promise.all(Array.from({ length: 8 }, worker));
      // nur Einträge zwischenspeichern, die es noch gibt
      cache = Object.fromEntries(Object.entries(cache).filter(([p]) => tree.has(p)));
      store.set(CACHE_KEY, cache);
      return out;
    },

    async writeB64(path, content, message) {
      const put = () => gh.call('PUT', `/contents/${encPath(path)}`, {
        message, content, branch: gh.cfg.branch || 'main', ...(tree.has(path) ? { sha: tree.get(path) } : {}),
      });
      let r;
      try { r = await put(); } catch (e) {
        if (e.status !== 409 && e.status !== 422) throw e;
        await gh.loadTree(); r = await put(); // Datei wurde inzwischen woanders geändert
      }
      tree.set(path, r.content.sha);
      return r;
    },
    async writeJson(path, obj, message) {
      await gh.writeB64(path, toB64(JSON.stringify(obj, null, 2) + '\n'), message);
      cache[path] = { sha: tree.get(path), data: obj };
      store.set(CACHE_KEY, cache);
    },
    async remove(path, message) {
      if (!tree.has(path)) return;
      await gh.call('DELETE', `/contents/${encPath(path)}`, { message, sha: tree.get(path), branch: gh.cfg.branch || 'main' });
      tree.delete(path); delete cache[path]; store.set(CACHE_KEY, cache);
    },

    // Bilder liegen privat im Repository und werden mit dem Schlüssel geladen
    imgUrl(file) { return imageUrls.get(file) || ''; },
    setLocalImage(file, blob) { imageUrls.set(file, URL.createObjectURL(blob)); },
    async loadImage(file) {
      if (imageUrls.has(file)) return imageUrls.get(file);
      if (!imageLoading.has(file)) {
        imageLoading.set(file, gh.call('GET', `/contents/data/images/${encodeURIComponent(file)}?ref=${gh.cfg.branch || 'main'}`, null, 'raw')
          .then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); imageUrls.set(file, u); return u; }));
      }
      return imageLoading.get(file);
    },
  };

  // Bilder nachladen, sobald sie auf der Seite erscheinen
  gh.watchImages = () => {
    const fill = img => {
      const f = img.dataset.file;
      if (!f || img.getAttribute('src')) return;
      gh.loadImage(f).then(u => { img.src = u; }).catch(() => { img.alt = 'Bild konnte nicht geladen werden'; });
    };
    new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.matches('img[data-file]')) fill(n);
      n.querySelectorAll && n.querySelectorAll('img[data-file]').forEach(fill);
    }))).observe(document.body, { childList: true, subtree: true });
  };
  gh.toB64 = toB64;
})(window.J);
