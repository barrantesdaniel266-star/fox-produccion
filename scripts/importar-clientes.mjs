// Importa clientes desde un Excel (TIPO IDE, NUMERO IDE, NOMBRE, CELULAR, CORREO, DIRECCION).
// Uso: node scripts/importar-clientes.mjs "<excel>" "<cuenta-de-servicio.json>" [--execute]
// Sin --execute es dry-run (solo lectura). Solo CREA clientes nuevos; nunca pisa fichas existentes.
import XLSXPkg from "xlsx";
const XLSX = XLSXPkg.default || XLSXPkg;
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const [excel, sa] = process.argv.slice(2);
const EXECUTE = process.argv.includes("--execute");
initializeApp({ credential: cert(JSON.parse(fs.readFileSync(sa, "utf8"))) });
const db = getFirestore();

const clienteId = n => String(n||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
const limpia = s => String(s ?? "").replace(/\s+/g," ").trim();
const digs = s => String(s||"").replace(/\D/g,"");
const docKey = d => { const x=digs(d); return x.length>=6 ? x : ""; };       // documento completo
const docBase = d => { const x=digs(d); return x.length>=8 ? x.slice(0,-1) : ""; }; // sin dígito de verificación

const wb = XLSX.readFile(excel);
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Hoja1"], { header:1, defval:"" }).slice(1);
const excelRows = [];
for (const r of rows) {
  const nombre = limpia(r[2]); if (!nombre) continue;
  let tel = limpia(r[3]); if (/^\d+\.0$/.test(tel)) tel = tel.slice(0,-2);
  excelRows.push({
    docTipo: /^cc/i.test(limpia(r[0])) ? "CC" : "NIT",
    docNumero: limpia(r[1]), nombre, telefono: tel,
    email: limpia(r[4]).replace(/[.,;]+$/,"").toLowerCase(), direccion: limpia(r[5]),
  });
}

const snap = await db.collection("clientes").get();
const exist = snap.docs.map(d => ({ ...d.data(), id: d.id }));
const byId = new Map(), byDoc = new Map(), byBase = new Map();
for (const c of exist) {
  byId.set(c.id, c); (c.aliases||[]).forEach(a => byId.set(clienteId(a), c));
  byId.set(clienteId(c.nombre), c);
  const k = docKey(c.docNumero); if (k) byDoc.set(k, c);
  const b = docBase(c.docNumero); if (b) byBase.set(b, c);
}

const normF=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\b(s\s*a\s*s|sas|s\s*a|ltda|limitada|cia|y|de|la|el|los|las|e\.?s\.?p|sa)\b/g," ").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const toks=s=>new Set(normF(s).split(" ").filter(t=>t.length>1));
const jac=(a,b)=>{const i=[...a].filter(x=>b.has(x)).length;return i/(a.size+b.size-i||1)};
const EX=exist.map(c=>({c,t:toks(c.nombre)}));
const mejor=nombre=>{const t=toks(nombre);let b=null,bs=0;for(const e of EX){const sc=jac(t,e.t);if(sc>bs){bs=sc;b=e.c;}}return {b,bs};};
const nuevos = [], yaExisten = [], dupExcel = [], sinNombreValido = [], revisar = [];
const vistos = new Map();
for (const r of excelRows) {
  const id = clienteId(r.nombre);
  if (!id) { sinNombreValido.push(r); continue; }
  const dk = docKey(r.docNumero);
  const prev = vistos.get(id) || (dk && vistos.get("doc:"+dk));
  if (prev) { dupExcel.push({ r, con: prev.nombre }); continue; }
  vistos.set(id, r); if (dk) vistos.set("doc:"+dk, r);
  const m = byId.get(id) || (dk && byDoc.get(dk)) || (docBase(r.docNumero) && (byBase.get(docBase(r.docNumero)) || byDoc.get(docBase(r.docNumero))));
  let fz = null;
  if (!m) { fz = mejor(r.nombre); if (fz.bs >= 0.8) fz.conf = true; else if (fz.bs >= 0.6) { revisar.push({ excel:r, sistema:{ id:fz.b.id, nombre:fz.b.nombre, docNumero:fz.b.docNumero } }); continue; } else fz = null; }
  const mm = m || (fz && fz.b);
  if (mm) {
    const m2 = mm;
    const porNombre = byId.has(id);
    const llena = ["telefono","email","direccion","docNumero"].filter(k => !limpia(m2[k]) && r[k]);
    const difiere = ["telefono","email","direccion","docNumero"].filter(k => limpia(m2[k]) && r[k] && digs(m2[k])!==digs(r[k]) && String(m2[k]).toLowerCase()!==String(r[k]).toLowerCase());
    yaExisten.push({ r, m:m2, porNombre, llena, difiere });
  } else nuevos.push({ ...r, id });
}

console.log(`Excel: ${excelRows.length} filas con nombre | Sistema: ${exist.length} clientes`);
console.log(`NUEVOS (no están en el sistema): ${nuevos.length}`);
console.log(`YA EXISTEN: ${yaExisten.length}  (por nombre: ${yaExisten.filter(x=>x.porNombre).length}, solo por documento: ${yaExisten.filter(x=>!x.porNombre).length})`);
console.log(`  - con datos que el sistema no tiene y el Excel sí: ${yaExisten.filter(x=>x.llena.length).length}`);
console.log(`  - con datos distintos al Excel: ${yaExisten.filter(x=>x.difiere.length).length}`);
console.log(`Posibles duplicados dudosos (NO se crean, revisar a mano): ${revisar.length}`);
console.log(`Repetidos dentro del Excel (omitidos): ${dupExcel.length}`);
console.log(`Sin nombre válido: ${sinNombreValido.length}`);
const out = { nuevos, yaExisten: yaExisten.map(x=>({excel:x.r, sistema:{id:x.m.id,nombre:x.m.nombre,docNumero:x.m.docNumero,telefono:x.m.telefono,email:x.m.email,direccion:x.m.direccion}, porNombre:x.porNombre, llena:x.llena, difiere:x.difiere})), dupExcel, revisar };
fs.writeFileSync(process.env.OUT || "importar-clientes-reporte.json", JSON.stringify(out,null,1));

if (EXECUTE) {
  fs.writeFileSync((process.env.OUT||"rep.json").replace(/\.json$/,"")+"-backup-clientes.json", JSON.stringify(exist));
  let rel = 0;
  for (const x of yaExisten) { if (!x.llena.length) continue; const upd = { updatedAt: Date.now() }; x.llena.forEach(k => upd[k] = x.r[k]); if (x.llena.includes("docNumero")) upd.docTipo = x.r.docTipo; await db.collection("clientes").doc(x.m.id).update(upd); rel++; }
  console.log(`FICHAS EXISTENTES COMPLETADAS (solo campos vacíos): ${rel}`);
  let n = 0, batch = db.batch(), pend = 0;
  for (const c of nuevos) {
    batch.create(db.collection("clientes").doc(c.id), { id:c.id, nombre:c.nombre, aliases:[], docTipo:c.docTipo, docNumero:c.docNumero, telefono:c.telefono, email:c.email, direccion:c.direccion, updatedAt:Date.now(), origen:"importacion-excel" });
    n++; if (++pend === 400) { await batch.commit(); batch = db.batch(); pend = 0; }
  }
  if (pend) await batch.commit();
  console.log(`CREADOS: ${n}`);
}
