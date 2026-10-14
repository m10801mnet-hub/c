// Usage: node tools/add_content.js <EEVOCAB|VOCAB|GRAMMAR|LISTEN|READING|CONVO|TALKS|PHRASES> file1.js [file2.js ...]
// Each input file is a CommonJS module exporting an array of items (schemas: CONTENT_GUIDE.md).
// Items are validated, de-duplicated against existing data, then appended to the single-line
// array of the same name in index.html. Invalid/duplicate items are reported and skipped.
const fs = require("fs"), path = require("path");
const [, , name, ...files] = process.argv;
const html = path.join(__dirname, "..", "index.html");
let s = fs.readFileSync(html, "utf8");
const re = new RegExp("const " + name + " = (\\[.*\\]);\\n");
const m = s.match(re);
if (!m) { console.error("array not found: " + name); process.exit(1); }
const cur = JSON.parse(m[1]);

const str = v => typeof v === "string" && v.trim().length > 0;
const mc = (q, n) => q && str(q.q) && Array.isArray(q.o) && q.o.length === n && q.o.every(str)
  && new Set(q.o).size === n && Number.isInteger(q.a) && q.a >= 0 && q.a < n && str(q.ej);
const norm = t => String(t).toLowerCase().replace(/\s+/g, " ").trim();

const spec = {
  VOCAB:   { key: x => norm(x.w), ok: x => str(x.w) && str(x.p) && str(x.j) && Array.isArray(x.d) && x.d.length === 3 && x.d.every(str) && !x.d.includes(x.j) && Array.isArray(x.ex) && x.ex.length >= 1 && x.ex.every(e => str(e.e) && str(e.t)) },
  GRAMMAR: { key: x => norm(x.q), ok: x => str(x.q) && x.q.includes("___") && mc({ q: x.q, o: x.o, a: x.a, ej: x.ej }, 4) && str(x.c) && str(x.jt) && str(x.ee) },
  LISTEN:  { key: x => norm(x.p), ok: x => str(x.p) && mc({ q: x.p, o: x.o, a: x.a, ej: x.ej }, 3) && str(x.t) },
  READING: { key: x => norm((x.docs ? x.docs.map(d => d.tx).join("|") : x.tx).slice(0, 80)),
             ok: x => str(x.ty) && str(x.jt) && (x.docs ? (Array.isArray(x.docs) && x.docs.length >= 2 && x.docs.every(d => str(d.ti) && str(d.tx))) : (str(x.ti) && str(x.tx)))
                     && Array.isArray(x.qs) && x.qs.length >= 2 && x.qs.every(q => mc(q, 4)) },
  CONVO:   { key: x => norm(x.sc.map(l => l[1]).join(" ").slice(0, 80)),
             ok: x => Array.isArray(x.sc) && x.sc.length >= 3 && x.sc.every(l => /^[MW]$/.test(l[0]) && str(l[1])) && str(x.jt) && Array.isArray(x.qs) && x.qs.length === 3 && x.qs.every(q => mc(q, 4)) },
  TALKS:   { key: x => norm(x.tx.slice(0, 80)),
             ok: x => str(x.ty) && str(x.tx) && /^[MW]$/.test(x.v) && str(x.jt) && Array.isArray(x.qs) && x.qs.length === 3 && x.qs.every(q => mc(q, 4)) },
  EEVOCAB: { key: x => norm(x.w), ok: x => str(x.w) && str(x.p) && str(x.df) && str(x.ex) && str(x.j) && Array.isArray(x.dd) && x.dd.length === 2 && x.dd.every(str) && !x.dd.includes(x.df) && Array.isArray(x.dw) && x.dw.length === 2 && x.dw.every(str) && !x.dw.map(norm).includes(norm(x.w)) },
  PHRASES: { key: x => norm(x[2]), ok: x => Array.isArray(x) && x.length === 3 && x.every(str) },
}[name];
if (!spec) { console.error("unknown category: " + name); process.exit(1); }

const seen = new Set(cur.map(x => { try { return spec.key(x); } catch (_) { return null; } }));
let added = 0; const skipped = [];
for (const f of files) {
  delete require.cache[path.resolve(f)];
  for (const x of require(path.resolve(f))) {
    let k; try { k = spec.key(x); } catch (_) { k = null; }
    if (!k || !spec.ok(x)) { skipped.push("invalid: " + JSON.stringify(x).slice(0, 90)); continue; }
    if (seen.has(k)) { skipped.push("duplicate: " + k.slice(0, 70)); continue; }
    seen.add(k); cur.push(x); added++;
  }
}
s = s.replace(re, () => "const " + name + " = " + JSON.stringify(cur) + ";\n");
fs.writeFileSync(html, s);
console.log(`${name}: +${added} (total ${cur.length})`);
if (skipped.length) console.log("skipped " + skipped.length + ":\n " + skipped.join("\n "));
