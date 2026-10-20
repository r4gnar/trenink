// Záloha a obnova dat do souboru JSON. Soubor zůstává u uživatele — nic se neodesílá na server.
import { SCHEMA, getState, replaceAll, update } from './store.js';
import { daysSince } from './util.js';

const REMIND_DAYS = 30;
const SNOOZE_DAYS = 7;

function fileName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `trenink-zaloha-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

export function backupJSON() {
  const { inProgress, ...data } = getState(); // rozpracovaný trénink do zálohy nepatří
  return JSON.stringify({ app: 'trenink', exportedAt: new Date().toISOString(), ...data, inProgress: null }, null, 1);
}

function backupBlob() {
  return new Blob([backupJSON()], { type: 'application/json' });
}

function markBackedUp() {
  update((s) => {
    s.lastBackup = new Date().toISOString();
    s.backupSnoozeUntil = null;
  });
}

export function canShareFile() {
  try {
    return !!navigator.canShare?.({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] });
  } catch {
    return false;
  }
}

// Uloží soubor do Stažených souborů.
export function downloadBackup() {
  const url = URL.createObjectURL(backupBlob());
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName();
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  markBackedUp();
}

// Otevře sdílení Androidu (mail, Disk, WhatsApp…). Vrací false, když uživatel sdílení zavřel.
export async function shareBackup() {
  const file = new File([backupBlob()], fileName(), { type: 'application/json' });
  try {
    await navigator.share({ files: [file], title: 'Záloha tréninků' });
    markBackedUp();
    return true;
  } catch (err) {
    if (err.name === 'AbortError') return false;
    throw err;
  }
}

// ---------- obnova ----------

// Zkontroluje soubor a vrátí { data, summary } nebo vyhodí chybu s českou zprávou.
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Soubor není platná záloha (nejde přečíst jako JSON).');
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.sessions) || !data.level) {
    throw new Error('Tohle nevypadá jako záloha z této appky.');
  }
  if (!Number.isInteger(data.schema) || data.schema > SCHEMA) {
    throw new Error('Záloha je z novější verze appky. Nejdřív appku aktualizuj (zelený pruh „Obnovit“).');
  }
  if (!['ramp', 'progression'].includes(data.level.phase)) throw new Error('Záloha má neplatnou úroveň.');
  const bad = data.sessions.find((s) => !s?.id || !s.start || !Array.isArray(s.circuit) || !Array.isArray(s.results));
  if (bad) throw new Error('Některý trénink v záloze je poškozený.');

  const last = data.sessions.at(-1);
  return {
    data,
    summary: {
      sessions: data.sessions.length,
      last: last?.start ?? null,
      exportedAt: data.exportedAt ?? null,
      level: data.level.phase === 'progression' ? 'fáze progrese' : `týden ${data.level.week}`,
    },
  };
}

export function restoreBackup(data) {
  const { app, exportedAt, ...rest } = data;
  replaceAll({ ...rest, inProgress: null, pendingSuggestion: null, lastBackup: exportedAt ?? new Date().toISOString() });
}

// ---------- připomínka ----------

// Připomenout, když od poslední zálohy (nebo od prvního tréninku) uběhlo 30+ dní a přibyly tréninky.
export function backupReminder(state) {
  if (!state.sessions.length) return null;
  if (state.backupSnoozeUntil && new Date(state.backupSnoozeUntil) > new Date()) return null;
  const since = state.lastBackup ?? state.sessions[0].start;
  const fresh = state.sessions.filter((s) => s.start > (state.lastBackup ?? '')).length;
  const days = daysSince(since);
  if (days < REMIND_DAYS || !fresh) return null;
  return { never: !state.lastBackup, days, fresh };
}

export function snoozeReminder() {
  update((s) => {
    s.backupSnoozeUntil = new Date(Date.now() + SNOOZE_DAYS * 86400000).toISOString();
  });
}
