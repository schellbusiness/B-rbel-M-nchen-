import { html, useState, cx, money, sum } from '../lib.js';
import { useStore, memberName } from '../store.js';
import {
  PageHeader, Icon, Bar, Avatar, Empty, Fab, personColor,
} from '../ui.js';
import { openSettings, openExpenseSheet } from '../sheets.js';
import { ExpenseRow } from './parts.js';

const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return monthFmt.format(new Date(y, m - 1, 1));
};

export function Budget() {
  const s = useStore();
  const [who, setWho] = useState('alle');
  const budget = Number(s.settings.budget) || 0;
  const spent = sum(s.expenses, (e) => e.amount);
  const planned = sum(s.items.filter((i) => i.status === 'geplant'), (i) => i.price);
  const free = budget - spent - planned;

  const people = s.members.map((m) => ({ id: m.id, total: sum(s.expenses.filter((e) => e.paid_by === m.id), (e) => e.amount) }));

  const roomIds = new Set(s.rooms.map((r) => r.id));
  const areas = [
    ...s.rooms.map((r) => ({
      key: r.id,
      label: `${r.emoji || ''} ${r.name}`,
      href: `#/raeume/${r.id}`,
      spent: sum(s.expenses.filter((e) => e.room_id === r.id), (e) => e.amount),
      planned: sum(s.items.filter((i) => i.room_id === r.id && i.status === 'geplant'), (i) => i.price),
    })),
    {
      key: 'umzug', label: '📦 Umzug', planned: 0,
      spent: sum(s.expenses.filter((e) => !roomIds.has(e.room_id) && e.category === 'umzug'), (e) => e.amount),
    },
    {
      key: 'allgemein', label: '🧾 Allgemein', planned: 0,
      spent: sum(s.expenses.filter((e) => !roomIds.has(e.room_id) && e.category !== 'umzug'), (e) => e.amount),
    },
  ].filter((a) => a.spent + a.planned > 0);
  const maxArea = Math.max(1, ...areas.map((a) => a.spent + a.planned));

  const list = who === 'alle' ? s.expenses : s.expenses.filter((e) => e.paid_by === who);
  const months = [];
  for (const e of list) {
    const ym = (e.date || '').slice(0, 7);
    let g = months[months.length - 1];
    if (!g || g.ym !== ym) {
      g = { ym, items: [] };
      months.push(g);
    }
    g.items.push(e);
  }

  return html`<div class="page">
    <${PageHeader} title="Budget" kicker=${`${s.expenses.length} Ausgaben`} />

    <div class="budget-grid">
      <section class="card budget-card">
        <div class="budget-top">
          <div>
            <div class="label">Ausgegeben</div>
            <div class="big-num">${money(spent)}</div>
            <div class="sub">${budget
              ? html`von ${money(budget)} Budget`
              : html`<button class="link" onClick=${openSettings}>Gesamtbudget festlegen</button>`}</div>
          </div>
          <button class="icon-btn" aria-label="Budget ändern" onClick=${openSettings}><${Icon} name="edit" /></button>
        </div>
        ${budget > 0 && html`<${Bar} height=${14} parts=${[
          { value: spent, class: 'spent' },
          { value: planned, class: 'planned' },
          { value: Math.max(free, 0), class: 'free' },
        ]} />`}
        <div class="legend">
          <span><i class="dot spent"></i>Ausgegeben <b>${money(spent)}</b></span>
          <span><i class="dot planned"></i>Geplant <b>${money(planned)}</b></span>
          ${budget > 0 && html`<span><i class="dot free"></i>${free >= 0 ? 'Noch frei ' : 'Über Budget '}<b class=${cx(free < 0 && 'text-danger')}>${money(Math.abs(free))}</b></span>`}
        </div>
      </section>

      <section class="card">
        <h3 class="card-title">Wer hat was bezahlt</h3>
        ${spent > 0 && html`<${Bar} height=${10} parts=${people.map((p) => ({ value: p.total, color: personColor(p.id) }))} />`}
        <div class="people">
          ${people.map((p) => html`<div key=${p.id} class="person-row">
            <${Avatar} id=${p.id} size=${30} />
            <span class="name">${memberName(p.id)}</span>
            <span class="pct">${spent ? Math.round((p.total / spent) * 100) : 0} %</span>
            <b>${money(p.total)}</b>
          </div>`)}
        </div>
      </section>

      <section class="card">
        <h3 class="card-title">Nach Bereich</h3>
        ${areas.length
          ? html`<div class="areas">${areas.map((a) => html`<${a.href ? 'a' : 'div'} key=${a.key} class="area-row" href=${a.href}>
              <div class="area-top"><span>${a.label}</span><b>${money(a.spent)}</b></div>
              <${Bar} height=${6} parts=${[
                { value: a.spent, class: 'spent' },
                { value: a.planned, class: 'planned' },
                { value: maxArea - a.spent - a.planned, class: 'none' },
              ]} />
              ${a.planned > 0 && html`<div class="area-sub">+ ${money(a.planned)} geplant</div>`}
            <//>`)}</div>`
          : html`<p class="muted">Sobald ihr etwas eintragt, seht ihr hier, wohin das Geld geht.</p>`}
      </section>
    </div>

    <section class="section">
      <div class="section-head">
        <h2>Ausgaben</h2>
        <div class="filter-row tight">
          <button class=${cx('filter', who === 'alle' && 'on')} onClick=${() => setWho('alle')}>Alle</button>
          ${s.members.map((m) => html`<button key=${m.id} class=${cx('filter', who === m.id && 'on')} onClick=${() => setWho(m.id)}>${memberName(m.id)}</button>`)}
        </div>
      </div>
      ${months.length
        ? months.map((g) => html`<div key=${g.ym} class="month">
            <div class="month-head"><span>${g.ym ? monthLabel(g.ym) : 'Ohne Datum'}</span><span>${money(sum(g.items, (e) => e.amount))}</span></div>
            <div class="card list">${g.items.map((e) => html`<${ExpenseRow} key=${e.id} expense=${e} />`)}</div>
          </div>`)
        : html`<${Empty} emoji="🧾" title="Noch keine Ausgaben" text="Tragt hier ein, was ihr bezahlt habt: Möbel, Kartons, Transporter …" />`}
    </section>

    <${Fab} label="Ausgabe" onClick=${() => openExpenseSheet(null)} />
  </div>`;
}
