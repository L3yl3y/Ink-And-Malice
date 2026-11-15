module.exports = function driverStep(opts) {
  opts = opts || {};
  const IM = window.__inkmalice;
  const peek = IM.peek();
  const S = peek.S;
  const q = s => document.querySelector(s);
  const qa = s => Array.from(document.querySelectorAll(s));
  function key(k) { document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })); }
  const cover = q("#cover");
  if (cover && !cover.hidden) {
    const b = cover.querySelector('[data-act="ready"]');
    if (b) { b.click(); return "ready"; }
  }
  if (q(".over")) return "over";
  if (!S || S.status !== "playing") return "wait";
  if (opts.idle) return "wait";
  if (q('[data-act="cast"]')) {
    const me = peek.me;
    const t = S.turn;
    if (window.__lastCastTurn === t.id + ":" + S.seq) return "wait";
    const charm = q('[data-act="charm"]');
    if (charm && Math.random() < 0.5) { charm.click(); return "charm"; }
    let need = 0;
    if (t.phase === "counter") need = S.malice;
    const items = IM.availableFor(S, me);
    const res = IM.searchWords(items, 1 + S.fx.blots, need, S.fx.bonus, true, 9);
    if (!res.length) {
      const b = q('[data-act="fizzle"]') || q('[data-act="yield"]');
      b.click();
      window.__lastCastTurn = t.id + ":" + S.seq;
      return "giveup";
    }
    if (Math.random() < 0.08) {
      const y = q('[data-act="yield"]');
      if (y) { y.click(); window.__lastCastTurn = t.id + ":" + S.seq; return "yield"; }
    }
    res.sort((a, b) => b.score - a.score);
    const pick = res[Math.floor(Math.random() * Math.min(4, res.length))];
    const word = IM.WORDS()[pick.w].toUpperCase();
    key("Escape");
    for (const ch of word) key(ch);
    const prev = (q(".preview") || {}).textContent || "";
    key("Enter");
    window.__lastCastTurn = t.id + ":" + S.seq;
    return "cast:" + word + ":" + prev.slice(0, 40);
  }
  const targets = qa('[data-act="target"]');
  if (targets.length) {
    const enabled = targets.filter(b => !b.disabled);
    if (!enabled.length || Math.random() < 0.25) {
      const hand = qa('.hand [data-src="hand"]:not(.disc)');
      if (hand.length) { hand[Math.floor(Math.random() * hand.length)].click(); return "discard"; }
    }
    const pool = targets.filter(b => !b.disabled);
    if (pool.length) { pool[Math.floor(Math.random() * pool.length)].click(); return "target"; }
    return "stuck-target";
  }
  const curse = qa('[data-act="curse"]');
  if (curse.length) { curse[0].click(); return "curse"; }
  return "wait";
};
