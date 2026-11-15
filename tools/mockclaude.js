const store = new Map();
const subs = [];

function parentOf(p) {
  const parts = p.split("/");
  parts.pop();
  return parts.join("/");
}
function rowsUnder(col) {
  const rows = [];
  for (const [key, json] of store) {
    if (parentOf(key) === col) rows.push({ id: key.split("/").pop(), json: json });
  }
  return rows;
}
async function deliver(sub) {
  try {
    if (sub.kind === "doc") await sub.page.evaluate((id, json) => window.__push(id, json), sub.id, store.get(sub.path) || null);
    else await sub.page.evaluate((id, rows) => window.__push(id, rows), sub.id, rowsUnder(sub.path));
  } catch (e) {
    return null;
  }
}
function notify(p) {
  subs.forEach(sub => {
    if ((sub.kind === "doc" && sub.path === p) || (sub.kind === "col" && parentOf(p) === sub.path)) setTimeout(() => deliver(sub), 40 + Math.random() * 120);
  });
}

const fakeClaude = uid => `
  (function () {
    var subs = {};
    var nextId = 0;
    function freeze(o) { if (o && typeof o === "object") { Object.values(o).forEach(freeze); Object.freeze(o); } return o; }
    function snapDoc(id, json) {
      var data;
      if (json) data = freeze(JSON.parse(json));
      return { id: id, exists: !!json, data: function () { return data; }, metadata: { fromCache: false, hasPendingWrites: false } };
    }
    function docRef(p) {
      var segs = p.split("/");
      if (segs.length % 2 !== 0) throw new TypeError("doc path needs even segments: " + p);
      return {
        path: p,
        id: segs[segs.length - 1],
        get: function () { return window.__dbGet(p).then(function (j) { return snapDoc(segs[segs.length - 1], j); }); },
        set: function (data) {
          var json = JSON.stringify(data);
          if (json.length > 256 * 1024) return Promise.reject({ code: "invalid_argument", message: "too big" });
          return window.__dbSet(p, json);
        },
        onSnapshot: function (next) { var id = ++nextId; subs[id] = { kind: "doc", next: next, docId: segs[segs.length - 1] }; window.__dbSub(id, "doc", p); return function () { delete subs[id]; }; },
        collection: function (c) { return query(p + "/" + c, []); }
      };
    }
    function shape(rows, filters) {
      var list = rows.map(function (r) { var d = freeze(JSON.parse(r.json)); return { id: r.id, exists: true, data: function () { return d; }, metadata: { fromCache: false } }; });
      filters.forEach(function (f) { list = list.filter(function (d) { return d.data()[f[0]] === f[2]; }); });
      return list;
    }
    function query(p, filters) {
      if (p.split("/").length % 2 !== 1) throw new TypeError("collection path needs odd segments: " + p);
      return {
        path: p,
        where: function (f, op, v) { if (op !== "==") throw new Error("mock supports == only"); return query(p, filters.concat([[f, op, v]])); },
        doc: function (id) { return docRef(p + "/" + id); },
        get: function () { return window.__dbList(p).then(function (rows) { var docs = shape(rows, filters); return { docs: docs, size: docs.length, empty: docs.length === 0, docChanges: function () { return []; }, metadata: { fromCache: false } }; }); },
        onSnapshot: function (next) { var id = ++nextId; subs[id] = { kind: "col", next: next, filters: filters }; window.__dbSub(id, "col", p); return function () { delete subs[id]; }; }
      };
    }
    window.__push = function (id, payload) {
      var sub = subs[id];
      if (!sub) return;
      if (sub.kind === "doc") { sub.next(snapDoc(sub.docId, payload)); return; }
      var docs = shape(payload, sub.filters);
      sub.next({ docs: docs, size: docs.length, empty: docs.length === 0, docChanges: function () { return []; }, metadata: { fromCache: false } });
    };
    var db = Object.freeze({ doc: docRef, collection: function (p) { return query(p, []); } });
    var user = Object.freeze({ id: function () { return Promise.resolve("${uid}"); } });
    window.claude = { use: function (name) { return new Promise(function (resolve) { setTimeout(function () { if (name === "db") resolve(db); else if (name === "user") resolve(user); else resolve(null); }, 60); }); } };
  })();
`;

async function wire(page, uid) {
  await page.exposeFunction("__dbGet", p => store.get(p) || null);
  await page.exposeFunction("__dbSet", (p, json) => { store.set(p, json); notify(p); return true; });
  await page.exposeFunction("__dbList", col => rowsUnder(col));
  await page.exposeFunction("__dbSub", (id, kind, p) => {
    const sub = { page: page, id: id, kind: kind, path: p };
    subs.push(sub);
    setTimeout(() => deliver(sub), 30);
    return true;
  });
  await page.evaluateOnNewDocument(fakeClaude(uid));
}
function dump() {
  return Array.from(store.keys()).map(k => k + " (" + store.get(k).length + " B)");
}
function forget(page) {
  for (let i = subs.length - 1; i >= 0; i--) if (subs[i].page === page) subs.splice(i, 1);
}
module.exports = { wire, dump, forget };
