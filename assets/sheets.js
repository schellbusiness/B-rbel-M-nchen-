// Formulare (öffnen sich als Fenster von unten bzw. mittig am Laptop).
import {
  html, useState, cx, money, parseMoney, moneyInput, todayISO, fmtDate, taskDue, PHASES,
} from './lib.js';
import {
  state, add, patch, remove, openSheet, closeSheet, toast, confirmDialog, uploadItemImage, discardFiles,
  deleteItem, deleteRoom, saveSettings, saveMyName, memberName, me, connectLink, signOut, leaveDemo,
  forgetConnection, changePassword,
} from './store.js';
import {
  Sheet, Field, Segmented, PersonPicker, RoomSelect, FileButton, Icon, Thumb,
} from './ui.js';

const toSel = (roomId, category) => (roomId ? `room:${roomId}` : category ? `cat:${category}` : '');
const fromSel = (v) => {
  if (v?.startsWith('room:')) return { room_id: v.slice(5), category: null };
  if (v?.startsWith('cat:')) return { room_id: null, category: v.slice(4) };
  return { room_id: null, category: null };
};
const normUrl = (u) => {
  const s = (u || '').trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
};
const val = (setF, k) => (e) => {
  const v = e?.currentTarget ? e.currentTarget.value : e;
  setF((x) => ({ ...x, [k]: v }));
};

function Footer({ onDelete, saveLabel = 'Speichern', disabled }) {
  return html`
    ${onDelete && html`<button type="button" class="btn ghost danger-text" onClick=${onDelete}><${Icon} name="trash" size=${18} />Löschen</button>`}
    <span class="grow"></span>
    <button type="button" class="btn ghost" onClick=${closeSheet}>Abbrechen</button>
    <button type="submit" form="sheet-form" class="btn primary" disabled=${disabled}>${saveLabel}</button>`;
}

const STATUS_OPTS = [
  { value: 'idee', label: 'Idee' },
  { value: 'geplant', label: 'Geplant' },
  { value: 'gekauft', label: 'Gekauft' },
];

// ---------- Sache (Wunschliste) ----------

export function openItemSheet(item, defaults = {}) {
  openSheet(() => html`<${ItemSheet} key=${item?.id || 'neu'} item=${item} defaults=${defaults} />`);
}

async function maybeRemoveExpense(item) {
  const exp = state.expenses.find((x) => x.item_id === item.id);
  if (!exp) return;
  const ok = await confirmDialog({
    title: 'Ausgabe auch entfernen?',
    text: `„${exp.title}“ (${money(exp.amount)}) steht noch in den Ausgaben.`,
    okLabel: 'Ausgabe löschen', cancelLabel: 'Behalten', danger: true,
  });
  if (ok) remove('expenses', exp.id);
}

function ItemSheet({ item, defaults }) {
  const isNew = !item;
  const [f, setF] = useState(() => ({
    title: item?.title || '',
    url: item?.url || '',
    price: moneyInput(item?.price),
    room: toSel(item ? item.room_id : defaults.room_id),
    status: item?.status || defaults.status || 'idee',
    notes: item?.notes || '',
    image: item?.image || null,
    imageUrl: '',
  }));
  const [busy, setBusy] = useState(false);

  const onImage = async ([file]) => {
    setBusy(true);
    const path = await uploadItemImage(file);
    setBusy(false);
    if (path) setF((x) => ({ ...x, image: path }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!f.title.trim()) return toast('Gib der Sache einen Namen.');
    const image = normUrl(f.imageUrl) || f.image || null;
    const row = {
      title: f.title.trim(), url: normUrl(f.url), price: parseMoney(f.price),
      room_id: fromSel(f.room).room_id, status: f.status, notes: f.notes.trim() || null, image,
    };
    closeSheet();
    if (isNew) {
      const created = await add('items', row);
      if (created && row.status === 'gekauft') openPurchase(created);
      return null;
    }
    if (item.image && item.image !== image) discardFiles([item.image]);
    const ok = await patch('items', item.id, row);
    if (ok && item.status !== 'gekauft' && row.status === 'gekauft') openPurchase({ ...item, ...row });
    if (ok && item.status === 'gekauft' && row.status !== 'gekauft') await maybeRemoveExpense(item);
    return null;
  };

  const del = async () => {
    const ok = await confirmDialog({ title: `„${item.title}“ löschen?`, okLabel: 'Löschen', danger: true });
    if (ok) {
      closeSheet();
      deleteItem(item);
    }
  };

  return html`<${Sheet} title=${isNew ? 'Neue Sache' : 'Sache bearbeiten'}
      footer=${html`<${Footer} onDelete=${!isNew && del} disabled=${busy} />`}>
    <form id="sheet-form" class="form" onSubmit=${save}>
      <div class="image-picker">
        ${f.image
          ? html`<div class="image-preview"><${Thumb} path=${f.image} />
              <button type="button" class="icon-btn on-image" aria-label="Bild entfernen"
                onClick=${() => setF((x) => ({ ...x, image: null }))}><${Icon} name="x" size=${18} /></button></div>`
          : html`<${FileButton} class="image-drop" onFiles=${onImage} label="Bild auswählen">
              <${Icon} name="camera" size=${26} /><span>${busy ? 'Lädt hoch …' : 'Foto oder Screenshot'}</span>
            <//>`}
      </div>
      ${!f.image && html`<input class="input small" type="url" inputmode="url" placeholder="… oder Bild-Adresse einfügen (https://…)"
        value=${f.imageUrl} onInput=${val(setF, 'imageUrl')} />`}
      <${Field} label="Was?">
        <input class="input" required placeholder="z. B. Sofa, Lampe, Regal" value=${f.title} onInput=${val(setF, 'title')} />
      <//>
      <div class="row2">
        <${Field} label="Preis">
          <input class="input" inputmode="decimal" placeholder="0 €" value=${f.price} onInput=${val(setF, 'price')} />
        <//>
        <${Field} label="Raum">
          <${RoomSelect} value=${f.room} onChange=${val(setF, 'room')} />
        <//>
      </div>
      <${Field} label="Status" as="div">
        <${Segmented} options=${STATUS_OPTS} value=${f.status} onChange=${val(setF, 'status')} />
      <//>
      <${Field} label="Link zum Shop">
        <input class="input" type="url" inputmode="url" placeholder="https://…" value=${f.url} onInput=${val(setF, 'url')} />
      <//>
      <${Field} label="Notiz">
        <textarea class="input" rows="2" placeholder="Maße, Farbe, Alternativen …" value=${f.notes} onInput=${val(setF, 'notes')}></textarea>
      <//>
      ${!isNew && html`<p class="meta-line">Eingetragen von ${memberName(item.created_by)} am ${fmtDate(item.created_at.slice(0, 10))}</p>`}
    </form>
  <//>`;
}

// ---------- Gekauft → Ausgabe ----------

export function openPurchase(item) {
  openSheet(() => html`<${PurchaseSheet} key=${`kauf-${item.id}`} item=${item} />`);
}

function PurchaseSheet({ item }) {
  const [amount, setAmount] = useState(moneyInput(item.price));
  const [payer, setPayer] = useState(state.userId);
  const [date, setDate] = useState(todayISO());
  const save = async (e) => {
    e.preventDefault();
    const a = parseMoney(amount);
    if (a == null) return toast('Bitte einen Betrag eingeben.');
    closeSheet();
    const ok = await add('expenses', {
      title: item.title, amount: a, paid_by: payer, room_id: item.room_id || null, item_id: item.id, date,
    });
    if (ok) toast('Als Ausgabe eingetragen.');
    return null;
  };
  return html`<${Sheet} title="Gekauft 🎉" footer=${html`
      <span class="grow"></span>
      <button type="button" class="btn ghost keep" onClick=${closeSheet}>Ohne Ausgabe</button>
      <button type="submit" form="sheet-form" class="btn primary">Ausgabe eintragen</button>`}>
    <form id="sheet-form" class="form" onSubmit=${save}>
      <p class="lead">„${item.title}“ in die Ausgaben übernehmen, damit das Budget stimmt?</p>
      <div class="row2">
        <${Field} label="Betrag">
          <input class="input" inputmode="decimal" value=${amount} onInput=${(e) => setAmount(e.currentTarget.value)} />
        <//>
        <${Field} label="Datum">
          <input class="input" type="date" value=${date} onInput=${(e) => setDate(e.currentTarget.value)} />
        <//>
      </div>
      <${Field} label="Wer hat bezahlt?" as="div">
        <${PersonPicker} value=${payer} onChange=${setPayer} />
      <//>
    </form>
  <//>`;
}

// ---------- Ausgabe ----------

export function openExpenseSheet(expense, defaults = {}) {
  openSheet(() => html`<${ExpenseSheet} key=${expense?.id || 'neu'} expense=${expense} defaults=${defaults} />`);
}

function ExpenseSheet({ expense, defaults }) {
  const isNew = !expense;
  const [f, setF] = useState(() => ({
    title: expense?.title || '',
    amount: moneyInput(expense?.amount),
    paid_by: expense?.paid_by || state.userId,
    area: toSel(expense?.room_id ?? defaults.room_id, expense?.category ?? defaults.category),
    date: expense?.date || todayISO(),
    notes: expense?.notes || '',
  }));
  const linked = expense?.item_id && state.items.find((i) => i.id === expense.item_id);
  const save = async (e) => {
    e.preventDefault();
    const amount = parseMoney(f.amount);
    if (!f.title.trim()) return toast('Wofür war die Ausgabe?');
    if (amount == null) return toast('Bitte einen Betrag eingeben.');
    const row = {
      title: f.title.trim(), amount, paid_by: f.paid_by, ...fromSel(f.area),
      date: f.date || todayISO(), notes: f.notes.trim() || null,
    };
    closeSheet();
    if (isNew) await add('expenses', row);
    else await patch('expenses', expense.id, row);
    return null;
  };
  const del = async () => {
    const ok = await confirmDialog({ title: 'Ausgabe löschen?', text: `${expense.title} · ${money(expense.amount)}`, okLabel: 'Löschen', danger: true });
    if (ok) {
      closeSheet();
      remove('expenses', expense.id);
    }
  };
  return html`<${Sheet} title=${isNew ? 'Neue Ausgabe' : 'Ausgabe bearbeiten'} footer=${html`<${Footer} onDelete=${!isNew && del} />`}>
    <form id="sheet-form" class="form" onSubmit=${save}>
      <${Field} label="Wofür?">
        <input class="input" required placeholder="z. B. Umzugskartons, Lampe, Farbe" value=${f.title} onInput=${val(setF, 'title')} />
      <//>
      <div class="row2">
        <${Field} label="Betrag">
          <input class="input" inputmode="decimal" placeholder="0 €" value=${f.amount} onInput=${val(setF, 'amount')} />
        <//>
        <${Field} label="Datum">
          <input class="input" type="date" value=${f.date} onInput=${val(setF, 'date')} />
        <//>
      </div>
      <${Field} label="Wer hat bezahlt?" as="div">
        <${PersonPicker} value=${f.paid_by} onChange=${val(setF, 'paid_by')} />
      <//>
      <${Field} label="Bereich">
        <${RoomSelect} value=${f.area} onChange=${val(setF, 'area')} categories noneLabel="Ohne Zuordnung" />
      <//>
      <${Field} label="Notiz">
        <input class="input" placeholder="optional" value=${f.notes} onInput=${val(setF, 'notes')} />
      <//>
      ${linked && html`<p class="meta-line">Gehört zur Sache „${linked.title}“.</p>`}
    </form>
  <//>`;
}

// ---------- Aufgabe ----------

export function openTaskSheet(task, defaults = {}) {
  openSheet(() => html`<${TaskSheet} key=${task?.id || 'neu'} task=${task} defaults=${defaults} />`);
}

function TaskSheet({ task, defaults }) {
  const isNew = !task;
  const isChecklist = !!(task?.phase || defaults.phase);
  const [f, setF] = useState(() => ({
    title: task?.title || '',
    assignee: task ? task.assignee : (defaults.assignee ?? null),
    due_date: task?.due_date || '',
    room: toSel(task?.room_id ?? defaults.room_id),
    phase: task?.phase || defaults.phase || '',
    notes: task?.notes || '',
  }));
  const auto = isChecklist && f.phase && state.settings.move_date
    ? taskDue({ phase: f.phase }, state.settings.move_date) : null;
  const save = async (e) => {
    e.preventDefault();
    if (!f.title.trim()) return toast('Was ist zu tun?');
    const row = {
      title: f.title.trim(), assignee: f.assignee || null, due_date: f.due_date || null,
      room_id: fromSel(f.room).room_id, notes: f.notes.trim() || null, phase: f.phase || null,
    };
    closeSheet();
    if (isNew) {
      const maxSort = state.tasks.reduce((m, t) => Math.max(m, t.sort || 0), 0);
      await add('tasks', { ...row, sort: maxSort + 1, done: false });
    } else await patch('tasks', task.id, row);
    return null;
  };
  const del = async () => {
    const ok = await confirmDialog({ title: 'Aufgabe löschen?', text: task.title, okLabel: 'Löschen', danger: true });
    if (ok) {
      closeSheet();
      remove('tasks', task.id);
    }
  };
  return html`<${Sheet} title=${isNew ? (isChecklist ? 'Neuer Punkt' : 'Neue Aufgabe') : 'Aufgabe bearbeiten'}
      footer=${html`<${Footer} onDelete=${!isNew && del} />`}>
    <form id="sheet-form" class="form" onSubmit=${save}>
      <${Field} label="Was ist zu tun?">
        <input class="input" required value=${f.title} onInput=${val(setF, 'title')} placeholder="z. B. Maße nehmen" />
      <//>
      <${Field} label="Wer?" as="div">
        <${PersonPicker} value=${f.assignee} onChange=${val(setF, 'assignee')} allowBoth />
      <//>
      <div class="row2">
        <${Field} label="Bis wann?" hint=${!f.due_date && auto ? `Automatisch: ${fmtDate(auto)}` : null}>
          <input class="input" type="date" value=${f.due_date} onInput=${val(setF, 'due_date')} />
        <//>
        <${Field} label="Raum">
          <${RoomSelect} value=${f.room} onChange=${val(setF, 'room')} noneLabel="—" />
        <//>
      </div>
      ${isChecklist && html`<${Field} label="Phase">
        <select class="input" value=${f.phase} onChange=${val(setF, 'phase')}>
          ${PHASES.map((p) => html`<option value=${p.key}>${p.title}</option>`)}
        </select>
      <//>`}
      <${Field} label="Notiz">
        <textarea class="input" rows="2" value=${f.notes} onInput=${val(setF, 'notes')} placeholder="optional"></textarea>
      <//>
    </form>
  <//>`;
}

// ---------- Raum ----------

const EMOJIS = ['🛋️', '🛏️', '🍳', '🛁', '🚪', '💻', '🌿', '🍽️', '🧺', '📚', '👶', '🪴', '🚲', '🎮', '🧳', '🏠'];

export function openRoomSheet(room) {
  openSheet(() => html`<${RoomSheet} key=${room?.id || 'neu'} room=${room} />`);
}

function RoomSheet({ room }) {
  const isNew = !room;
  const [name, setName] = useState(room?.name || '');
  const [emoji, setEmoji] = useState(room?.emoji || '🏠');
  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast('Wie heißt der Raum?');
    closeSheet();
    if (isNew) {
      const maxSort = state.rooms.reduce((m, r) => Math.max(m, r.sort || 0), 0);
      const created = await add('rooms', { name: name.trim(), emoji, sort: maxSort + 1 });
      if (created) location.hash = `#/raeume/${created.id}`;
    } else await patch('rooms', room.id, { name: name.trim(), emoji });
    return null;
  };
  const del = async () => {
    const n = state.items.filter((i) => i.room_id === room.id).length;
    const p = state.files.filter((x) => x.room_id === room.id).length;
    const ok = await confirmDialog({
      title: `${room.name} löschen?`,
      text: n || p ? `Dabei werden auch ${n} Sachen und ${p} Fotos gelöscht. Ausgaben bleiben erhalten.` : 'Der Raum ist leer.',
      okLabel: 'Löschen', danger: true,
    });
    if (ok) {
      closeSheet();
      location.hash = '#/raeume';
      deleteRoom(room);
    }
  };
  return html`<${Sheet} title=${isNew ? 'Neuer Raum' : 'Raum bearbeiten'} footer=${html`<${Footer} onDelete=${!isNew && del} />`}>
    <form id="sheet-form" class="form" onSubmit=${save}>
      <${Field} label="Name">
        <input class="input" required placeholder="z. B. Arbeitszimmer, Balkon" value=${name} onInput=${(e) => setName(e.currentTarget.value)} />
      <//>
      <${Field} label="Symbol" as="div">
        <div class="emoji-grid">
          ${EMOJIS.map((em) => html`<button type="button" class=${cx('emoji-opt', em === emoji && 'on')}
            onClick=${() => setEmoji(em)} aria-label=${em}>${em}</button>`)}
        </div>
      <//>
    </form>
  <//>`;
}

// ---------- Vertrag ----------

export const CONTRACT_STATUS = [
  { value: 'offen', label: 'Offen' },
  { value: 'laeuft', label: 'In Arbeit' },
  { value: 'erledigt', label: 'Erledigt' },
];

export function openContractSheet(contract) {
  openSheet(() => html`<${ContractSheet} key=${contract?.id || 'neu'} contract=${contract} />`);
}

function ContractSheet({ contract }) {
  const isNew = !contract;
  const [f, setF] = useState(() => ({
    name: contract?.name || '',
    provider: contract?.provider || '',
    status: contract?.status || 'offen',
    customer_no: contract?.customer_no || '',
    monthly_cost: moneyInput(contract?.monthly_cost),
    notes: contract?.notes || '',
  }));
  const save = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) return toast('Wofür ist der Vertrag?');
    const row = {
      name: f.name.trim(), provider: f.provider.trim() || null, status: f.status,
      customer_no: f.customer_no.trim() || null, monthly_cost: parseMoney(f.monthly_cost), notes: f.notes.trim() || null,
    };
    closeSheet();
    if (isNew) {
      const maxSort = state.contracts.reduce((m, c) => Math.max(m, c.sort || 0), 0);
      await add('contracts', { ...row, sort: maxSort + 1 });
    } else await patch('contracts', contract.id, row);
    return null;
  };
  const del = async () => {
    const ok = await confirmDialog({ title: `${contract.name} löschen?`, okLabel: 'Löschen', danger: true });
    if (ok) {
      closeSheet();
      remove('contracts', contract.id);
    }
  };
  return html`<${Sheet} title=${isNew ? 'Neuer Vertrag' : contract.name} footer=${html`<${Footer} onDelete=${!isNew && del} />`}>
    <form id="sheet-form" class="form" onSubmit=${save}>
      <div class="row2">
        <${Field} label="Wofür?">
          <input class="input" required placeholder="z. B. Strom" value=${f.name} onInput=${val(setF, 'name')} />
        <//>
        <${Field} label="Anbieter">
          <input class="input" placeholder="z. B. SWM" value=${f.provider} onInput=${val(setF, 'provider')} />
        <//>
      </div>
      <${Field} label="Status" as="div">
        <${Segmented} options=${CONTRACT_STATUS} value=${f.status} onChange=${val(setF, 'status')} />
      <//>
      <div class="row2">
        <${Field} label="Kunden-/Vertragsnr.">
          <input class="input" value=${f.customer_no} onInput=${val(setF, 'customer_no')} />
        <//>
        <${Field} label="Kosten pro Monat">
          <input class="input" inputmode="decimal" placeholder="0 €" value=${f.monthly_cost} onInput=${val(setF, 'monthly_cost')} />
        <//>
      </div>
      <${Field} label="Notiz">
        <textarea class="input" rows="2" placeholder="Kündigungsfrist, Zählernummer, Ansprechpartner …" value=${f.notes} onInput=${val(setF, 'notes')}></textarea>
      <//>
    </form>
  <//>`;
}

// ---------- Kiste ----------

export function openBoxSheet(box) {
  openSheet(() => html`<${BoxSheet} key=${box?.id || 'neu'} box=${box} />`);
}

function BoxSheet({ box }) {
  const isNew = !box;
  const nextNo = state.boxes.reduce((m, b) => Math.max(m, b.number || 0), 0) + 1;
  const [f, setF] = useState(() => ({
    number: String(box?.number ?? nextNo),
    room: toSel(box?.room_id),
    contents: box?.contents || '',
    fragile: !!box?.fragile,
  }));
  const save = async (e) => {
    e.preventDefault();
    const number = parseInt(f.number, 10);
    if (!Number.isFinite(number)) return toast('Bitte eine Kistennummer eingeben.');
    const row = { number, room_id: fromSel(f.room).room_id, contents: f.contents.trim() || null, fragile: f.fragile };
    closeSheet();
    if (isNew) await add('boxes', { ...row, unpacked: false });
    else await patch('boxes', box.id, row);
    return null;
  };
  const del = async () => {
    const ok = await confirmDialog({ title: `Kiste ${box.number} löschen?`, okLabel: 'Löschen', danger: true });
    if (ok) {
      closeSheet();
      remove('boxes', box.id);
    }
  };
  return html`<${Sheet} title=${isNew ? 'Neue Kiste' : `Kiste ${box.number}`} footer=${html`<${Footer} onDelete=${!isNew && del} />`}>
    <form id="sheet-form" class="form" onSubmit=${save}>
      <div class="row2">
        <${Field} label="Nummer">
          <input class="input" type="number" inputmode="numeric" min="1" value=${f.number} onInput=${val(setF, 'number')} />
        <//>
        <${Field} label="Kommt in">
          <${RoomSelect} value=${f.room} onChange=${val(setF, 'room')} noneLabel="—" />
        <//>
      </div>
      <${Field} label="Was ist drin?">
        <textarea class="input" rows="3" placeholder="z. B. Teller, Gläser, Ladekabel" value=${f.contents} onInput=${val(setF, 'contents')}></textarea>
      <//>
      <label class="toggle">
        <input type="checkbox" checked=${f.fragile} onChange=${(e) => setF((x) => ({ ...x, fragile: e.currentTarget.checked }))} />
        <span>Zerbrechlich</span>
      </label>
    </form>
  <//>`;
}

// ---------- Einstellungen ----------

export function openSettings() {
  openSheet(() => html`<${SettingsSheet} key="einstellungen" />`);
}

function SettingsSheet() {
  const s = state.settings;
  const [f, setF] = useState(() => ({
    name: me()?.name || '',
    move_date: s.move_date || '',
    budget: moneyInput(s.budget),
    address: s.address || '',
    password: '',
  }));
  const [copied, setCopied] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (f.password && f.password.length < 6) return toast('Das Passwort braucht mindestens 6 Zeichen.');
    closeSheet();
    if (f.password) await changePassword(f.password);
    if (f.name.trim() && f.name.trim() !== me()?.name) await saveMyName(f.name);
    const changes = { move_date: f.move_date || null, budget: parseMoney(f.budget), address: f.address.trim() || null };
    if (changes.move_date !== (s.move_date || null) || changes.budget !== (s.budget ?? null) || changes.address !== (s.address || null)) {
      await saveSettings(changes);
    }
  };
  const copy = async () => {
    const link = connectLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      window.prompt('Link kopieren:', link);
    }
  };
  return html`<${Sheet} title="Einstellungen" footer=${html`<${Footer} />`}>
    <form id="sheet-form" class="form" onSubmit=${save}>
      ${state.mode === 'supabase' && html`<${Field} label="Dein Name" hint=${state.email ? `Angemeldet als ${state.email}` : null}>
        <input class="input" value=${f.name} onInput=${val(setF, 'name')} />
      <//>`}
      <div class="row2">
        <${Field} label="Einzugsdatum">
          <input class="input" type="date" value=${f.move_date} onInput=${val(setF, 'move_date')} />
        <//>
        <${Field} label="Gesamtbudget">
          <input class="input" inputmode="decimal" placeholder="z. B. 8000" value=${f.budget} onInput=${val(setF, 'budget')} />
        <//>
      </div>
      <${Field} label="Adresse der neuen Wohnung">
        <input class="input" placeholder="Straße, München" value=${f.address} onInput=${val(setF, 'address')} />
      <//>
      ${state.mode === 'supabase' && html`<${Field} label="Neues Passwort" hint="Nur ausfüllen, wenn du dein Passwort ändern willst.">
        <input class="input" type="password" autocomplete="new-password" minlength="6" value=${f.password} onInput=${val(setF, 'password')} />
      <//>`}
    </form>
    <div class="settings-extra">
      ${state.mode === 'supabase' && state.configSource === 'browser' && html`
        <div class="settings-block">
          <div class="settings-title">Weiteres Gerät verbinden</div>
          <p>Öffne diesen Link auf dem anderen Handy oder Laptop. Danach nur noch mit dem eigenen Konto anmelden.</p>
          <button type="button" class="btn" onClick=${copy}><${Icon} name=${copied ? 'check' : 'copy'} size=${18} />${copied ? 'Kopiert' : 'Link kopieren'}</button>
        </div>`}
      ${state.mode === 'supabase' && html`<div class="settings-row">
        <button type="button" class="btn ghost" onClick=${() => { closeSheet(); signOut(); }}><${Icon} name="logout" size=${18} />Abmelden</button>
        ${state.configSource === 'browser' && html`<button type="button" class="btn ghost muted-text" onClick=${async () => {
          const ok = await confirmDialog({ title: 'Verbindung trennen?', text: 'Dieses Gerät vergisst die Supabase-Verbindung. Eure Daten bleiben erhalten.', okLabel: 'Trennen', danger: true });
          if (ok) forgetConnection();
        }}>Verbindung trennen</button>`}
      </div>`}
      ${state.mode === 'demo' && html`<div class="settings-block">
        <div class="settings-title">Demo-Modus</div>
        <p>Alles wird nur in diesem Browser gespeichert. Zum Verbinden mit eurer Supabase-Datenbank die Demo beenden.</p>
        <button type="button" class="btn" onClick=${async () => {
          const ok = await confirmDialog({ title: 'Demo beenden?', text: 'Die Beispieldaten werden gelöscht.', okLabel: 'Beenden', danger: true });
          if (ok) leaveDemo();
        }}>Demo beenden</button>
      </div>`}
    </div>
  <//>`;
}
