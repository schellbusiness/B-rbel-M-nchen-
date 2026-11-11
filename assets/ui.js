// Wiederverwendbare Bausteine der Oberfläche.
import { html, useState, useEffect, useRef, cx, isImagePath } from './lib.js';
import {
  state, closeSheet, memberIndex, memberName, urlFor, closeLightbox, deleteFile, confirmDialog,
} from './store.js';

// ---------- Icons (24×24, Linien) ----------

const ICONS = {
  home: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v10.5a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9"/>',
  rooms: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 12h8.5M12 3.5v6M12 13.5v7M15 12h5.5"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18"/><path d="M6.5 6 15.5 3.5a1.5 1.5 0 0 1 1.9 1.1L17.8 6"/><circle cx="16.5" cy="15" r="1.2"/>',
  todo: '<path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="m3.5 6.5 1.6 1.6L8 5.2"/><path d="m3.5 12 1.6 1.6L8 10.7"/><path d="m3.5 17.5 1.6 1.6L8 16.2"/>',
  truck: '<path d="M2.5 6.5h11v10h-11z"/><path d="M13.5 9.5h4l3 3.2v3.8h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  settings: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5h6V7"/>',
  link: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  camera: '<path d="M4 8.5a2 2 0 0 1 2-2h2L9.5 4h5L16 6.5h2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9.5" r="1.8"/><path d="m20.5 15.5-5-5-9.5 9.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  box: '<path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="m3.5 7.5 8.5 4 8.5-4M12 11.5v9"/>',
  file: '<path d="M14 3.5H6.5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8z"/><path d="M14 3.5V8h4.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  logout: '<path d="M14.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.5"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H16"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9.5a1 1 0 0 0 1 1h3.5"/>',
  pin: '<path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  zoom: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M11 8.5v5M8.5 11h5"/>',
  note: '<path d="M5 4.5h14v11l-4.5 4.5H5z"/><path d="M14.5 20v-4.5H19M8.5 9h7M8.5 12.5h4"/>',
};

export function Icon({ name, size = 20, class: klass }) {
  return html`<svg class=${cx('icon', klass)} width=${size} height=${size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    dangerouslySetInnerHTML=${{ __html: ICONS[name] || '' }}></svg>`;
}

// ---------- Personen ----------

export function personColor(id) {
  const i = memberIndex(id);
  return i === 1 ? 'var(--p2)' : 'var(--p1)';
}

export function Avatar({ id, size = 22, both = false }) {
  if (both || !id) {
    const [a, b] = state.members;
    if (!a) return null;
    return html`<span class="avatar-pair" title="Beide">
      <${Avatar} id=${a.id} size=${size} />${b && html`<${Avatar} id=${b.id} size=${size} />`}
    </span>`;
  }
  const name = memberName(id, '?');
  return html`<span class="avatar" title=${name}
    style=${{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.48)}px`, background: personColor(id) }}>
    ${name.trim().charAt(0).toUpperCase() || '?'}</span>`;
}

export function PersonPicker({ value, onChange, allowBoth = false }) {
  const opts = state.members.map((m) => ({ value: m.id, label: memberName(m.id) }));
  if (allowBoth) opts.unshift({ value: null, label: 'Beide' });
  return html`<${Segmented} options=${opts} value=${value ?? null} onChange=${onChange} />`;
}

// ---------- Eingaben ----------

export function Segmented({ options, value, onChange, small }) {
  return html`<div class=${cx('segmented', small && 'small')} role="radiogroup">
    ${options.map((o) => html`<button type="button" role="radio" aria-checked=${o.value === value}
      class=${cx('seg', o.value === value && 'on')} onClick=${() => onChange(o.value)}>${o.label}</button>`)}
  </div>`;
}

export function Field({ label, hint, children, as = 'label' }) {
  const body = html`<span class="field-label">${label}</span>${children}${hint && html`<span class="field-hint">${hint}</span>`}`;
  return as === 'div' ? html`<div class="field">${body}</div>` : html`<label class="field">${body}</label>`;
}

export function RoomSelect({ value, onChange, categories = false, noneLabel = 'Kein Raum' }) {
  return html`<select class="input" value=${value || ''} onChange=${(e) => onChange(e.currentTarget.value)}>
    <option value="">${noneLabel}</option>
    ${state.rooms.map((r) => html`<option value=${`room:${r.id}`}>${r.emoji ? `${r.emoji} ` : ''}${r.name}</option>`)}
    ${categories && html`<option value="cat:umzug">📦 Umzug</option><option value="cat:allgemein">🧾 Allgemein</option>`}
  </select>`;
}

export function FileButton({ accept = 'image/*', multiple = false, onFiles, class: klass, children, label }) {
  const ref = useRef(null);
  return html`<button type="button" class=${klass || 'btn'} aria-label=${label} onClick=${() => ref.current?.click()}>
    ${children}
  </button><input ref=${ref} type="file" hidden accept=${accept} multiple=${multiple}
    onChange=${(e) => {
      const files = [...(e.currentTarget.files || [])];
      e.currentTarget.value = '';
      if (files.length) onFiles(files);
    }} />`;
}

export function CheckButton({ checked, onChange, label }) {
  return html`<button type="button" class=${cx('check', checked && 'on')} role="checkbox" aria-checked=${!!checked}
    aria-label=${label} onClick=${(e) => { e.stopPropagation(); onChange(!checked); }}>
    <${Icon} name="check" size=${14} />
  </button>`;
}

// ---------- Layout ----------

export function PageHeader({ title, kicker, back, actions }) {
  return html`<header class="page-head">
    ${back && html`<a class="back" href=${back.href}><${Icon} name="back" size=${18} />${back.label}</a>`}
    <div class="page-head-row">
      <div class="page-head-text">
        ${kicker && html`<div class="kicker">${kicker}</div>`}
        <h1>${title}</h1>
      </div>
      <div class="page-head-actions">
        ${actions}
        <button class="icon-btn settings-btn" aria-label="Einstellungen"
          onClick=${() => window.dispatchEvent(new Event('wohnung:einstellungen'))}>
          <${Icon} name="settings" />
        </button>
      </div>
    </div>
  </header>`;
}

export function Fab({ icon = 'plus', label, onClick }) {
  return html`<button class="fab" onClick=${onClick}><${Icon} name=${icon} size=${20} /><span>${label}</span></button>`;
}

export function Empty({ emoji, title, text, children }) {
  return html`<div class="empty">
    ${emoji && html`<div class="empty-emoji">${emoji}</div>`}
    <div class="empty-title">${title}</div>
    ${text && html`<p>${text}</p>`}
    ${children}
  </div>`;
}

export function Bar({ parts, height = 10 }) {
  return html`<div class="bar" style=${{ height: `${height}px` }}>
    ${parts.filter((p) => p.value > 0).map((p) => html`<span class=${cx('bar-part', p.class)}
      style=${{ flexGrow: p.value, background: p.color }}></span>`)}
  </div>`;
}

export function Thumb({ path, emoji = '🏠', alt = '', class: klass }) {
  const src = path ? urlFor(path) : null;
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const external = /^https?:\/\//i.test(path || '');
  if (src && !broken && (isImagePath(path) || external)) {
    return html`<img class=${cx('thumb', klass)} src=${src} alt=${alt} loading="lazy" onError=${() => setBroken(true)} />`;
  }
  if (path && !external && !isImagePath(path)) {
    return html`<div class=${cx('thumb thumb-ph', klass)}><${Icon} name="file" size=${28} /><span>PDF</span></div>`;
  }
  return html`<div class=${cx('thumb thumb-ph', klass)}><span class="thumb-emoji">${emoji}</span></div>`;
}

// ---------- Overlays ----------

export function Sheet({ title, children, footer, onClose = closeSheet }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('noscroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('noscroll');
    };
  }, []);
  return html`<div class="overlay" onClick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="sheet" role="dialog" aria-modal="true" aria-label=${title}>
      <div class="sheet-grip"></div>
      <div class="sheet-head">
        <h2>${title}</h2>
        <button class="icon-btn" onClick=${onClose} aria-label="Schließen"><${Icon} name="x" /></button>
      </div>
      <div class="sheet-body">${children}</div>
      ${footer && html`<div class="sheet-foot">${footer}</div>`}
    </div>
  </div>`;
}

export function ConfirmHost() {
  const c = state.confirm;
  if (!c) return null;
  return html`<div class="overlay center" onClick=${(e) => { if (e.target === e.currentTarget) c.resolve(false); }}>
    <div class="dialog" role="alertdialog" aria-modal="true">
      <h3>${c.title}</h3>
      ${c.text && html`<p>${c.text}</p>`}
      <div class="dialog-actions">
        <button class="btn ghost" onClick=${() => c.resolve(false)}>${c.cancelLabel || 'Abbrechen'}</button>
        <button class=${cx('btn', c.danger ? 'danger' : 'primary')} onClick=${() => c.resolve(true)}>${c.okLabel || 'OK'}</button>
      </div>
    </div>
  </div>`;
}

export function ToastHost() {
  const t = state.toast;
  if (!t) return null;
  return html`<div class=${cx('toast', t.kind === 'error' && 'error')} role="status" key=${t.id}>${t.text}</div>`;
}

export function LightboxHost() {
  const f = state.lightbox;
  const [zoom, setZoom] = useState(false);
  useEffect(() => setZoom(false), [f]);
  useEffect(() => {
    if (!f) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeLightbox(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [f]);
  if (!f) return null;
  const src = urlFor(f.path);
  const isImg = isImagePath(f.path) || (src || '').startsWith('data:image');
  const del = async () => {
    const ok = await confirmDialog({ title: 'Datei löschen?', text: 'Das kann nicht rückgängig gemacht werden.', okLabel: 'Löschen', danger: true });
    if (ok) {
      closeLightbox();
      deleteFile(f);
    }
  };
  return html`<div class="lightbox" role="dialog" aria-modal="true" aria-label="Bild">
    <div class="lightbox-bar">
      <span class="lightbox-name">${f.name || ''}</span>
      ${src && html`<a class="icon-btn light" href=${src} target="_blank" rel="noopener" aria-label="In neuem Tab öffnen"><${Icon} name="link" /></a>`}
      ${f.id && html`<button class="icon-btn light" onClick=${del} aria-label="Löschen"><${Icon} name="trash" /></button>`}
      <button class="icon-btn light" onClick=${closeLightbox} aria-label="Schließen"><${Icon} name="x" /></button>
    </div>
    <div class=${cx('lightbox-stage', zoom && 'zoomed')} onClick=${(e) => { if (e.target === e.currentTarget) closeLightbox(); }}>
      ${isImg && src
        ? html`<img src=${src} alt=${f.name || ''} onClick=${() => setZoom(!zoom)} />`
        : html`<div class="lightbox-file"><${Icon} name="file" size=${48} />
            <p>${f.name || 'Datei'}</p>
            ${src && html`<a class="btn primary" href=${src} target="_blank" rel="noopener">Öffnen</a>`}</div>`}
    </div>
    ${isImg && html`<div class="lightbox-hint">${zoom ? 'Tippen zum Verkleinern' : 'Tippen zum Vergrößern'}</div>`}
  </div>`;
}
