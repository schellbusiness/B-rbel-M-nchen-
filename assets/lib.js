// Kleine Helfer: Rendering, Geld, Datum, Bilder.
export {
  html, render, useState, useEffect, useMemo, useRef, useCallback,
} from '../vendor/preact-htm.module.js';

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // Fallback (unsicherer Kontext)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------- Geld ----------

const eur0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function money(n) {
  const v = Number(n) || 0;
  return (Math.round(v * 100) % 100 !== 0 ? eur2 : eur0).format(v);
}

export function parseMoney(input) {
  if (input == null) return null;
  let s = String(input).trim().replace(/[€\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function moneyInput(n) {
  if (n == null || n === '') return '';
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',');
}

export const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);

// ---------- Datum (immer lokale Kalendertage, Format YYYY-MM-DD) ----------

export function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const todayISO = () => iso(new Date());

export function parseDate(s) {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function daysUntil(s) {
  return Math.round((parseDate(s) - parseDate(todayISO())) / 86400000);
}

const fmtShort = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });
const fmtLong = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'long' });
const fmtWeekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long' });
const fmtYear = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });

export function fmtDate(s, style = 'short') {
  const d = parseDate(s);
  if (!d) return '';
  if (style === 'long') return fmtLong.format(d);
  if (d.getFullYear() !== new Date().getFullYear()) return fmtYear.format(d);
  return fmtShort.format(d);
}

export function relDay(s) {
  const n = daysUntil(s);
  if (n === 0) return 'Heute';
  if (n === 1) return 'Morgen';
  if (n === -1) return 'Gestern';
  if (n < 0) return `vor ${-n} Tagen`;
  if (n < 7) return fmtWeekday.format(parseDate(s));
  return fmtDate(s);
}

// ---------- Umzugsphasen ----------

// from/to: Tage relativ zum Einzug. "to" ist das automatische Fälligkeitsdatum.
export const PHASES = [
  { key: 'p1', title: '6–8 Wochen vorher', from: -56, to: -42 },
  { key: 'p2', title: '2–4 Wochen vorher', from: -28, to: -14 },
  { key: 'p3', title: 'In der letzten Woche', from: -7, to: -1 },
  { key: 'p4', title: 'Am Umzugstag', from: 0, to: 0 },
  { key: 'p5', title: 'Nach dem Umzug', from: 1, to: 14 },
];

export function taskDue(task, moveDate) {
  if (task.due_date) return task.due_date;
  if (task.phase && moveDate) {
    const p = PHASES.find((x) => x.key === task.phase);
    if (p) return addDays(moveDate, p.to);
  }
  return null;
}

export function phaseRange(p, moveDate) {
  if (!moveDate) return null;
  if (p.from === p.to) return fmtDate(addDays(moveDate, p.from), 'long');
  return `${fmtDate(addDays(moveDate, p.from))} – ${fmtDate(addDays(moveDate, p.to))}`;
}

// Welche Phase ist gerade dran? (die erste, deren Ende noch nicht vorbei ist)
export function currentPhase(moveDate) {
  if (!moveDate) return null;
  const n = -daysUntil(moveDate); // Tage seit Einzug (negativ = davor)
  return PHASES.find((p) => n <= p.to)?.key || null;
}

// ---------- Bilder vor dem Hochladen verkleinern ----------

async function decode(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* weiter */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export async function prepareUpload(file, maxDim = 2000) {
  const type = file.type || '';
  if (type.startsWith('image/') && !/svg|gif/.test(type)) {
    try {
      const img = await decode(file);
      const w = img.width, h = img.height;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
      if (blob) return { blob, ext: 'jpg', type: 'image/jpeg', name: file.name };
    } catch (e) {
      console.warn('Bild konnte nicht verkleinert werden', e);
    }
  }
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
  return { blob: file, ext, type: type || 'application/octet-stream', name: file.name };
}

export const isImagePath = (p) => /\.(jpe?g|png|webp|gif|heic|avif)$/i.test(p || '') || /^data:image\//.test(p || '');
export const isExternal = (p) => /^https?:\/\//i.test(p || '');

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}
