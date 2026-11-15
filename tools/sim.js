const fs = require("fs");
const path = require("path");
const dir = __dirname;
const words = fs.readFileSync(path.join(dir, "..", "src", "words.enc"), "utf8");
const code = fs.readFileSync(path.join(dir, "main.js"), "utf8");

function stubEl() {
  const el = { innerHTML: "", textContent: "", hidden: true, value: "", style: { setProperty() {} }, classList: { add() {}, remove() {} }, dataset: {} };
  el.querySelector = () => null;
  el.querySelectorAll = () => [];
  el.addEventListener = () => {};
  el.appendChild = () => {};
  el.focus = () => {};
  return el;
}
const els = {};
global.window = global;
global.location = { hash: "", protocol: "file:", href: "file:///x" };
global.navigator = {};
global.document = {
  getElementById(id) { if (id === "wordsData") return { textContent: words }; return els[id] || null; },
  querySelector(s) { if (!els[s]) els[s] = stubEl(); return els[s]; },
  querySelectorAll() { return []; },
  addEventListener() {},
  createElement() { return stubEl(); },
  head: stubEl()
};
global.setInterval = () => 0;
eval(code);
const IM = global.__inkmalice;
IM.ensureWords();

function check(st, label) {
  const seen = new Map();
  function mark(id, where) {
    if (seen.has(id)) throw new Error(label + ": tile " + id + " in " + where + " and " + seen.get(id));
    seen.set(id, where);
  }
  st.deck.forEach(id => mark(id, "deck"));
  st.discard.forEach(id => mark(id, "discard"));
  st.players.forEach((p, i) => p.hand.forEach(id => mark(id, "hand" + i)));
  st.pool.forEach(x => { if (typeof x.t === "number") mark(x.t, "pool"); });
  for (let id = 0; id < 100; id++) {
    if (!seen.has(id)) throw new Error(label + ": base tile " + id + " missing");
  }
  for (const [id, where] of seen) {
    if (id >= 100 && where !== "pool") throw new Error(label + ": gilt tile " + id + " in " + where);
    if (id >= 100 + st.players.length) throw new Error(label + ": unknown tile " + id);
  }
  st.players.forEach((p, i) => {
    if (p.out && p.hand.length) throw new Error(label + ": out player " + i + " holds glyphs");
    if (p.seals > 3) throw new Error(label + ": seals > 3");
  });
}

const N = Number(process.argv[2] || 300);
let totalSteps = 0;
const stats = { games: 0, curses: 0, charms: {}, timeouts: 0, fizzles: 0, counters: 0, seals: 0, maxMalice: 0, wins: {} };
const levels = ["easy", "normal", "hard"];
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const n = 2 + (g % 4);
  const players = [];
  for (let i = 0; i < n; i++) players.push({ name: "B" + i, kind: "bot", level: levels[(g + i) % 3], client: "" });
  const timer = [45, 0, 30][g % 3];
  let now = 1e12;
  let st = IM.newGame(players, { timer: timer, dict: true, coach: false, handoff: false }, now, null);
  check(st, "g" + g + " start");
  let steps = 0;
  let chainMalice = -1;
  while (st.status === "playing") {
    steps++;
    if (steps > 4000) throw new Error("g" + g + ": game did not finish");
    const t = st.turn;
    now += 1000;
    let a;
    if (timer && Math.random() < 0.03) {
      now = t.deadline + 10;
      a = { type: "timeout", turnId: t.id };
      stats.timeouts++;
    } else {
      a = IM.botAction(st, t.seat);
    }
    const prevPhase = t.phase;
    const prevMalice = st.malice;
    const r = IM.reduce(st, a, now);
    if (r.error) throw new Error("g" + g + " step " + steps + ": bot action rejected: " + r.error + " " + JSON.stringify(a) + " phase " + t.phase);
    st = r.state;
    check(st, "g" + g + " step " + steps);
    if (a.type === "submit" && prevPhase === "counter") {
      stats.counters++;
      if (!(st.malice > prevMalice)) throw new Error("malice did not rise");
    }
    if (a.type === "charm") { const c = st.ev.charm; stats.charms[c] = (stats.charms[c] || 0) + 1; }
    if (a.type === "curse" || (a.type === "timeout" && prevPhase === "curse")) stats.curses++;
    if (a.type === "fizzle") stats.fizzles++;
    if (st.ev && st.ev.k === "seal" && st.ev.n !== (r._n || 0)) {}
    if (st.malice > stats.maxMalice) stats.maxMalice = st.malice;
    if (st.status === "playing" && st.turn.phase === "tidy") {
      const p = st.players[st.turn.seat];
      if (p.hand.length > 8) throw new Error("hand too big " + p.hand.length);
    }
    if (st.status === "playing" && (st.turn.phase === "cast" || st.turn.phase === "counter")) {
      const p = st.players[st.turn.seat];
      if (p.hand.length > IM.HAND && !(p.charm === "borrow" && p.charmUsed)) throw new Error("hand over limit at " + st.turn.phase + ": " + p.hand.length);
    }
  }
  const al = IM.alive(st);
  if (al.length !== 1 || st.winner !== al[0]) throw new Error("g" + g + ": bad finish");
  stats.seals += st.players.reduce((s, p) => s + p.seals, 0);
  const lv = st.players[st.winner].level;
  stats.wins[lv] = (stats.wins[lv] || 0) + 1;
  stats.games++;
  totalSteps += steps;
}
console.log("games", stats.games, "avg steps", Math.round(totalSteps / stats.games), "ms per step", ((Date.now() - t0) / totalSteps).toFixed(2));
console.log(JSON.stringify(stats));
