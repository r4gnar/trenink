// Tréninkový plán — přepis exer.md do dat. Při změně plánu upravit tady.

// sided: null = oboustranný cvik, 'leg' = zvlášť každá noha, 'side' = zvlášť každá strana
export const EXERCISES = {
  squat: {
    name: 'Bulharské dřepy',
    short: 'Dřep',
    target: 'Nohy · hýždě · rovnováha na jedné noze',
    sided: 'leg',
    tempo: '2 s dolů · 1 s nahoru',
    why: 'Nejtěžší a nejvíc koordinace — dokud jsi čerstvý.',
    cue: 'Koleno tlač ven, nad malíček. Nahoru přes patu.',
  },
  pushup: {
    name: 'Kliky s nohama nahoře',
    short: 'Kliky',
    target: 'Ramena · vrchní část hrudníku',
    sided: null,
    tempo: '2 s dolů · 1 s nahoru',
    why: 'Tlak.',
    cue: 'Tělo jedno prkno, lokty ve 45°. Hrudník jde dolů dřív než brada.',
  },
  row: {
    name: 'Veslování s gumou',
    short: 'Veslování',
    target: 'Široký zádový · mezilopatkové · dolní trapéz',
    sided: null,
    tempo: '1 s tah · 1 s pauza · 3 s návrat',
    why: 'Tah hned po tlaku — záda pracují, zatímco hrudník odpočívá.',
    cue: 'Začni lopatkami („do zadních kapes“), lokty těsně podél žeber.',
    variants: {
      band: { name: 'S gumou vsedě', text: 'Sed na zemi, nohy natažené, guma kolem chodidel, dlaně proti sobě.' },
      table: {
        name: 'Pod stolem',
        text: 'Lehneš si pod pevný stůl, chytneš desku a přitahuješ hrudník k ní. Obtížnost řídíš pokrčením nohou.',
      },
      towel: { name: 'Ručník kolem futra', text: 'Veslování v záklonu, obtížnost řídíš úhlem těla.' },
    },
  },
  bridge: {
    name: 'Pánevní most na jedné noze',
    short: 'Most',
    target: 'Aktivace hýždí · uvolnění beder',
    sided: 'leg',
    tempo: '1 s nahoru · 2 s výdrž · 1 s dolů',
    why: 'Hýždě; po dřepu už jsou rozehřáté.',
    cue: 'Před zvednutím podsaď pánev. Nahoře stisk hýždě, výš už nejdi.',
  },
  deadbug: {
    name: 'Pomalý mrtvý brouk',
    short: 'Mrtvý brouk',
    target: 'Stabilizace core s bedry na zemi',
    sided: 'side',
    tempo: '3 s natažení · 2 s zpět',
    why: 'Core až nakonec — unavený střed těla zhorší techniku všeho ostatního.',
    cue: 'Bedra přitisknutá k podložce. Když se odlepí, zkrať rozsah.',
  },
  superman: {
    name: 'Superman s výdrží 3 s',
    short: 'Superman',
    target: 'Vzpřimovače páteře',
    sided: null,
    tempo: 'zvednout · 3 s výdrž · plynule dolů',
    why: 'Volitelný, vždy úplně na konci. Nedělej ho spolu s veslováním.',
    cue: 'Nízko a dlouze — protáhni se do dálky, ne co nejvýš.',
  },
  pullapart: {
    name: 'Rozpažování s gumou',
    short: 'Rozpažování',
    target: 'Mezilopatkové svaly · zadní rameno',
    sided: null,
    tempo: 'plynule, krátká pauza u hrudníku',
    why: 'Probuzení mezilopatkových svalů před okruhem — patří do rozehřátí, ne do okruhu.',
    cue: 'Paže natažené, pohyb z lopatek. Lehká guma.',
  },
};

// Pevné pořadí okruhu. Superman je volitelný a vždy poslední.
export const CIRCUIT_ORDER = ['squat', 'pushup', 'row', 'bridge', 'deadbug', 'superman'];

export const WARMUP = [
  { text: '20× kroužky pažemi', detail: '10 vpřed, 10 vzad' },
  { text: '10× dřep s vlastní vahou', detail: 'mělký, bez zátěže' },
  { text: '10× pánevní most obounož' },
  { text: '5× pomalý výpad do strany', detail: 'na každou stranu' },
  { text: '15× rozpažování s gumou', detail: 'lehká guma', exercise: 'pullapart', fromWeek: 2 },
];

export const RULES = [
  { title: 'Tempo', text: '2 s dolů, 1 s pauza, bez švihu. Zpomalená spouštěcí fáze je místo, kde se buduje síla.' },
  { title: 'Dech', text: 'Výdech do fáze, která tě stojí sílu. Nikdy nezadržuj dech přes celé opakování.' },
  {
    title: 'Set končí, když se láme technika',
    text: 'Ne když to nejde. Poslední čisté opakování je poslední opakování.',
  },
  { title: 'Žebra dolů, bedra neutrální', text: 'Nevystrkuj hrudník přes záklon v bedrech.' },
];

// Opakování jsou v každém okruhu. null = cvik se ten týden nedělá.
// bridge.sided = false: v 1. týdnu obounož.
export const WEEKS = [
  {
    week: 1,
    rounds: 2,
    restSec: 120,
    minutes: 12,
    items: {
      squat: { reps: 6, variant: 'výpad vzad' },
      pushup: { reps: 6, variant: 'na zemi' },
      row: null,
      bridge: { reps: 8, variant: 'obounož', sided: false },
      deadbug: { reps: 5 },
      superman: { reps: 6 },
    },
  },
  {
    week: 2,
    rounds: 3,
    restSec: 120,
    minutes: 19,
    items: {
      squat: { reps: 8, variant: 'podložka ~20 cm' },
      pushup: { reps: 8, variant: 'na zemi' },
      row: { reps: 8 },
      bridge: { reps: 8 },
      deadbug: { reps: 6 },
      superman: null,
    },
  },
  {
    week: 3,
    rounds: 4,
    restSec: 90,
    minutes: 25,
    items: {
      squat: { reps: 8, variant: 'plná výška' },
      pushup: { reps: 8, variant: 'nohy ~20 cm' },
      row: { reps: 8 },
      bridge: { reps: 8 },
      deadbug: { reps: 8 },
      superman: null,
    },
  },
  {
    week: 4,
    rounds: 4,
    restSec: 90,
    minutes: 28,
    items: {
      squat: { reps: 10 },
      pushup: { reps: 10, variant: 'nohy nahoře' },
      row: { reps: 10 },
      bridge: { reps: 10 },
      deadbug: { reps: 8 },
      superman: null,
    },
  },
  {
    week: 5,
    rounds: 4,
    restSec: 90,
    minutes: 30,
    items: {
      squat: { reps: 10, variant: '+ pauza 2 s dole' },
      pushup: { reps: 10, variant: 'vyšší podložka' },
      row: { reps: 10, variant: 'návrat 3 s' },
      bridge: { reps: 10 },
      deadbug: { reps: 8 },
      superman: null,
    },
  },
];

// Když je Superman v nastavení „vždy“ a týden ho nemá.
export const SUPERMAN_DEFAULT = { reps: 10 };

export const TRANSITION_SEC = 15;

const SIDE_LABEL = { leg: '/ noha', side: '/ strana' };

export function weekPlan(weekNo) {
  return WEEKS.find((w) => w.week === weekNo) ?? WEEKS[0];
}

// Seznam cviků okruhu pro daný týden a nastavení, v pevném pořadí.
export function circuitFor(weekNo, settings) {
  const week = weekPlan(weekNo);
  return CIRCUIT_ORDER.flatMap((id) => {
    let item = week.items[id];
    if (id === 'superman') {
      if (settings.superman === 'never') item = null;
      else if (settings.superman === 'always') item = item ?? SUPERMAN_DEFAULT;
      else item = week.items.row ? null : item; // auto: jen v týdnu bez veslování
    }
    if (!item) return [];
    const ex = EXERCISES[id];
    const sided = item.sided === false ? null : ex.sided;
    return [{ id, ...item, sided, volume: `${item.reps}${sided ? ' ' + SIDE_LABEL[sided] : ''}` }];
  });
}

export function roundsFor(weekNo, settings) {
  const rounds = weekPlan(weekNo).rounds;
  return settings.threeRounds ? Math.min(rounds, 3) : rounds;
}

// Plán: „Když ti 28 minut nesedí do života, jeď natrvalo 3 okruhy. Vejdeš se do 21 minut.“
export function minutesFor(weekNo, settings) {
  const week = weekPlan(weekNo);
  return settings.threeRounds && week.rounds > 3 ? 21 : week.minutes;
}

export function warmupFor(weekNo) {
  return WARMUP.filter((w) => !w.fromWeek || weekNo >= w.fromWeek);
}
