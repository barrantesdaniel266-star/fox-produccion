// 1) Fusiona pares confirmados (Excel -> cliente del sistema) dejando el nombre más largo.
// 2) Normaliza el formato de TODOS los clientes (nombre/dirección MAYÚSCULAS, tel solo dígitos, correo minúsculas, NIT limpio).
// Uso: node scripts/normalizar-clientes.mjs <cuenta.json> <reporte-dudosos.json> <backup-salida.json> [--execute]
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
const [sa, repPath, backupPath] = process.argv.slice(2);
const EXECUTE = process.argv.includes("--execute");
initializeApp({ credential: cert(JSON.parse(fs.readFileSync(sa, "utf8"))) });
const db = getFirestore();
const clienteId = n => String(n||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
const limpia = s => String(s ?? "").replace(/\s+/g," ").trim();

const CONFIRMADOS = ["LUIS ALEJANDRO MUNAR","RODRIGO CARVAJAL GOMEZ","GABRIEL ANTONIO VARELA","CARLOS ALBERTO VARGAS","LUIS ORLANDO CAMARGO","HECTOR MARTINEZ","YUBER ALONZO MATEUS JIMENEZ","RICARDO GELVEZ MORENO","EDGAR JOSE MEDINA","JOSE ANTONIO RODRIGUEZ","CLUB CANINO CAMPESTRE","GRUPO CORAMA R.A SAS","ESTRUCTURAS METALICAS JGB SAS","JHOAN ANDRES ESPAÑA"];
const rep = JSON.parse(fs.readFileSync(repPath, "utf8"));
const snap = await db.collection("clientes").get();
const exist = new Map(snap.docs.map(d => [d.id, { ...d.data(), id: d.id }]));
fs.writeFileSync(backupPath, JSON.stringify([...exist.values()]));

// ── 1) fusiones ──
const cambios = new Map(); // id -> objeto actualizado
const merges = [];
for (const nom of CONFIRMADOS) {
  const x = rep.revisar.find(v => v.excel.nombre === nom); if (!x) { console.log("NO ENCONTRADO:", nom); continue; }
  const c = { ...(cambios.get(x.sistema.id) || exist.get(x.sistema.id)) }; if (!c.id) { console.log("SIN DOC:", x.sistema.id); continue; }
  const e = x.excel;
  const largo = limpia(e.nombre).length > limpia(c.nombre).length ? limpia(e.nombre) : limpia(c.nombre);
  const corto = largo === limpia(e.nombre) ? limpia(c.nombre) : limpia(e.nombre);
  const aliases = new Set((c.aliases||[]).map(String)); if (clienteId(corto) && clienteId(corto) !== c.id) aliases.add(corto);
  merges.push(`${corto}  +  ${limpia(c.nombre)}  ->  ${largo}`);
  c.nombre = largo; c.aliases = [...aliases];
  for (const k of ["telefono","email","direccion","docNumero"]) if (!limpia(c[k]) && e[k]) { c[k] = e[k]; if (k==="docNumero") c.docTipo = e.docTipo; }
  cambios.set(c.id, c);
}

// ── 1b) duplicados ya existentes en el sistema (mismo doc/teléfono/nombre) ──
const DUPES = [["alianza_ferretera_comercial","alianza_ferretera_comercial_s_a_s",null],["suministros_industriales_fer_oriente_sas","suministros_industriales_y_fer_oriente_s_a_s",null],["ramirezg_s_a_s","ramirezg_sas",null],["inversiones_hipercars_s_a_s","inversiones_hypercars_sas",null],["andres_zul_eta","andres_zuleta","ANDRES ZULETA"]];
const borrar = [];
for (const [a, b, nombreFijo] of DUPES) {
  const A = exist.get(a), B = exist.get(b); if (!A || !B) { console.log("DUP no encontrado", a, b); continue; }
  const [P, D] = (A.updatedAt||0) >= (B.updatedAt||0) ? [A, B] : [B, A];
  const c = { ...P };
  const largo = nombreFijo || (limpia(D.nombre).length > limpia(P.nombre).length ? limpia(D.nombre) : limpia(P.nombre));
  const al = new Set([...(P.aliases||[]), ...(D.aliases||[]), limpia(P.nombre), limpia(D.nombre)].map(String));
  c.nombre = largo; c.aliases = [...al].filter(x => clienteId(x) && clienteId(x) !== c.id);
  for (const k of ["docTipo","docNumero","telefono","email","direccion"]) if (!limpia(c[k]) && limpia(D[k])) c[k] = D[k];
  cambios.set(c.id, c); borrar.push(D.id); merges.push(`DUPLICADO ${D.nombre} (${D.id}) -> ${largo} (${c.id})`);
}
// ── 2) formato ──
const fmtTel = t => { const s = limpia(t); if (!s) return ""; if (/^[\d\s().+-]+$/.test(s)) { let d = s.replace(/\D/g,""); if (d.length===12 && d.startsWith("57")) d = d.slice(2); return d; } return s; };
const fmtDoc = d => { const s = limpia(d); if (!s) return ""; if (/^[\d\s.\-]+$/.test(s)) return s.replace(/[\s.]/g,"").replace(/-+/g,"-").replace(/-$/,""); return s; };
const fmtNombre = n => limpia(n).toUpperCase();
const fmtMail = m => limpia(m).toLowerCase().replace(/[.,;]+$/,"");
const fmtDir = d => limpia(d).toUpperCase();
let nFmt = 0;
const finales = [];
for (const [id, orig] of exist) {
  if (borrar.includes(id)) continue;
  const c = { ...(cambios.get(id) || orig) };
  const n = { ...c, nombre: fmtNombre(c.nombre), docNumero: fmtDoc(c.docNumero), telefono: fmtTel(c.telefono), email: fmtMail(c.email), direccion: fmtDir(c.direccion) };
  const dif = ["nombre","docNumero","telefono","email","direccion","aliases"].some(k => JSON.stringify(n[k]??"") !== JSON.stringify(orig[k]??""));
  if (dif) { if (cambios.has(id) ? false : true) nFmt++; finales.push(n); }
}
console.log(`Fusiones: ${merges.length}`); merges.forEach(m => console.log("  ", m));
console.log(`Fichas a actualizar en total: ${finales.length} (solo por formato: ${nFmt})`);
// colisión: dos clientes con el mismo nombre tras formatear
const vistos = new Map(); for (const c of [...exist.values()].filter(o=>!borrar.includes(o.id)).map(o => cambios.get(o.id) || o)) { const k = clienteId(c.nombre); if (vistos.has(k)) console.log("OJO nombre repetido:", c.nombre, "|", vistos.get(k)); vistos.set(k, c.nombre); }
if (EXECUTE) {
  let b = db.batch(), p = 0;
  for (const c of finales) { const { id, ...resto } = c; b.set(db.collection("clientes").doc(id), { ...resto, id, updatedAt: Date.now() }); if (++p === 400) { await b.commit(); b = db.batch(); p = 0; } }
  if (p) await b.commit();
  for (const id of borrar) await db.collection("clientes").doc(id).delete();
  console.log("BORRADOS (duplicados fusionados):", borrar.length);
  console.log("ESCRITO:", finales.length);
}
