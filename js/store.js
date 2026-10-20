// Veškerá data appky žijí v localStorage tohoto telefonu. Nic se neodesílá.
import { PROGRESSION } from './plan.js';

const KEY = 'trenink.v1';
export const SCHEMA = 1;

function defaults() {
  return {
    schema: SCHEMA,
    settings: {
      superman: 'auto', // auto | always | never
      rowVariant: 'band', // band | table | towel
      threeRounds: false,
      transitionSec: 15,
      restSec: null, // null = podle týdne
      sound: true,
      vibration: true,
    },
    level: { phase: 'ramp', week: 1, progression: Object.fromEntries(Object.keys(PROGRESSION).map((id) => [id, 0])) },
    sessions: [],
    levelHistory: [],
    pendingSuggestion: null, // návrh po posledním tréninku
    dismissed: [], // odmítnuté návrhy po pauze
    inProgress: null,
    lastBackup: null,
    backupSnoozeUntil: null,
  };
}

let state = load();

// Doplní chybějící položky z výchozího stavu (starší data, záloha ze starší verze).
function withDefaults(saved) {
  const base = defaults();
  if (!saved) return base;
  return {
    ...base,
    ...saved,
    schema: SCHEMA,
    settings: { ...base.settings, ...saved.settings },
    level: { ...base.level, ...saved.level, progression: { ...base.level.progression, ...saved.level?.progression } },
  };
}

function load() {
  try {
    return withDefaults(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return defaults();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('Uložení selhalo', err);
    return false;
  }
}

// Obnova ze zálohy: nahradí všechna data.
export function replaceAll(data) {
  state = withDefaults(data);
  return persist();
}

export function resetAll() {
  state = defaults();
  return persist();
}

export function getState() {
  return state;
}

export function update(mutator) {
  mutator(state);
  return persist();
}

// Požádá Android, aby data appky nemazal při nedostatku místa.
export async function requestPersistence() {
  if (!navigator.storage?.persist) return 'unsupported';
  if (await navigator.storage.persisted()) return 'granted';
  return (await navigator.storage.persist()) ? 'granted' : 'denied';
}
