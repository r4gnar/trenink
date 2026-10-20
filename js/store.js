// Veškerá data appky žijí v localStorage tohoto telefonu. Nic se neodesílá.

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
    level: { phase: 'ramp', week: 1 },
    sessions: [],
    levelHistory: [],
    pendingSuggestion: null,
    inProgress: null,
    lastBackup: null,
  };
}

let state = load();

function load() {
  const base = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (!saved) return base;
    return { ...base, ...saved, settings: { ...base.settings, ...saved.settings } };
  } catch {
    return base;
  }
}

export function getState() {
  return state;
}

export function update(mutator) {
  mutator(state);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Uložení selhalo', err);
    return false;
  }
  return true;
}

// Požádá Android, aby data appky nemazal při nedostatku místa.
export async function requestPersistence() {
  if (!navigator.storage?.persist) return 'unsupported';
  if (await navigator.storage.persisted()) return 'granted';
  return (await navigator.storage.persist()) ? 'granted' : 'denied';
}
