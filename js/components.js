// Wiederverwendbare Bausteine für Formulare und Ansichten
(function (J) {
  const h = J.h;

  J.page = (title, actions, ...body) => h('div.page',
    h('div.page-head', h('h1', title), h('div.actions', actions || [])), body);

  J.card = (title, ...body) => h('section.card', title ? h('h2', title) : null, body);
  // <label> nur um echte Eingabefelder – um Knopf-Gruppen würde Safari jeden Klick an den ersten Knopf weiterleiten
  J.field = (label, input, hint) => {
    const isInput = input instanceof Element && ['INPUT', 'SELECT', 'TEXTAREA'].includes(input.tagName);
    return h(isInput ? 'label.field' : 'div.field', h('span.lbl', label), input, hint ? h('span.hint', hint) : null);
  };
  J.row = (...kids) => h('div.row', kids);
  J.btn = (label, onclick, cls) => h('button', { type: 'button', class: 'btn ' + (cls || ''), onclick }, label);
  J.link = (label, hash, cls) => h('a', { href: hash, class: cls || '' }, label);
  J.badge = (text, cls) => h('span', { class: 'badge ' + (cls || '') }, text);
  J.kpi = (label, value, cls, sub) => h('div.kpi', h('div.kpi-l', label), h('div', { class: 'kpi-v ' + (cls || '') }, value), sub ? h('div.kpi-s', sub) : null);

  // Gebundene Eingaben: schreiben direkt in das Modell m[key]
  J.inp = (m, key, attrs = {}, onchange) => h('input', {
    value: m[key] == null ? '' : m[key], ...attrs,
    oninput: e => { m[key] = attrs.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value; onchange && onchange(); },
  });
  J.chk = (m, key, label, onchange) => h('label.check', h('input', {
    type: 'checkbox', checked: !!m[key], onchange: e => { m[key] = e.target.checked; onchange && onchange(); },
  }), label);
  J.txt = (m, key, attrs = {}, onchange) => {
    const t = h('textarea', { rows: 3, ...attrs, value: m[key] || '', oninput: e => { m[key] = e.target.value; autosize(); onchange && onchange(); } });
    // wächst mit dem Text mit, damit immer alles lesbar ist (Rahmenbreite mit einrechnen)
    const autosize = () => { t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight + t.offsetHeight - t.clientHeight, 60) + 'px'; };
    requestAnimationFrame(autosize);
    return t;
  };
  J.sel = (m, key, options, onchange, attrs = {}) => h('select', {
    ...attrs, value: m[key] == null ? '' : m[key],
    onchange: e => { m[key] = e.target.value; onchange && onchange(); },
  }, options.map(o => (Array.isArray(o) ? h('option', { value: o[0] }, o[1]) : h('option', { value: o }, o))));

  // Segment-Auswahl (z.B. Ja / Nein / n.a.)
  J.seg = (m, key, options, onchange) => {
    // Knöpfe werden nur einmal gebaut und beim Klick lediglich umgefärbt (nicht neu gezeichnet)
    const buttons = options.map(([v, label, cls]) => h('button', {
      type: 'button', class: cls || '',
      onclick: e => {
        e.preventDefault();
        m[key] = m[key] === v ? '' : v;
        mark();
        onchange && onchange();
      },
    }, label));
    const mark = () => buttons.forEach((b, i) => b.classList.toggle('on', m[key] === options[i][0]));
    mark();
    return h('div.seg', buttons);
  };
  J.YNN = [['yes', 'Ja', 'y'], ['no', 'Nein', 'n'], ['na', 'n.a.', 'x']];
  // Signifikanz-Bewertung je Abschnitt („Trade Bewertung“ im Dokument)
  J.RATING = [['low', '🔴 Gering', 'n'], ['mid', '🟡 Mittel', 'p'], ['high', '🟢 Hoch', 'y']];
  J.RATING_LABEL = { low: '🔴 Gering', mid: '🟡 Mittel', high: '🟢 Hoch' };
  J.suggestRating = p => (p == null ? '–' : p >= 70 ? '🟢 Hoch' : p >= 40 ? '🟡 Mittel' : '🔴 Gering');
  J.ratingSections = S => [...new Set(S.checklist.map(q => q.section))].filter(sec => !/regel/i.test(sec));
  // Zusatzfeld einer Checklisten-Frage: Auswahl, wo das Dokument feste Werte vorgibt
  J.detailInput = (kind, store) => {
    const opts = /^tf$/i.test(kind) ? J.store.settings.timeframes.map(t => t.name)
      : /signifikanz/i.test(kind) ? ['🔴 Gering', '🟡 Mittel', '🟢 Hoch']
      : /trend/i.test(kind) ? ['🟢 Aufwärtstrend', '🔴 Abwärtstrend', '⚪ Seitwärts'] : null;
    if (!opts) return J.inp(store, 'd', { placeholder: kind, class: 'qd' });
    const cur = store.d && !opts.includes(store.d) ? [store.d] : [];
    return J.sel(store, 'd', [['', kind + ' …'], ...cur, ...opts], null, { class: 'qd' });
  };
  J.YNP = [['yes', 'Ja', 'y'], ['partly', 'Teils', 'p'], ['no', 'Nein', 'n']];

  // Bilder: Drag & Drop, Einfügen (Cmd+V) oder Auswählen
  J.imagesField = (m) => {
    m.images = m.images || [];
    const grid = h('div.thumbs');
    const fileIn = h('input', { type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' }, onchange: e => upload([...e.target.files]) });
    const drop = h('div.drop', { tabIndex: 0 },
      '📷 Screenshot hierher ziehen, mit Cmd+V einfügen oder ',
      h('a', { href: '#', onclick: e => { e.preventDefault(); fileIn.click(); } }, 'auswählen'), fileIn);
    async function upload(files) {
      if (J.readOnly) return J.toast('Vorschau: In der Nur-Lesen-Ansicht können keine Bilder hinzugefügt werden.');
      for (const f of files.filter(f => f.type.startsWith('image/'))) {
        try { m.images.push({ file: await J.api.uploadImage(f), caption: '' }); }
        catch (err) { J.toast('Bild-Upload fehlgeschlagen: ' + err.message, 'err'); }
      }
      draw();
    }
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); upload([...e.dataTransfer.files]); });
    const onPaste = e => {
      if (!document.body.contains(drop)) return document.removeEventListener('paste', onPaste);
      const files = [...(e.clipboardData || {}).items || []].filter(i => i.type.startsWith('image/')).map(i => i.getAsFile());
      if (files.length) { e.preventDefault(); upload(files); }
    };
    if (!J.readOnly) document.addEventListener('paste', onPaste);
    function draw() {
      J.clear(grid);
      m.images.forEach((img, i) => grid.append(h('figure.thumb',
        h('img', { src: J.api.imgUrl(img.file), 'data-file': img.file, onclick: () => J.lightbox(J.api.imgUrl(img.file)) }),
        h('input', { placeholder: 'Beschreibung', value: img.caption || '', oninput: e => (img.caption = e.target.value) }),
        J.readOnly ? null : h('button.x', { type: 'button', title: 'Entfernen', onclick: () => { m.images.splice(i, 1); draw(); } }, '×'),
      )));
    }
    draw();
    return h('div.images', grid, drop);
  };

  J.biasBadge = bias => {
    const map = { bullish: ['▲ Bullish', 'pos'], bearish: ['▼ Bearish', 'neg'], neutral: ['◆ Neutral', 'neu'] };
    const [t, c] = map[bias] || ['–', ''];
    return J.badge(t, 'bias ' + c);
  };
  J.outcomeBadge = c => {
    if (!c.closed) return J.badge('offen', 'open');
    return J.badge(J.fmtR(c.r), c.outcome === 'win' ? 'pos' : c.outcome === 'loss' ? 'neg' : 'neu');
  };
  J.marketDot = id => h('span.mdot', { style: { background: J.market(id).color } });

  // Formular im Nur-Lesen-Modus sperren: alles sichtbar, nichts eintragbar
  J.lockable = (...kids) => h('fieldset.lock', { disabled: J.readOnly },
    J.readOnly ? h('div.note.preview', '👁 Vorschau – in der Nur-Lesen-Ansicht kann nichts eingetragen oder gespeichert werden.') : null,
    kids);

  // Speichern-Leiste (in der Nur-Lesen-Ansicht nur ausgegraut gezeigt)
  J.saveBar = (onSave, onDelete, extra) => J.readOnly ? h('div.savebar', h('span.spacer'),
    h('button', { type: 'button', class: 'btn primary', disabled: true, title: 'Nur in deinem eigenen Journal möglich' }, 'Speichern')) : h('div.savebar',
    extra || null,
    onDelete ? J.btn('Löschen', onDelete, 'danger ghost') : null,
    h('span.spacer'),
    J.btn('Speichern', onSave, 'primary'),
  );
})(window.J);
