import {
  html, useState, cx, money, sum, PHASES, phaseRange, currentPhase, addDays, daysUntil,
} from '../lib.js';
import { useStore, patch, roomById } from '../store.js';
import {
  PageHeader, Icon, Bar, Empty, Fab, Segmented, CheckButton,
} from '../ui.js';
import {
  openSettings, openTaskSheet, openContractSheet, openBoxSheet, CONTRACT_STATUS,
} from '../sheets.js';
import { TaskRow } from './parts.js';

const TABS = [
  { value: 'checkliste', label: 'Checkliste' },
  { value: 'vertraege', label: 'Verträge' },
  { value: 'kisten', label: 'Kisten' },
];

function Checklist({ s }) {
  const move = s.settings.move_date;
  const tasks = s.tasks.filter((t) => t.phase);
  const doneCount = tasks.filter((t) => t.done).length;
  const now = currentPhase(move);
  return html`
    <section class="card progress-card">
      <div class="progress-top"><b>${doneCount} von ${tasks.length}</b> erledigt
        <span class="pct">${tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0} %</span></div>
      <${Bar} height=${10} parts=${[{ value: doneCount, class: 'good' }, { value: tasks.length - doneCount, class: 'free' }]} />
    </section>
    ${!move && html`<div class="hint">
      <${Icon} name="calendar" size=${18} />
      <span>Tragt euer Einzugsdatum ein, dann bekommt jeder Punkt ein konkretes Datum.</span>
      <button class="btn small" onClick=${openSettings}>Datum setzen</button>
    </div>`}
    ${PHASES.map((p) => {
      const rows = tasks.filter((t) => t.phase === p.key);
      const left = rows.filter((t) => !t.done).length;
      const late = move && left > 0 && daysUntil(addDays(move, p.to)) < 0;
      return html`<section key=${p.key} class=${cx('section tight phase', now === p.key && 'phase-now')}>
        <div class="phase-head">
          <div>
            <div class="phase-title">${p.title}${now === p.key && html`<span class="badge">Jetzt dran</span>`}</div>
            ${move && html`<div class=${cx('phase-range', late && 'text-danger')}>${phaseRange(p, move)}${late ? ' · überfällig' : ''}</div>`}
          </div>
          <span class=${cx('phase-count', left === 0 && rows.length > 0 && 'all-done')}>
            ${left === 0 && rows.length > 0 ? html`<${Icon} name="check" size=${14} />` : ''}${rows.length - left}/${rows.length}</span>
        </div>
        <div class="card list">
          ${rows.map((t) => html`<${TaskRow} key=${t.id} task=${t} inPhase />`)}
          <button class="add-row" onClick=${() => openTaskSheet(null, { phase: p.key })}>
            <${Icon} name="plus" size=${16} />Punkt hinzufügen</button>
        </div>
      </section>`;
    })}`;
}

const NEXT_CONTRACT = { offen: 'laeuft', laeuft: 'erledigt', erledigt: 'offen' };
const CONTRACT_LABEL = Object.fromEntries(CONTRACT_STATUS.map((x) => [x.value, x.label]));

function Contracts({ s }) {
  const monthly = sum(s.contracts, (c) => c.monthly_cost);
  const done = s.contracts.filter((c) => c.status === 'erledigt').length;
  return html`
    <section class="card summary-row">
      <div><div class="label">Fixkosten pro Monat</div><div class="mid-num">${money(monthly)}</div></div>
      <div class="align-right"><div class="label">Erledigt</div><div class="mid-num">${done}<small> / ${s.contracts.length}</small></div></div>
    </section>
    ${s.contracts.length
      ? html`<div class="card list">${s.contracts.map((c) => html`<div key=${c.id} class="contract" role="button" tabindex="0"
          onClick=${() => openContractSheet(c)} onKeyDown=${(e) => { if (e.key === 'Enter') openContractSheet(c); }}>
          <div class="contract-main">
            <div class="contract-name">${c.name}</div>
            <div class="contract-meta">${c.provider || 'Anbieter noch offen'}${c.customer_no ? ` · Nr. ${c.customer_no}` : ''}</div>
            ${c.notes && html`<div class="contract-notes">${c.notes}</div>`}
          </div>
          <div class="contract-side">
            <button type="button" class=${cx('status', `cstatus-${c.status}`)} title="Tippen zum Weiterschalten"
              onClick=${(e) => { e.stopPropagation(); patch('contracts', c.id, { status: NEXT_CONTRACT[c.status] || 'offen' }); }}>
              ${c.status === 'erledigt' && html`<${Icon} name="check" size=${13} />`}${CONTRACT_LABEL[c.status] || c.status}</button>
            ${c.monthly_cost != null && html`<div class="contract-cost">${money(c.monthly_cost)}<span>/Monat</span></div>`}
          </div>
        </div>`)}</div>`
      : html`<${Empty} emoji="📄" title="Noch keine Verträge" />`}
    <${Fab} label="Vertrag" onClick=${() => openContractSheet(null)} />`;
}

function Boxes({ s }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const unpacked = s.boxes.filter((b) => b.unpacked).length;
  const shown = s.boxes.filter((b) => {
    if (!needle) return true;
    const room = roomById(b.room_id);
    return String(b.number) === needle
      || (b.contents || '').toLowerCase().includes(needle)
      || (room?.name || '').toLowerCase().includes(needle);
  });
  return html`
    <section class="card summary-row">
      <div><div class="label">Kisten</div><div class="mid-num">${s.boxes.length}</div></div>
      <div class="align-right"><div class="label">Ausgepackt</div><div class="mid-num">${unpacked}<small> / ${s.boxes.length}</small></div></div>
    </section>
    ${s.boxes.length > 0 && html`<div class="search">
      <${Icon} name="search" size=${18} />
      <input class="input" type="search" placeholder="Suchen: z. B. Ladekabel, Küche, 12" value=${q}
        onInput=${(e) => setQ(e.currentTarget.value)} aria-label="Kisten durchsuchen" />
    </div>`}
    ${shown.length
      ? html`<div class="box-list">${shown.map((b) => {
        const room = roomById(b.room_id);
        return html`<div key=${b.id} class=${cx('box', b.unpacked && 'done')} role="button" tabindex="0"
            onClick=${() => openBoxSheet(b)} onKeyDown=${(e) => { if (e.key === 'Enter') openBoxSheet(b); }}>
          <div class="box-no">${b.number}</div>
          <div class="box-main">
            <div class="box-room">${room ? `${room.emoji || ''} ${room.name}` : 'Ohne Zielraum'}
              ${b.fragile && html`<span class="chip chip-warn">Zerbrechlich</span>`}</div>
            <div class="box-contents">${b.contents || '—'}</div>
          </div>
          <${CheckButton} checked=${b.unpacked} label="Ausgepackt" onChange=${(v) => patch('boxes', b.id, { unpacked: v })} />
        </div>`;
      })}</div>`
      : html`<${Empty} emoji="📦" title=${s.boxes.length ? 'Keine Kiste gefunden' : 'Noch keine Kisten'}
          text=${s.boxes.length ? null : 'Jede Kiste bekommt eine Nummer. Schreibt sie groß drauf und tragt hier ein, was drin ist und wohin sie kommt.'} />`}
    <${Fab} label="Kiste" onClick=${() => openBoxSheet(null)} />`;
}

export function Umzug({ sub }) {
  const s = useStore();
  const tab = TABS.some((t) => t.value === sub) ? sub : 'checkliste';
  return html`<div class="page">
    <${PageHeader} title="Umzug" kicker=${s.settings.move_date ? null : 'Einzugsdatum noch offen'} />
    <div class="tabs-row">
      <${Segmented} value=${tab} options=${TABS} onChange=${(v) => { location.hash = `#/umzug/${v}`; }} />
    </div>
    ${tab === 'checkliste' && html`<${Checklist} s=${s} />`}
    ${tab === 'vertraege' && html`<${Contracts} s=${s} />`}
    ${tab === 'kisten' && html`<${Boxes} s=${s} />`}
  </div>`;
}
