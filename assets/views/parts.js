// Listen-Bausteine, die auf mehreren Seiten vorkommen.
import { html, cx, money, fmtDate, relDay, daysUntil, taskDue } from '../lib.js';
import { state, patch, roomById, memberName } from '../store.js';
import { Icon, Avatar, CheckButton, Thumb } from '../ui.js';
import { openTaskSheet, openItemSheet, openPurchase, openExpenseSheet } from '../sheets.js';

const onKeyOpen = (fn) => (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fn();
  }
};

export function toggleTask(task, done) {
  return patch('tasks', task.id, { done, done_at: done ? new Date().toISOString() : null });
}

export function TaskRow({ task, hideRoom, inPhase }) {
  // In der Checkliste steht das ungefähre Datum schon im Phasen-Kopf.
  const due = inPhase && !task.due_date ? null : taskDue(task, state.settings.move_date);
  const n = due ? daysUntil(due) : null;
  const room = !hideRoom && task.room_id && roomById(task.room_id);
  const open = () => openTaskSheet(task);
  const showMeta = (due && !task.done) || room || task.notes;
  return html`<div class=${cx('task', task.done && 'done')} role="button" tabindex="0" onClick=${open} onKeyDown=${onKeyOpen(open)}>
    <${CheckButton} checked=${task.done} onChange=${(v) => toggleTask(task, v)} label="Erledigt" />
    <div class="task-main">
      <div class="task-title">${task.title}</div>
      ${showMeta && html`<div class="task-meta">
        ${due && !task.done && html`<span class=${cx('chip', n < 0 && 'chip-danger', n === 0 && 'chip-warn')}>
          <${Icon} name="calendar" size=${13} />${relDay(due)}${!task.due_date && task.phase ? ' (ca.)' : ''}</span>`}
        ${room && html`<span class="chip">${room.emoji} ${room.name}</span>`}
        ${task.notes && html`<span class="chip"><${Icon} name="note" size=${13} />Notiz</span>`}
      </div>`}
    </div>
    ${task.assignee && html`<${Avatar} id=${task.assignee} size=${24} />`}
  </div>`;
}

export const STATUS_LABEL = { idee: 'Idee', geplant: 'Geplant', gekauft: 'Gekauft' };
const NEXT_STATUS = { idee: 'geplant', geplant: 'gekauft' };

export function StatusChip({ item }) {
  const next = NEXT_STATUS[item.status];
  const onClick = async (e) => {
    e.stopPropagation();
    if (!next) return openItemSheet(item);
    const ok = await patch('items', item.id, { status: next });
    if (ok && next === 'gekauft') openPurchase({ ...item, status: 'gekauft' });
    return null;
  };
  return html`<button type="button" class=${cx('status', `status-${item.status}`)} onClick=${onClick}
    title=${next ? `Tippen: weiter zu „${STATUS_LABEL[next]}“` : 'Gekauft'}>
    ${item.status === 'gekauft' && html`<${Icon} name="check" size=${13} />`}${STATUS_LABEL[item.status] || item.status}
  </button>`;
}

export function ItemCard({ item, showRoom }) {
  const room = roomById(item.room_id);
  const open = () => openItemSheet(item);
  return html`<article class=${cx('item-card', item.status === 'gekauft' && 'bought')} role="button" tabindex="0"
      onClick=${open} onKeyDown=${onKeyOpen(open)}>
    <div class="item-media">
      <${Thumb} path=${item.image} emoji=${room?.emoji || '✨'} alt=${item.title} />
      ${item.created_by && html`<span class="item-by"><${Avatar} id=${item.created_by} size=${22} /></span>`}
      ${item.url && html`<a class="item-link" href=${item.url} target="_blank" rel="noopener"
        onClick=${(e) => e.stopPropagation()} aria-label="Zum Shop"><${Icon} name="link" size=${15} /></a>`}
    </div>
    <div class="item-body">
      <div class="item-title">${item.title}</div>
      ${showRoom && room && html`<div class="item-room">${room.emoji} ${room.name}</div>`}
      <div class="item-foot">
        <span class="item-price">${item.price != null ? money(item.price) : ''}</span>
        <${StatusChip} item=${item} />
      </div>
    </div>
  </article>`;
}

export function areaLabel(e) {
  const room = e.room_id && roomById(e.room_id);
  if (room) return `${room.emoji || ''} ${room.name}`.trim();
  if (e.category === 'umzug') return '📦 Umzug';
  return '🧾 Allgemein';
}

export function ExpenseRow({ expense: e }) {
  const open = () => openExpenseSheet(e);
  return html`<div class="exp-row" role="button" tabindex="0" onClick=${open} onKeyDown=${onKeyOpen(open)}>
    <${Avatar} id=${e.paid_by} size=${30} />
    <div class="exp-main">
      <div class="exp-title">${e.title}</div>
      <div class="exp-meta">${areaLabel(e)} · ${fmtDate(e.date)} · ${memberName(e.paid_by)}</div>
    </div>
    <div class="exp-amount">${money(e.amount)}</div>
  </div>`;
}
