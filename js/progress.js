// Pravidla posunu v plánu (spec.md, kap. 5). Appka jen navrhuje, potvrzuje uživatel.
import { EXERCISES, PROGRESSION, PROGRESSION_WEEK, stageLabel } from './plan.js';
import { daysSince } from './util.js';

const GAP_BACK_DAYS = 10; // vynechaný celý týden → o stupeň zpět
const GAP_RESTART_DAYS = 21; // pauza delší než 3 týdny → od 1. týdne
const STREAK = 2; // posun až po dvou čistých trénincích

function lastLevelChange(state) {
  return state.levelHistory.at(-1)?.date ?? '';
}

// Trénink se počítá do posunu: dokončený, čistá technika, bez svalovky.
function isClean(s) {
  return s.completed && s.cleanTechnique === true && s.soreness === false;
}

function fullVolume(s, id) {
  const c = s.circuit.find((x) => x.id === id);
  if (!c) return false;
  return s.results.length >= s.rounds && s.results.every((round) => {
    const v = round?.[id];
    return c.sided ? v?.L >= c.reps && v?.R >= c.reps : v >= c.reps;
  });
}

// ---------- po uložení tréninku ----------

export function suggestAfterSession(state) {
  const last = state.sessions.at(-1);
  if (!last) return null;
  const sessionId = last.id;

  if (last.soreness) {
    return {
      kind: 'repeat',
      sessionId,
      title: 'Zopakuj tenhle týden',
      text: 'Svalovka vydržela až do tohoto tréninku. Podle plánu dej stejnou úroveň ještě jednou — posun se počítá znovu od dalšího čistého tréninku.',
    };
  }

  const since = lastLevelChange(state);
  const atLevel = state.sessions.filter((s) => s.start > since && s.phase === state.level.phase);
  const recent = atLevel.slice(-STREAK);

  if (state.level.phase === 'ramp') {
    const week = state.level.week;
    const ok = recent.length === STREAK && recent.every((s) => s.week === week && isClean(s));
    if (!ok) return null;
    if (week < PROGRESSION_WEEK) {
      return {
        kind: 'advance',
        sessionId,
        to: week + 1,
        title: `Přejít na týden ${week + 1}?`,
        text: `Dva tréninky po sobě na týdnu ${week} s čistou technikou a bez svalovky.`,
      };
    }
    return {
      kind: 'progression',
      sessionId,
      title: 'Přejít do fáze progrese?',
      text: 'Pět týdnů náběhu je za tebou. Dál se zůstává na objemu 5. týdne a každý cvik se posouvá zvlášť — přes pomalejší tempo, těžší variantu a nakonec zátěž.',
    };
  }

  // progrese: každý cvik zvlášť, oba poslední tréninky na stejném stupni, plný objem a rezerva 2+
  if (recent.length < STREAK || !recent.every(isClean)) return null;
  const level = state.level.progression;
  const ups = Object.keys(PROGRESSION).flatMap((id) => {
    const stage = level[id] ?? 0;
    if (stage >= PROGRESSION[id].length - 1) return [];
    const ready = recent.every(
      (s) => s.circuit.find((c) => c.id === id)?.stage === stage && fullVolume(s, id) && s.reserve?.[id] === true,
    );
    return ready ? [{ id, from: stage, to: stage + 1 }] : [];
  });
  if (!ups.length) return null;
  return {
    kind: 'stage',
    sessionId,
    ups,
    title: ups.length === 1 ? `Posunout ${EXERCISES[ups[0].id].short.toLowerCase()}?` : 'Posunout cviky?',
    text: 'Dvakrát po sobě plný objem s čistou technikou a rezervou 2+ opakování.',
  };
}

// Kolik posledních tréninků na aktuální úrovni se počítá do posunu (0 až STREAK).
export function cleanStreak(state) {
  const since = lastLevelChange(state);
  const atLevel = state.sessions.filter((s) => s.start > since && s.phase === state.level.phase);
  let n = 0;
  for (let i = atLevel.length - 1; i >= 0 && n < STREAK && isClean(atLevel[i]); i--) n++;
  return { done: n, needed: STREAK };
}

// ---------- před tréninkem: pauza ----------

export function suggestAfterGap(state) {
  const last = state.sessions.at(-1);
  if (!last || state.inProgress) return null;
  const key = `gap:${last.id}`;
  if (state.dismissed?.includes(key)) return null;
  const days = daysSince(last.start);
  const { phase, week, progression } = state.level;

  if (days > GAP_RESTART_DAYS && (phase === 'progression' || week > 1)) {
    return {
      kind: 'restart',
      key,
      title: 'Začít znovu od 1. týdne?',
      text: `Od posledního tréninku uběhlo ${days} dní. Po pauze delší než tři týdny plán doporučuje začít znovu od 1. týdne — šlachy a úpony se adaptují pomaleji než svaly.`,
    };
  }
  if (days > GAP_BACK_DAYS) {
    if (phase === 'ramp' && week > 1) {
      return {
        kind: 'back',
        key,
        to: week - 1,
        title: `Vrátit se na týden ${week - 1}?`,
        text: `Od posledního tréninku uběhlo ${days} dní. Po vynechaném týdnu plán doporučuje o stupeň zpět.`,
      };
    }
    if (phase === 'progression' && Object.values(progression).some((v) => v > 0)) {
      return {
        kind: 'stagesDown',
        key,
        title: 'Snížit stupně o jeden?',
        text: `Od posledního tréninku uběhlo ${days} dní. Po vynechaném týdnu plán doporučuje o stupeň zpět — u každého cviku, který už je výš než na základu.`,
      };
    }
  }
  return null;
}

// Co se změní po potvrzení — pro text na kartě.
export function describeChange(sug, state) {
  if (sug.kind === 'stage') {
    return sug.ups.map((u) => `${EXERCISES[u.id].short}: ${stageLabel(u.id, u.to)}`);
  }
  if (sug.kind === 'stagesDown') {
    return Object.entries(state.level.progression)
      .filter(([, v]) => v > 0)
      .map(([id, v]) => `${EXERCISES[id].short}: ${stageLabel(id, v - 1)}`);
  }
  return [];
}

// ---------- potvrzení ----------

export function applySuggestion(state, sug) {
  const from = { phase: state.level.phase, week: state.level.week, progression: { ...state.level.progression } };
  const log = (reason) =>
    state.levelHistory.push({ date: new Date().toISOString(), from, to: structuredClone(state.level), reason });

  if (sug.kind === 'advance' || sug.kind === 'back') {
    state.level = { ...state.level, phase: 'ramp', week: sug.to };
    log(sug.kind);
  } else if (sug.kind === 'restart') {
    state.level = { ...state.level, phase: 'ramp', week: 1 };
    log('restart');
  } else if (sug.kind === 'progression') {
    state.level = { phase: 'progression', week: PROGRESSION_WEEK, progression: zeroStages() };
    log('progression');
  } else if (sug.kind === 'stage') {
    for (const u of sug.ups) state.level.progression[u.id] = u.to;
    log('stage');
  } else if (sug.kind === 'stagesDown') {
    for (const id of Object.keys(state.level.progression)) {
      state.level.progression[id] = Math.max(0, state.level.progression[id] - 1);
    }
    log('stagesDown');
  }
  // 'repeat' je jen upozornění, úroveň se nemění
}

export function zeroStages() {
  return Object.fromEntries(Object.keys(PROGRESSION).map((id) => [id, 0]));
}
