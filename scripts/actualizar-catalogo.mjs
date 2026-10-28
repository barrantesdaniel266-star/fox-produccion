// Actualiza precios (precioMin) y agrega productos nuevos según CATÁLOGO 2026.
// Uso:
//   node scripts/actualizar-catalogo.mjs           -> dry-run (solo muestra qué cambiaría)
//   node scripts/actualizar-catalogo.mjs --execute -> escribe en Firestore
// Solo toca precioMin de productos existentes (no stock ni movimientos) y crea los que faltan (stock 0).

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.local.mjs";

const EXECUTE = process.argv.includes("--execute");
const norm = s => String(s || "").trim().replace(/\s+/g, " ").toUpperCase();

// ── PRECIOS DE PRODUCTOS EXISTENTES: [nombre exacto en inventario, precio] ──
const precios = [];
const P = (n, v) => precios.push([n, v]);

// Malla eslabonada galvanizada ($/m²) por calibre y hueco; aplica a todas las alturas
const ESL = {
  "10,5": { '2"1/2': 14000, '2"1/4': 16500, '2"': 18500, '1"1/2': 25000, '1"': 40000 },
  "12,5": { '2"1/2': 10000, '2"1/4': 12000, '2"': 13000, '1"1/2': 20000, '1"': 30000 },
  "14":   { '2"1/2': 8000,  '2"1/4': 9000,  '2"': 10000, '1"1/2': 16000, '1"': 25000 },
};
const ESL_RE = /^MALLA ESLABONADA CAL (10,5|12,5|14) H (2"1\/2|2"1\/4|2"|1"1\/2|1") ?\* ?[\d.,]+$/;

// Malla gallinero
P('MALLA GALLINERO *36MTS H 1"1/4 * 0.90', 65000);
P('MALLA GALLINERO *36MTS H 1"1/4 * 1.20', 85000);
P('MALLA GALLINERO *36MTS H 1"1/4 * 1.50', 95000);
P('MALLA GALLINERO *36MTS H 1"1/4 * 1.80', 115000);
P('MALLA GALLINERO *30 MTS H 2" * 1,65', 160000);
// Malla pajarito (precios indicados por gerencia; el PDF trae 2 filas con error)
P('MALLA PAJARITO *30 MTS H 1/2" * 1', 145000);
P('MALLA PAJARITO *30 MTS H 1/2" * 0.90', 135000);
P('MALLA PAJARITO *30MTS H 3/4" * 1', 125000);
P('MALLA PAJARITO *30MTS H 3/4" * 1.50', 170000);
P('MALLA PAJARITO *30MTS H 3/4" * 1.80', 200000);
// Alambre de púas
P("ALAMBRE DE PUAS CAL 12,5 * 400 MTS", 310000);
P("ALAMBRE DE PUAS CAL 12,5 * 200 MTS", 200000);
P("ALAMBRE DE PUAS CAL 14,5 * 100 MTS", 80000);
P("ALAMBRE DE PUAS CAL 14,5 * 200 MTS", 125000);
P("ALAMBRE DE PUAS CAL 14,5 * 500 MTS", 260000);
P("ALAMBRE DE PUAS CAL 16,5 * 200 MTS", 90000);
P("ALAMBRE DE PUAS CAL 16,5 * 400 MTS", 150000);
// Postes completos (3 m)
P('POSTE TERMINADO CAL 18 EN 1"1/2', 45000);
P('POSTE TERMINADO CAL 18 EN 2"', 55000);
P('POSTE TERMINADO CAL 16 EN 1"1/2', 55000);
P('POSTE TERMINADO CAL 16 EN 2"', 65000);
// Tubo galvanizado (6 m)
P('TUBO GALVANIZADO IMPORTADO CAL 18 EN 1"1/2 * 6 MTS', 65000);
P('TUBO GALVANIZADO IMPORTADO CAL 18 EN 2" * 6 MTS', 75000);
P('TUBO GALVANIZADO IMPORTADO CAL 16 EN 1"1/2 * 6 MTS', 80000);
P('TUBO GALVANIZADO IMPORTADO CAL 16 EN 2" * 6 MTS', 95000);
// Gaviones
P("GAVION MANUAL CAL 12.5 H 10*10", 85000);
P("GAVION MANUAL CAL 12.5 H 12*12", 75000);
P("GAVION MAQUINADO CON CAL 12.5 H 10*10", 95000);
P("GAVION MAQUINADO CON CAL 12.5 H 12*12", 85000);
// Concertina y complementos
P("CONCERTINA ACERO INOXIDABLE *6MTS", 50000);
P("PERRO 1/8", 800);
P("TENSOR 3/16", 2500);
P("GUAYA 1/8", 2000);
P("VARILLA 1/2 * 60cm", 10000);
// Accesorios
P("GRAPA", 13000);
P("PLATINA 1/2*1/8 * 6 MTS", 10000);
P('TAPON 1"1/2', 2500);
P('TAPON 2"', 3000);
P("ANGULO 1*1/8 * 6 MTS", 35000);
// Alambre galvanizado ($/kg)
P("ALAMBRE CAL 11 (500 kg)", 7500);
P("ALAMBRE CAL 11 (100 kg)", 7500);
P("ALAMBRE CAL 14", 7500);

// ── PRODUCTOS NUEVOS (no existen en el inventario) ──
const nuevos = [];
const N = (nombre, categoria, unidad, precioMin) => nuevos.push({ nombre, categoria, unidad, precioMin });
// Malla ondulada ($/m²)
const OND = {
  "8":    { '3/4"': 126000, '1/4"': 89600, '2"': 50000 },
  "10,5": { '1/2"': 80000, '1"1/2': 38000, '1"': 42000, '2"': 29000 },
  "12,5": { '1/2"': 62600, '1"1/2': 30000, '1"': 40000, '2"': 27000 },
};
for (const [cal, hs] of Object.entries(OND))
  for (const [h, v] of Object.entries(hs)) N(`MALLA ONDULADA CAL ${cal} H ${h}`, "Malla Ondulada", "m²", v);
// Malla PVC calibre 10,5 ($/m²)
for (const [h, v] of Object.entries({ '2"1/2': 17000, '2"1/4': 18500, '2"': 20000, '1"1/2': 30000, '1"': 40000 }))
  N(`MALLA PVC CAL 10,5 H ${h}`, "Malla PVC", "m²", v);
N("ALAMBRE DE PUAS CAL 12,5 * 100 MTS", "Alambre de Púas", "unidades", 90000);
N("GAVION MANUAL CAL 10.5 H 10*10", "Gaviones", "unidades", 160000);
N("GAVION MAQUINADO CON CAL 10.5 H 10*10", "Gaviones", "unidades", 170000);
N("ALAMBRE CAL 13", "Alambre", "kg", 7500);

// ── Ejecución ──
const db = getFirestore(initializeApp(firebaseConfig));
const snap = await getDocs(collection(db, "inventario"));
const porNombre = new Map(snap.docs.map(d => [norm(d.data().nombre), { id: d.id, ...d.data() }]));

const cambios = []; // {id, nombre, antes, despues}
const faltantes = [];
for (const [n, v] of precios) {
  const p = porNombre.get(norm(n));
  if (!p) { faltantes.push(n); continue; }
  cambios.push({ id: p.id, nombre: p.nombre, antes: p.precioMin, despues: v });
}
for (const p of porNombre.values()) {
  const m = ESL_RE.exec(norm(p.nombre));
  if (!m) continue;
  const v = ESL[m[1]]?.[m[2]];
  if (v) cambios.push({ id: p.id, nombre: p.nombre, antes: p.precioMin, despues: v });
}

const crear = nuevos.filter(n => !porNombre.has(norm(n.nombre)));
const yaExisten = nuevos.length - crear.length;

console.log(`\n=== ${EXECUTE ? "EJECUCIÓN REAL" : "DRY-RUN"} ===`);
console.log(`Precios a actualizar: ${cambios.length}`);
cambios.forEach(c => console.log(`  ${c.nombre}: ${c.antes === "" || c.antes == null ? "(sin precio)" : c.antes} -> ${c.despues}`));
console.log(`\nProductos nuevos a crear: ${crear.length} (ya existían: ${yaExisten})`);
crear.forEach(n => console.log(`  + ${n.nombre} [${n.categoria}, ${n.unidad}] $${n.precioMin}`));
if (faltantes.length) { console.log(`\nNOMBRES NO ENCONTRADOS en el inventario (${faltantes.length}):`); faltantes.forEach(n => console.log(`  ? ${n}`)); }

if (!EXECUTE) { console.log("\nDry-run: no se escribió nada. Usa --execute para aplicar."); process.exit(0); }

for (const c of cambios) await updateDoc(doc(db, "inventario", c.id), { precioMin: c.despues });
const ts = Date.now();
let i = 0;
for (const n of crear) {
  const id = `inv_cat2026_${ts}_${i++}`;
  await setDoc(doc(db, "inventario", id), {
    id, nombre: n.nombre, categoria: n.categoria, calibre: "", medida: "", color: "",
    unidad: n.unidad, origen: "importado", minimo: 0, precioMin: n.precioMin,
    stock: { "Centro": 0, "Santa Lucia": 0, "La Granja": 0 },
    mov: [{ ts, tipo: "alta", sede: "—", cant: 0, motivo: "Alta desde CATÁLOGO 2026", usuario: "Catálogo 2026" }],
    creadoPor: "Catálogo 2026", timestamp: ts,
  });
}
console.log(`\nListo: ${cambios.length} precios actualizados, ${crear.length} productos creados.`);
