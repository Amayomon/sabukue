// Datová vrstva: ukládání, levely, výchozí questy

export const STORAGE_KEY = 'sidequesty-v1';

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const todayISO = (d = new Date()) => {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};

export const daysBetween = (a, b) =>
  Math.round((new Date(b) - new Date(a)) / 86400000);

// Level: na další level je potřeba 100 × aktuální level XP
// L1→2: 100 XP, L2→3: 200 XP, … (kumulativně 100, 300, 600, 1000, …)
export function levelInfo(xp) {
  let level = 1;
  let floor = 0;
  while (xp >= floor + level * 100) {
    floor += level * 100;
    level++;
  }
  const need = level * 100;
  return { level, into: xp - floor, need, pct: Math.min(100, ((xp - floor) / need) * 100) };
}

const TITLES = [
  [1, 'Nováček'],
  [3, 'Učeň'],
  [5, 'Tovaryš'],
  [8, 'Zkušený'],
  [11, 'Mistr'],
  [15, 'Velmistr'],
  [20, 'Legenda'],
];
export const titleFor = (level) =>
  TITLES.filter(([min]) => level >= min).pop()[1];

export const GOAL_XP = 50;

export const questXP = (q) =>
  q.entries.reduce((s, e) => s + e.xp, 0) +
  q.goals.filter((g) => g.done).length * GOAL_XP;

export const lastActivity = (q) => {
  const dates = [
    ...q.entries.map((e) => e.date),
    ...q.goals.filter((g) => g.doneAt).map((g) => g.doneAt),
  ].sort();
  return dates.length ? dates[dates.length - 1] : null;
};

export const CATEGORIES = ['Tělo', 'Mysl', 'Umění', 'Řemesla', 'Hlas', 'Jazyky', 'Ostatní'];

const mkGoals = (...texts) => texts.map((text) => ({ id: uid(), text, done: false, doneAt: null }));

export function seedQuests() {
  const created = todayISO();
  const q = (name, icon, category, desc, goals) => ({
    id: uid(), name, icon, category, desc, created, archived: false,
    goals: mkGoals(...goals), entries: [],
  });
  return [
    q('Lucidní snění', '🌙', 'Mysl',
      'Uvědomit si, že sním, a vědomě sen řídit. Základ je deník snů a reality checky.',
      ['Vést deník snů 14 dní v řadě', 'Pamatovat si 3 sny za týden', 'Dělat reality checky 10× denně po týden', 'První lucidní sen']),
    q('Stojka', '🤸', 'Tělo',
      'Od stojky u zdi k volné stojce.',
      ['Stojka u zdi 30 s', 'Stojka u zdi 60 s', 'Volná stojka 5 s', 'Volná stojka 30 s']),
    q('Kargyraa', '🎶', 'Hlas',
      'Tuvanský hrdelní zpěv: hluboký, vrčivý podtón z nepravých hlasivek.',
      ['Najít stabilní nízký podtón', 'Udržet tón 10 s bez bolesti', 'Měnit vokály a slyšet podtóny', 'Zazpívat celou frázi']),
    q('Modelaření', '🛠️', 'Řemesla',
      'Stavba a malování modelů a figurek.',
      ['Dokončit první model', 'Naučit se drybrush', 'Zkusit washe a stínování', 'Postavit malou scénku (diorama)']),
    q('Malování', '🎨', 'Umění',
      'Pravidelné malování a skicování.',
      ['Malovat 3× týdně celý měsíc', 'Dokončit první hotový obraz', 'Namalovat studii podle reálu']),
    q('Kaligrafie', '✒️', 'Umění',
      'Ruční písmo a lettering, pro abecedu Degannonu i titulky v motion designu.',
      ['Denní drill 2 týdny', 'Napsat jednu frázi v degannonštině', 'Navrhnout pečeť / monogram']),
    q('Kreslení map', '🗺️', 'Řemesla',
      'Fantasy kartografie pro svět Degannonu.',
      ['Nakreslit jednu malou lokaci', 'Naučit se kreslit hory a lesy', 'Mapa s ručně psanými názvy']),
  ];
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { quests: seedQuests() };
}

export function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}
