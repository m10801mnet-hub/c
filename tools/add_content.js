// Usage: node tools/add_content.js <READING|CONVO|PHRASES> file1.js [file2.js ...]
// Appends validated, de-duplicated items to the matching single-line array in index.html.
const fs = require("fs"), path = require("path");
const [, , name, ...files] = process.argv;
const html = path.join(__dirname, "..", "index.html");
let s = fs.readFileSync(html, "utf8");
const re = new RegExp("const " + name + " = (\\[.*\\]);\\n");
const m = s.match(re);
if (!m) throw new Error("array not found: " + name);
const cur = JSON.parse(m[1]);
const keyOf = x => name === "READING" ? x.ti + "|" + x.tx.slice(0, 40)
  : name === "CONVO" ? x.sc[0][1] : x[1];
const seen = new Set(cur.map(keyOf));
function check(x) {
  if (name === "PHRASES") return Array.isArray(x) && x.length === 3 && x.every(v => typeof v === "string" && v);
  if (!x.jt || !Array.isArray(x.qs) || !x.qs.length) return false;
  if (name === "READING" && !(x.ty && x.ti && x.tx)) return false;
  if (name === "CONVO" && !(Array.isArray(x.sc) && x.sc.length >= 2 && x.sc.every(l => /^[MW]$/.test(l[0]) && l[1]))) return false;
  return x.qs.every(q => q.q && Array.isArray(q.o) && q.o.length === 4 && new Set(q.o).size === 4 && q.a >= 0 && q.a < 4 && q.ej);
}
let added = 0, skipped = [];
for (const f of files) {
  for (const x of require(path.resolve(f))) {
    const k = keyOf(x);
    if (!check(x)) { skipped.push("invalid: " + k); continue; }
    if (seen.has(k)) { skipped.push("duplicate: " + k); continue; }
    seen.add(k); cur.push(x); added++;
  }
}
s = s.replace(re, () => "const " + name + " = " + JSON.stringify(cur) + ";\n");
fs.writeFileSync(html, s);
console.log(`${name}: +${added} (total ${cur.length})`);
if (skipped.length) console.log("skipped:\n " + skipped.join("\n "));
