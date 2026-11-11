import { html, money, sum, daysUntil, fmtDate, taskDue } from '../lib.js';
import { useStore, me, roomById } from '../store.js';
import { Icon, Bar, Thumb, Avatar, Empty } from '../ui.js';
import { openSettings, openItemSheet } from '../sheets.js';
import { TaskRow, StatusChip } from './parts.js';

const HOUSE = html`<svg class="hero-art" viewBox="0 0 170 130" fill="none" stroke="currentColor" stroke-width="2.4"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M14 122h142" />
  <path d="M34 122V62L82 24l48 38v60" />
  <path d="M24 68 82 20l58 48" />
  <path d="M108 37V20h12v27" />
  <rect x="48" y="70" width="24" height="22" rx="2.5" /><path d="M60 70v22M48 81h24" />
  <path d="M92 122V84h24v38" /><circle cx="110" cy="104" r="1.8" fill="currentColor" />
  <path d="M146 122c0-12 3-19 9-25M150 122c-1-9-6-15-13-18M147 108c3-5 8-8 13-8" />
  <path d="M74 50h16" opacity=".5" />
</svg>`;

function Countdown({ move }) {
  if (!move) {
    return html`<h1 class="hero-title">Unser neues Zuhause</h1>
      <button class="btn hero-btn" onClick=${openSettings}><${Icon} name="calendar" size=${18} />Einzugsdatum festlegen</button>`;
  }
  const n = daysUntil(move);
  if (n > 0) {
    return html`<div class="hero-count"><span class="num">${n}</span><span class="unit">${n === 1 ? 'Tag' : 'Tage'}</span></div>
      <div class="hero-sub">bis zum Einzug · ${fmtDate(move, 'long')}</div>`;
  }
  if (n === 0) return html`<h1 class="hero-title">Heute ist Umzugstag! 📦</h1>`;
  return html`<h1 class="hero-title">Seit ${-n} ${n === -1 ? 'Tag' : 'Tagen'} zuhause 🏡</h1>`;
}

export function Overview() {
  const s = useStore();
  const move = s.settings.move_date;
  const budget = Number(s.settings.budget) || 0;
  const spent = sum(s.expenses, (e) => e.amount);
  const planned = sum(s.items.filter((i) => i.status === 'geplant'), (i) => i.price);
  const checklist = s.tasks.filter((t) => t.phase);
  const checklistDone = checklist.filter((t) => t.done).length;
  const openTodos = s.tasks.filter((t) => !t.phase && !t.done);
  const isOverdue = (t) => {
    if (t.done) return false;
    const d = taskDue(t, move);
    return !!d && daysUntil(d) < 0;
  };
  const overdueTodos = openTodos.filter(isOverdue).length;
  const overdueChecklist = checklist.filter(isOverdue).length;
  const next = s.tasks.filter((t) => !t.done)
    .map((t) => ({ t, due: taskDue(t, move) || '9999-12-31' }))
    .sort((a, b) => a.due.localeCompare(b.due) || (a.t.sort || 0) - (b.t.sort || 0))
    .slice(0, 5)
    .map((x) => x.t);
  const recent = s.items.slice(0, 10);
  const name = s.mode === 'supabase' ? me()?.name : null;

  return html`<div class="page">
    <section class="hero">
      <div class="hero-text">
        <div class="kicker">${name ? `Hallo ${name}` : 'Unsere Wohnung'}${s.settings.address ? html` · <span class="nowrap"><${Icon} name="pin" size=${13} /> ${s.settings.address}</span>` : ''}</div>
        <${Countdown} move=${move} />
      </div>
      ${HOUSE}
      <button class="icon-btn hero-settings settings-btn" aria-label="Einstellungen" onClick=${openSettings}><${Icon} name="settings" /></button>
    </section>

    <div class="tiles">
      <a class="tile tile-wide" href="#/budget">
        <div class="tile-label"><${Icon} name="wallet" size=${16} />Budget</div>
        <div class="tile-num">${money(spent)}</div>
        <div class="tile-sub">${budget ? `ausgegeben von ${money(budget)}` : 'ausgegeben'}${planned ? ` · ${money(planned)} geplant` : ''}</div>
        ${budget > 0 && html`<${Bar} height=${8} parts=${[
          { value: spent, class: 'spent' },
          { value: planned, class: 'planned' },
          { value: Math.max(budget - spent - planned, 0), class: 'free' },
        ]} />`}
      </a>
      <a class="tile" href="#/umzug">
        <div class="tile-label"><${Icon} name="truck" size=${16} />Umzug</div>
        <div class="tile-num">${checklistDone}<small> / ${checklist.length}</small></div>
        <div class="tile-sub">erledigt${overdueChecklist ? html` · <span class="text-danger">${overdueChecklist} überfällig</span>` : ''}</div>
        <${Bar} height=${6} parts=${[
          { value: checklistDone, class: 'good' },
          { value: checklist.length - checklistDone, class: 'free' },
        ]} />
      </a>
      <a class="tile" href="#/todos">
        <div class="tile-label"><${Icon} name="todo" size=${16} />To-Dos</div>
        <div class="tile-num">${openTodos.length}</div>
        <div class="tile-sub">${overdueTodos ? html`offen · <span class="text-danger">${overdueTodos} überfällig</span>` : 'offen'}</div>
      </a>
    </div>

    <section class="section">
      <div class="section-head"><h2>Als Nächstes</h2><a class="more" href="#/todos">Alle<${Icon} name="right" size=${16} /></a></div>
      ${next.length
        ? html`<div class="card list">${next.map((t) => html`<${TaskRow} key=${t.id} task=${t} />`)}</div>`
        : html`<${Empty} emoji="🎉" title="Alles erledigt" text="Gerade steht nichts an." />`}
    </section>

    <section class="section">
      <div class="section-head"><h2>Zuletzt hinzugefügt</h2><a class="more" href="#/raeume">Räume<${Icon} name="right" size=${16} /></a></div>
      ${recent.length
        ? html`<div class="scroller">${recent.map((i) => {
          const room = roomById(i.room_id);
          return html`<div key=${i.id} class="mini-item" role="button" tabindex="0" onClick=${() => openItemSheet(i)}
              onKeyDown=${(e) => { if (e.key === 'Enter') openItemSheet(i); }}>
              <div class="mini-media"><${Thumb} path=${i.image} emoji=${room?.emoji || '✨'} />
                ${i.created_by && html`<span class="item-by"><${Avatar} id=${i.created_by} size=${20} /></span>`}</div>
              <div class="mini-title">${i.title}</div>
              <div class="mini-meta">${room ? `${room.emoji || ''} ${room.name}` : 'Ohne Raum'}</div>
              <div class="mini-foot"><span>${i.price != null ? money(i.price) : ''}</span><${StatusChip} item=${i} /></div>
            </div>`;
        })}</div>`
        : html`<${Empty} emoji="🛋️" title="Noch nichts geplant" text="Öffne einen Raum und leg die erste Sache an: Sofa, Lampe, Regal …">
            <a class="btn" href="#/raeume">Zu den Räumen</a><//>`}
    </section>
  </div>`;
}
