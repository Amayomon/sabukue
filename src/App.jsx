import { useEffect, useMemo, useRef, useState } from 'react';
import {
  load, save, uid, todayISO, daysBetween, levelInfo, titleFor,
  questXP, lastActivity, CATEGORIES, GOAL_XP,
} from './data';
import './App.css';

const XP_PRESETS = [
  { xp: 10, label: 'Krátce' },
  { xp: 25, label: 'Pořádná session' },
  { xp: 50, label: 'Průlom' },
];

export default function App() {
  const [state, setState] = useState(load);
  const [filter, setFilter] = useState('Vše');
  const [openId, setOpenId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => save(state), [state]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const quests = state.quests;
  const update = (id, fn) =>
    setState((s) => ({ ...s, quests: s.quests.map((q) => (q.id === id ? fn(q) : q)) }));

  // Level-up hláška
  const withLevelCheck = (id, fn) => {
    const q = quests.find((x) => x.id === id);
    const before = levelInfo(questXP(q)).level;
    const after = levelInfo(questXP(fn(q))).level;
    update(id, fn);
    if (after > before) setToast(`⬆ ${q.name}: level ${after} — ${titleFor(after)}`);
  };

  const active = quests.filter((q) => !q.archived);
  const archived = quests.filter((q) => q.archived);
  const cats = ['Vše', ...new Set(active.map((q) => q.category))];
  const visible = (showArchived ? archived : active)
    .filter((q) => filter === 'Vše' || q.category === filter)
    .sort((a, b) => (lastActivity(b) || b.created).localeCompare(lastActivity(a) || a.created));

  const open = quests.find((q) => q.id === openId);

  return (
    <div className="app">
      <Hero quests={active} />
      <Heatmap quests={active} />

      <div className="toolbar">
        <div className="chips">
          {cats.map((c) => (
            <button key={c} className={`chip ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>
              {c}
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={() => setShowNew(true)}>+ Nový quest</button>
      </div>

      <div className="grid">
        {visible.map((q) => (
          <QuestCard key={q.id} q={q} onOpen={() => setOpenId(q.id)} />
        ))}
        {visible.length === 0 && (
          <p className="empty">{showArchived ? 'Žádné archivované questy.' : 'Tady zatím nic není. Založ první quest.'}</p>
        )}
      </div>

      <footer className="foot">
        <button className="link" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? '← Zpět na aktivní' : `Archiv (${archived.length})`}
        </button>
        <DataTools state={state} setState={setState} setToast={setToast} />
      </footer>

      {open && (
        <QuestDetail
          q={open}
          onClose={() => setOpenId(null)}
          onLog={(entry) => withLevelCheck(open.id, (q) => ({ ...q, entries: [entry, ...q.entries] }))}
          onDeleteEntry={(eid) => update(open.id, (q) => ({ ...q, entries: q.entries.filter((e) => e.id !== eid) }))}
          onToggleGoal={(gid) =>
            withLevelCheck(open.id, (q) => ({
              ...q,
              goals: q.goals.map((g) =>
                g.id === gid ? { ...g, done: !g.done, doneAt: !g.done ? todayISO() : null } : g),
            }))}
          onAddGoal={(text) => update(open.id, (q) => ({ ...q, goals: [...q.goals, { id: uid(), text, done: false, doneAt: null }] }))}
          onDeleteGoal={(gid) => update(open.id, (q) => ({ ...q, goals: q.goals.filter((g) => g.id !== gid) }))}
          onEdit={(patch) => update(open.id, (q) => ({ ...q, ...patch }))}
          onDelete={() => {
            if (!confirm(`Opravdu smazat quest „${open.name}“ i s celou historií?`)) return;
            setState((s) => ({ ...s, quests: s.quests.filter((q) => q.id !== open.id) }));
            setOpenId(null);
          }}
        />
      )}

      {showNew && (
        <NewQuest
          onClose={() => setShowNew(false)}
          onCreate={(q) => {
            setState((s) => ({ ...s, quests: [q, ...s.quests] }));
            setShowNew(false);
            setOpenId(q.id);
          }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ---------- Přehled nahoře ---------- */

function Hero({ quests }) {
  const totalXP = quests.reduce((s, q) => s + questXP(q), 0);
  const { level, into, need, pct } = levelInfo(totalXP);

  const byDay = useMemo(() => activityByDay(quests), [quests]);

  // Série: kolik dní v řadě (končí dnes nebo včera) s nějakou aktivitou
  let streak = 0;
  const d = new Date();
  if (!byDay[todayISO(d)]) d.setDate(d.getDate() - 1);
  while (byDay[todayISO(d)]) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  const week = Object.entries(byDay)
    .filter(([date]) => daysBetween(date, todayISO()) < 7)
    .reduce((s, [, xp]) => s + xp, 0);

  return (
    <header className="hero">
      <div className="hero-top">
        <div>
          <p className="eyebrow">Deník vedlejších questů</p>
          <h1>Sidequesty</h1>
        </div>
        <div className="hero-level">
          <span className="lv">Lv {level}</span>
          <span className="ttl">{titleFor(level)} dobrodruh</span>
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          <span className="mono small">{into} / {need}</span>
        </div>
      </div>

      <div className="stats">
        <Stat n={streak} label={streak === 1 ? 'den v řadě' : 'dní v řadě'} />
        <Stat n={week} label="XP za 7 dní" />
        <Stat n={totalXP} label="XP celkem" />
        <Stat n={quests.length} label="aktivních questů" />
      </div>
    </header>
  );
}

const Stat = ({ n, label }) => (
  <div className="stat"><b>{n}</b><span>{label}</span></div>
);

function activityByDay(quests) {
  const m = {};
  quests.forEach((q) => {
    q.entries.forEach((e) => (m[e.date] = (m[e.date] || 0) + e.xp));
    q.goals.forEach((g) => g.doneAt && (m[g.doneAt] = (m[g.doneAt] || 0) + GOAL_XP));
  });
  return m;
}

/* ---------- Roční heatmapa ---------- */

const MONTHS = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
const DAY_LABELS = ['po', '', 'st', '', 'pá', '', ''];
const WEEKS = 53;

function Heatmap({ quests }) {
  const [sel, setSel] = useState('all');
  const scrollRef = useRef(null);

  const selected = quests.find((q) => q.id === sel);
  const byDay = useMemo(
    () => activityByDay(selected ? [selected] : quests),
    [quests, selected],
  );

  // Na úzkém displeji odscrolluj na nejnovější týdny
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = todayISO(today);
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (WEEKS - 1) * 7);

  const items = [];
  let activeDays = 0;
  let prevMonth = null;
  for (let w = 0; w < WEEKS; w++) {
    const monday = new Date(start);
    monday.setDate(start.getDate() + w * 7);
    if (monday.getMonth() !== prevMonth) {
      // první týden zobrazeného rozsahu popiš jen pokud v něm ještě je místo
      if (w > 0 || monday.getDate() <= 7) {
        items.push(
          <span key={`m${w}`} className="hm-month" style={{ gridColumn: w + 2, gridRow: 1 }}>
            {MONTHS[monday.getMonth()]}
          </span>,
        );
      }
      prevMonth = monday.getMonth();
    }
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      if (day > today) continue;
      const iso = todayISO(day);
      const xp = byDay[iso] || 0;
      if (xp) activeDays++;
      const lvl = xp === 0 ? 0 : xp < 20 ? 1 : xp < 50 ? 2 : xp < 100 ? 3 : 4;
      items.push(
        <i
          key={iso}
          className={`hm-cell h${lvl} ${iso === todayIso ? 'today' : ''}`}
          style={{ gridColumn: w + 2, gridRow: d + 2 }}
          title={`${day.toLocaleDateString('cs-CZ')}: ${xp ? `${xp} XP` : 'nic'}`}
        />,
      );
    }
  }

  return (
    <section className="heatmap">
      <div className="hm-head">
        <span className="hm-icon" aria-hidden>📅</span>
        <select value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Quest">
          <option value="all">Všechny questy</option>
          {quests.map((q) => (
            <option key={q.id} value={q.id}>{q.icon} {q.name}</option>
          ))}
        </select>
        <span className="mono small muted hm-sum">{activeDays} aktivních dní za poslední rok</span>
      </div>
      <div className="hm-scroll" ref={scrollRef}>
        <div className="hm-grid" style={{ '--weeks': WEEKS }}>
          {DAY_LABELS.map((l, i) => (
            <span key={i} className="hm-day" style={{ gridColumn: 1, gridRow: i + 2 }}>{l}</span>
          ))}
          {items}
        </div>
      </div>
      <div className="hm-legend mono small muted">
        méně {[0, 1, 2, 3, 4].map((l) => <i key={l} className={`hm-cell h${l}`} />)} více
      </div>
    </section>
  );
}

/* ---------- Karta questu ---------- */

function QuestCard({ q, onOpen }) {
  const xp = questXP(q);
  const { level, pct } = levelInfo(xp);
  const last = lastActivity(q);
  const idle = last ? daysBetween(last, todayISO()) : null;
  const done = q.goals.filter((g) => g.done).length;
  const next = q.goals.find((g) => !g.done);

  let lastLabel = 'zatím netknuté';
  if (idle === 0) lastLabel = 'dnes';
  else if (idle === 1) lastLabel = 'včera';
  else if (idle !== null) lastLabel = `před ${idle} dny`;

  return (
    <button className={`card ${idle !== null && idle > 14 ? 'dusty' : ''}`} onClick={onOpen}>
      <div className="card-head">
        <span className="icon">{q.icon}</span>
        <div className="card-title">
          <h3>{q.name}</h3>
          <span className="mono small muted">{q.category}</span>
        </div>
        <span className="badge">Lv {level}</span>
      </div>
      <div className="bar thin"><i style={{ width: `${pct}%` }} /></div>
      <div className="card-meta mono small">
        <span>{titleFor(level)} · {xp} XP</span>
        <span className={idle !== null && idle > 14 ? 'warn' : 'muted'}>{lastLabel}</span>
      </div>
      {next && (
        <p className="next"><span className="muted">Další cíl ({done}/{q.goals.length}):</span> {next.text}</p>
      )}
      {!next && q.goals.length > 0 && <p className="next">✓ Všechny cíle splněné. Přidej nový.</p>}
    </button>
  );
}

/* ---------- Detail questu ---------- */

function QuestDetail({ q, onClose, onLog, onDeleteEntry, onToggleGoal, onAddGoal, onDeleteGoal, onEdit, onDelete }) {
  const xp = questXP(q);
  const { level, into, need, pct } = levelInfo(xp);
  const [text, setText] = useState('');
  const [xpVal, setXpVal] = useState(25);
  const [date, setDate] = useState(todayISO());
  const [goal, setGoal] = useState('');
  const [editing, setEditing] = useState(false);
  const textRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    onLog({ id: uid(), date, text: text.trim() || 'Trénink', xp: Number(xpVal) || 10 });
    setText('');
    setDate(todayISO());
    textRef.current?.focus();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="panel" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Zavřít">×</button>

        {editing ? (
          <EditForm q={q} onSave={(p) => { onEdit(p); setEditing(false); }} onCancel={() => setEditing(false)} />
        ) : (
          <div className="detail-head">
            <span className="icon big">{q.icon}</span>
            <div>
              <h2>{q.name}</h2>
              <p className="mono small muted">{q.category} · Lv {level} {titleFor(level)} · {xp} XP</p>
              {q.desc && <p className="desc">{q.desc}</p>}
            </div>
          </div>
        )}
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        <p className="mono small muted right">{into} / {need} XP do dalšího levelu</p>

        <section>
          <h4>Zapsat pokrok</h4>
          <form className="log-form" onSubmit={submit}>
            <input ref={textRef} value={text} onChange={(e) => setText(e.target.value)}
              placeholder="Co jsi dělal? (např. 20 min u zdi, 3× kick-up)" />
            <div className="row">
              {XP_PRESETS.map((p) => (
                <button type="button" key={p.xp} className={`chip ${Number(xpVal) === p.xp ? 'on' : ''}`}
                  onClick={() => setXpVal(p.xp)}>
                  {p.label} <b>+{p.xp}</b>
                </button>
              ))}
              <input type="number" min="1" className="xp-input" value={xpVal}
                onChange={(e) => setXpVal(e.target.value)} aria-label="XP" />
              <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
              <button className="btn primary">Zapsat</button>
            </div>
          </form>
        </section>

        <section>
          <h4>Cíle <span className="mono small muted">(+{GOAL_XP} XP za splnění)</span></h4>
          <ul className="goals">
            {q.goals.map((g) => (
              <li key={g.id} className={g.done ? 'done' : ''}>
                <label>
                  <input type="checkbox" checked={g.done} onChange={() => onToggleGoal(g.id)} />
                  <span>{g.text}</span>
                </label>
                {g.doneAt && <span className="mono small muted">{g.doneAt}</span>}
                <button className="x" onClick={() => onDeleteGoal(g.id)} aria-label="Smazat cíl">×</button>
              </li>
            ))}
          </ul>
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (goal.trim()) { onAddGoal(goal.trim()); setGoal(''); } }}>
            <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Nový cíl…" />
            <button className="btn">Přidat</button>
          </form>
        </section>

        <section>
          <h4>Zápisník <span className="mono small muted">({q.entries.length})</span></h4>
          {q.entries.length === 0 && <p className="muted">Zatím žádné záznamy.</p>}
          <ul className="log">
            {[...q.entries].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
              <li key={e.id}>
                <span className="mono small muted">{e.date}</span>
                <span className="grow">{e.text}</span>
                <span className="mono small">+{e.xp}</span>
                <button className="x" onClick={() => onDeleteEntry(e.id)} aria-label="Smazat záznam">×</button>
              </li>
            ))}
          </ul>
        </section>

        <div className="panel-foot">
          <button className="link" onClick={() => setEditing(true)}>Upravit</button>
          <button className="link" onClick={() => onEdit({ archived: !q.archived })}>
            {q.archived ? 'Vrátit z archivu' : 'Archivovat'}
          </button>
          <button className="link danger" onClick={onDelete}>Smazat</button>
        </div>
      </aside>
    </div>
  );
}

function EditForm({ q, onSave, onCancel }) {
  const [f, setF] = useState({ name: q.name, icon: q.icon, category: q.category, desc: q.desc });
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <QuestFields f={f} setF={setF} />
      <div className="row">
        <button className="btn primary">Uložit</button>
        <button type="button" className="btn" onClick={onCancel}>Zrušit</button>
      </div>
    </form>
  );
}

function QuestFields({ f, setF }) {
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <div className="row">
        <input className="icon-input" value={f.icon} onChange={set('icon')} maxLength={4} aria-label="Ikona" />
        <input className="grow" value={f.name} onChange={set('name')} placeholder="Název questu" required autoFocus />
      </div>
      <div className="row">
        <input list="cats" value={f.category} onChange={set('category')} placeholder="Kategorie" />
        <datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
      </div>
      <textarea value={f.desc} onChange={set('desc')} placeholder="Popis: o co jde, proč to chceš umět" rows={2} />
    </>
  );
}

function NewQuest({ onClose, onCreate }) {
  const [f, setF] = useState({ name: '', icon: '⭐', category: 'Ostatní', desc: '' });
  const [goals, setGoals] = useState('');
  return (
    <div className="overlay" onClick={onClose}>
      <aside className="panel small" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Zavřít">×</button>
        <h2>Nový quest</h2>
        <form className="form" onSubmit={(e) => {
          e.preventDefault();
          if (!f.name.trim()) return;
          onCreate({
            id: uid(), ...f, name: f.name.trim(), created: todayISO(), archived: false, entries: [],
            goals: goals.split('\n').map((t) => t.trim()).filter(Boolean)
              .map((text) => ({ id: uid(), text, done: false, doneAt: null })),
          });
        }}>
          <QuestFields f={f} setF={setF} />
          <textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={3}
            placeholder={'Cíle, každý na nový řádek (volitelné)\nnapř. Udržet volnou stojku 10 s'} />
          <button className="btn primary">Založit quest</button>
        </form>
      </aside>
    </div>
  );
}

/* ---------- Záloha dat ---------- */

function DataTools({ state, setState, setToast }) {
  const fileRef = useRef(null);
  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sidequesty-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((t) => {
      try {
        const data = JSON.parse(t);
        if (!Array.isArray(data.quests)) throw new Error();
        if (!confirm('Nahradit současná data importovaným souborem?')) return;
        setState(data);
        setToast('Data naimportována');
      } catch {
        setToast('Tohle není platná záloha.');
      }
    });
    e.target.value = '';
  };
  return (
    <div className="row">
      <button className="link" onClick={exportData}>Exportovat zálohu</button>
      <button className="link" onClick={() => fileRef.current.click()}>Importovat</button>
      <input ref={fileRef} type="file" accept="application/json" hidden onChange={importData} />
    </div>
  );
}
