import { html, useState, useEffect, useRef, cx, money, sum, plural } from '../lib.js';
import {
  useStore, state, roomById, uploadFile, openLightbox, patch, toast,
} from '../store.js';
import {
  PageHeader, Icon, FileButton, Thumb, Empty, Fab, Segmented,
} from '../ui.js';
import { openRoomSheet, openItemSheet } from '../sheets.js';
import { ItemCard } from './parts.js';

const PLAN_ACCEPT = 'image/*,application/pdf';

async function uploadMany(files, opts, setBusy) {
  setBusy(true);
  let ok = 0;
  for (const f of files) {
    if (f.size > 25 * 1024 * 1024) {
      toast(`${f.name} ist zu groß (max. 25 MB).`, 'error');
    } else if (await uploadFile(f, opts)) ok++;
  }
  setBusy(false);
  if (ok) toast(ok === 1 ? 'Hochgeladen.' : `${ok} Dateien hochgeladen.`);
}

function roomStats(roomId) {
  const items = state.items.filter((i) => i.room_id === roomId);
  const photos = state.files.filter((f) => f.room_id === roomId && f.kind === 'foto');
  const spent = sum(state.expenses.filter((e) => e.room_id === roomId), (e) => e.amount);
  const planned = sum(items.filter((i) => i.status === 'geplant'), (i) => i.price);
  const ideas = sum(items.filter((i) => i.status === 'idee'), (i) => i.price);
  return { items, photos, spent, planned, ideas };
}

function RoomCard({ room }) {
  const { items, photos, spent, planned } = roomStats(room.id);
  const cover = photos[photos.length - 1]?.path || items.find((i) => i.image)?.image;
  const parts = [];
  if (items.length) parts.push(plural(items.length, 'Sache', 'Sachen'));
  if (photos.length) parts.push(plural(photos.length, 'Foto', 'Fotos'));
  return html`<a class="room-card" href=${`#/raeume/${room.id}`}>
    <div class="room-cover"><${Thumb} path=${cover} emoji=${room.emoji || '🏠'} /></div>
    <div class="room-info">
      <div class="room-name"><span>${room.emoji}</span> ${room.name}</div>
      <div class="room-meta">${parts.join(' · ') || 'Noch keine Sachen'}</div>
      ${spent + planned > 0 && html`<div class="room-money">${money(spent + planned)} <span>verplant</span></div>`}
    </div>
  </a>`;
}

export function Rooms() {
  const s = useStore();
  const [busy, setBusy] = useState(false);
  const plans = s.files.filter((f) => f.kind === 'grundriss');
  const upload = (files) => uploadMany(files, { kind: 'grundriss' }, setBusy);

  return html`<div class="page">
    <${PageHeader} title="Räume" kicker=${`${plural(s.rooms.length, 'Raum', 'Räume')} · ${plural(s.items.length, 'Sache', 'Sachen')}`} />

    <section class="section">
      <div class="section-head">
        <h2>Grundriss</h2>
        ${plans.length > 0 && html`<${FileButton} class="btn small" accept=${PLAN_ACCEPT} multiple onFiles=${upload}>
          <${Icon} name="plus" size=${16} />${busy ? 'Lädt …' : 'Hinzufügen'}<//>`}
      </div>
      ${plans.length === 0
        ? html`<${FileButton} class="upload-card" accept=${PLAN_ACCEPT} multiple onFiles=${upload}>
            <${Icon} name="rooms" size=${30} />
            <strong>${busy ? 'Lädt hoch …' : 'Grundriss hochladen'}</strong>
            <span>Foto, Screenshot oder PDF – z. B. aus dem Exposé</span>
          <//>`
        : html`<div class="plans">
            ${plans.map((p, i) => html`<button key=${p.id} class=${cx('plan', i === 0 && 'plan-main')} onClick=${() => openLightbox(p)}
                aria-label=${`Grundriss ${i + 1} öffnen`}>
              <${Thumb} path=${p.path} emoji="📐" />
              ${i === 0 && html`<span class="plan-zoom"><${Icon} name="zoom" size=${16} /></span>`}
            </button>`)}
          </div>`}
    </section>

    <section class="section">
      <div class="section-head"><h2>Räume</h2></div>
      <div class="room-grid">
        ${s.rooms.map((r) => html`<${RoomCard} key=${r.id} room=${r} />`)}
        <button class="room-card room-add" onClick=${() => openRoomSheet()}>
          <${Icon} name="plus" size=${22} /><span>Raum hinzufügen</span>
        </button>
      </div>
    </section>
  </div>`;
}

function RoomNotes({ room }) {
  const [text, setText] = useState(room.notes || '');
  const [dirty, setDirty] = useState(false);
  const timer = useRef(null);
  const latest = useRef(text);
  useEffect(() => {
    if (!dirty) setText(room.notes || '');
  }, [room.notes]);
  const flush = async () => {
    clearTimeout(timer.current);
    timer.current = null;
    await patch('rooms', room.id, { notes: latest.current.trim() || null });
    setDirty(false);
  };
  useEffect(() => () => { if (timer.current) flush(); }, []);
  const onInput = (e) => {
    latest.current = e.currentTarget.value;
    setText(latest.current);
    setDirty(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 900);
  };
  return html`<div class="notes">
    <textarea class="input notes-area" rows="10" value=${text} onInput=${onInput} onBlur=${() => timer.current && flush()}
      placeholder=${'Maße, Farben, Ideen, was noch fehlt …\n\nz. B. Wand hinter dem Sofa: 3,20 m\nFenster: 1,40 m breit'}></textarea>
    <div class="meta-line">${dirty ? 'Speichert …' : 'Wird automatisch gespeichert'}</div>
  </div>`;
}

const FILTERS = [
  { value: 'alle', label: 'Alle' },
  { value: 'idee', label: 'Ideen' },
  { value: 'geplant', label: 'Geplant' },
  { value: 'gekauft', label: 'Gekauft' },
];

export function RoomDetail({ id }) {
  const s = useStore();
  const [tab, setTab] = useState('sachen');
  const [filter, setFilter] = useState('alle');
  const [busy, setBusy] = useState(false);
  const room = roomById(id);
  if (!room) {
    return html`<div class="page">
      <${PageHeader} title="Raum nicht gefunden" back=${{ href: '#/raeume', label: 'Räume' }} />
      <${Empty} emoji="🤷" title="Diesen Raum gibt es nicht mehr." />
    </div>`;
  }
  const { items, photos, spent, planned, ideas } = roomStats(id);
  const shown = filter === 'alle' ? items : items.filter((i) => i.status === filter);
  const uploadPhotos = (files) => uploadMany(files, { kind: 'foto', room_id: id }, setBusy);

  return html`<div class="page">
    <${PageHeader} title=${html`<span class="title-emoji">${room.emoji}</span>${room.name}`}
      back=${{ href: '#/raeume', label: 'Räume' }}
      actions=${html`<button class="icon-btn" aria-label="Raum bearbeiten" onClick=${() => openRoomSheet(room)}><${Icon} name="edit" /></button>`} />

    <div class="stat-chips">
      <div class="stat-chip"><span>Gekauft</span><b>${money(spent)}</b></div>
      <div class="stat-chip"><span>Geplant</span><b>${money(planned)}</b></div>
      <div class="stat-chip muted"><span>Ideen</span><b>${money(ideas)}</b></div>
    </div>

    <div class="tabs-row">
      <${Segmented} value=${tab} onChange=${setTab} options=${[
        { value: 'sachen', label: `Sachen ${items.length ? `(${items.length})` : ''}` },
        { value: 'fotos', label: `Fotos ${photos.length ? `(${photos.length})` : ''}` },
        { value: 'notizen', label: 'Notizen' },
      ]} />
    </div>

    ${tab === 'sachen' && html`
      ${items.length > 0 && html`<div class="filter-row">${FILTERS.map((f) => html`<button key=${f.value}
        class=${cx('filter', filter === f.value && 'on')} onClick=${() => setFilter(f.value)}>${f.label}</button>`)}</div>`}
      ${shown.length
        ? html`<div class="item-grid">${shown.map((i) => html`<${ItemCard} key=${i.id} item=${i} />`)}</div>`
        : html`<${Empty} emoji=${room.emoji || '✨'} title=${items.length ? 'Nichts in dieser Ansicht' : 'Noch keine Sachen'}
            text=${items.length ? null : 'Sammelt hier, was ihr für den Raum gut findet: mit Foto, Preis und Link.'}>
            ${!items.length && html`<button class="btn primary" onClick=${() => openItemSheet(null, { room_id: id })}>
              <${Icon} name="plus" size=${18} />Erste Sache</button>`}
          <//>`}
      <${Fab} label="Sache" onClick=${() => openItemSheet(null, { room_id: id, status: filter !== 'alle' ? filter : 'idee' })} />
    `}

    ${tab === 'fotos' && html`
      ${photos.length
        ? html`<div class="photo-grid">${[...photos].reverse().map((p) => html`<button key=${p.id} class="photo" onClick=${() => openLightbox(p)}>
            <${Thumb} path=${p.path} emoji="📷" /></button>`)}</div>`
        : html`<${Empty} emoji="📷" title="Noch keine Fotos" text="Wie sieht der Raum gerade aus? Fotos von der Besichtigung, Steckdosen, Ecken zum Ausmessen …" />`}
      <${FileButton} class="fab" accept="image/*" multiple onFiles=${uploadPhotos} label="Fotos hinzufügen">
        <${Icon} name="camera" size=${20} /><span>${busy ? 'Lädt …' : 'Fotos'}</span>
      <//>
    `}

    ${tab === 'notizen' && html`<${RoomNotes} key=${room.id} room=${room} />`}
  </div>`;
}
