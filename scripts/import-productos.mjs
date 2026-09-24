// Script de un solo uso: importa data/productos.xlsx al inventario de Firestore.
// Uso:
//   node scripts/import-productos.mjs           -> dry-run (no escribe nada)
//   node scripts/import-productos.mjs --execute -> escribe en Firestore

import XLSXPkg from "xlsx";
const XLSX = XLSXPkg.default || XLSXPkg;
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.local.mjs";

const EXECUTE = process.argv.includes("--execute");

// Categoría/unidad ya curadas a mano en el catálogo previo del código (App.jsx).
// Se reutilizan como fuente de verdad para nombre -> {categoria, unidad}.
const CATALOGO_PREVIO = [{n:"ALAMBRE CAL 11",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 12,5 OSCURO",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 12,5",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 12,5 ORIGINAL",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 14",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 11 PVC AZUL",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 11 PVC AMARILLO",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 11 PVC NARANJA",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 11 PVC ROJO",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 11 PVC AGUA MARINA",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 11 PVC NEGRO",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 11 PVC VERDE IMPORTADO MILITAR",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 11 PVC VERDE IMPORTADO CLARO",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 11 PVC NEGRO IMPORTADO",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 8 PVC VERDE MILITAR",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 8 PVC VERDE IMPORTADO CLARO",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 8 PVC VERDE IMPORTADO MILITAR",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 8 PVC ROJO",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 8 PVC AMARILLO",u:"kg",c:"Alambre"},{n:"ALAMBRE CAL 8 PVC VERDE OSCURO",u:"kg",c:"Alambre"},{n:"MALLA ESLABONADA CAL 10,5 H 2\"1/2 *1",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 10,5 H 2\"1/2 *1.20",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 10,5 H 2\"1/2 *1.50",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 10,5 H 2\"1/2 *1.80",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 10,5 H 2\"1/2 *1.95",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 10,5 H 2\"1/2 *1.98",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 10,5 H 2\"1/2 *2",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 10,5 H 2\"1/2 * 2.45",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 10,5 H 2\"1/2 * 2.50",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 10,5 H 2\"1/4 * 2",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 10,5 H 2\" * 1.20",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 10,5 H 2\" * 1.50",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 10,5 H 2\" * 1.80",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 10,5 H 2\" * 2",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 10,5 H 2\" * 2.50",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 12,5 H 2\"1/2 * 1",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 12,5 H 2\"1/2 * 1.20",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 12,5 H 2\"1/2 * 1.50",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 12,5 H 2\"1/2 * 1.80",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 12,5 H 2\"1/2 * 1.80 OSCURO",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 12,5 H 2\"1/2 * 2",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 12,5 H 2\"1/2 * 2 OSCURO",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 12,5 H 2\"1/2 * 2.60",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 12,5 H 2\"1/4 * 1",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 12,5 H 2\"1/4 * 1.80",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 12,5 H 2\"1/4 * 2",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 12,5 H 2\" * 1.50",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 12,5 H 2\" * 1.80",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 12,5 H 2\" * 1.80 OSCURO",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 12,5 H 2\" * 2",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 14 H 2\"1/2 * 1",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 14 H 2\"1/2 * 1.20",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 14 H 2\"1/2 * 1.30",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 14 H 2\"1/2 * 1.50",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 14 H 2\"1/2 * 1.80",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 14 H 2\"1/2 * 2",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 14 H 2\"1/4 * 1.50",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 14 H 2\"1/4 * 1.80",u:"m²",c:"Malla Eslabonada"},{n:"MALLA ESLABONADA CAL 14 H 2\" * 1.80",u:"m²",c:"Malla Eslabonada"},{n:"MALLA IMPORTADA CAL 10,5 H 2\"1/2 * 1.80",u:"m²",c:"Malla Eslabonada"},{n:"MALLA IMPORTADA CAL 10,5 H 2\"1/2 * 2",u:"m²",c:"Malla Eslabonada"},{n:"MALLA IMPORTADA CAL 10,5 H 2\"1/2 * 1.50",u:"m²",c:"Malla Eslabonada"},{n:"MALLA IMPORTADA CAL 12,5 H 2\"1/2 * 1.50",u:"m²",c:"Malla Eslabonada"},{n:"MALLA IMPORTADA CAL 12,5 H 2\"1/2 * 1.80",u:"m²",c:"Malla Eslabonada"},{n:"MALLA IMPORTADA CAL 12,5 H 2\"1/2 * 2",u:"m²",c:"Malla Eslabonada"},{n:"MALLA MAQUINADA CAL 10,5 H 2\"1/2 * 1.50",u:"m²",c:"Malla Eslabonada"},{n:"MALLA MAQUINADA CAL 10,5 H 2\"1/2 * 2",u:"m²",c:"Malla Eslabonada"},{n:"MALLA CESPED CAL 16 H 1\"1/2",u:"m²",c:"Malla"},{n:"GUAYA 1/8",u:"m²",c:"Accesorios"},{n:"VARILLA 1/2 * 60cm",u:"unidades",c:"Accesorios"},{n:"PERRO 1/8",u:"unidades",c:"Accesorios"},{n:"TENSOR 3/16",u:"unidades",c:"Accesorios"},{n:"CONCERTINA ACERO INOXIDABLE *6MTS",u:"unidades",c:"Concertina"},{n:"CONCERTINA GALVANIZADA *6MTS",u:"unidades",c:"Concertina"},{n:"ALAMBRE DE PUAS CAL 12,5 * 200 MTS",u:"unidades",c:"Alambre de Púas"},{n:"ALAMBRE DE PUAS CAL 12,5 * 400 MTS",u:"unidades",c:"Alambre de Púas"},{n:"ALAMBRE DE PUAS CAL 14,5 * 500 MTS",u:"unidades",c:"Alambre de Púas"},{n:"ALAMBRE DE PUAS CAL 14,5 * 200 MTS",u:"unidades",c:"Alambre de Púas"},{n:"ALAMBRE DE PUAS CAL 14,5 * 100 MTS",u:"unidades",c:"Alambre de Púas"},{n:"ALAMBRE DE PUAS CAL 16,5 * 400 MTS",u:"unidades",c:"Alambre de Púas"},{n:"ALAMBRE DE PUAS CAL 16,5 * 200 MTS",u:"unidades",c:"Alambre de Púas"},{n:"MALLA GALLINERO *36MTS H 1\"1/4 * 0.90",u:"unidades",c:"Malla"},{n:"MALLA GALLINERO *36MTS H 1\"1/4 * 1.20",u:"unidades",c:"Malla"},{n:"MALLA GALLINERO *36MTS H 1\"1/4 * 1.50",u:"unidades",c:"Malla"},{n:"MALLA GALLINERO *36MTS H 1\"1/4 * 1.80",u:"unidades",c:"Malla"},{n:"MALLA GALLINERO *30 MTS H 2\" * 1,65",u:"unidades",c:"Malla"},{n:"MALLA PAJARITO *30MTS H 3/4\" * 0.90",u:"unidades",c:"Malla"},{n:"MALLA PAJARITO *30MTS H 3/4\" * 1",u:"unidades",c:"Malla"},{n:"MALLA PAJARITO *30MTS H 3/4\" * 1.50",u:"unidades",c:"Malla"},{n:"MALLA PAJARITO *30MTS H 3/4\" * 1.80",u:"unidades",c:"Malla"},{n:"MALLA PAJARITO *30 MTS H 1/2\" * 0.90",u:"unidades",c:"Malla"},{n:"MALLA PAJARITO *30 MTS H 1/2\" * 1",u:"unidades",c:"Malla"},{n:"GAVION MANUAL CAL 12.5 H 10*10",u:"unidades",c:"Gaviones"},{n:"GAVION MANUAL CAL 12.5 H 12*12",u:"unidades",c:"Gaviones"},{n:"GAVION MAQUINADO CAL 13 H 10*10",u:"unidades",c:"Gaviones"},{n:"GAVION MAQUINADO CAL 12.5 H 10*10",u:"unidades",c:"Gaviones"},{n:"GAVIONES MAQUINADO CAL 12.5 H 12*12",u:"unidades",c:"Gaviones"},{n:"GAVIONES MAQUINADO CAL 11 H 10*10",u:"unidades",c:"Gaviones"},{n:"GAVION MAQUINADO CON CAL 12.5 H 10*10",u:"unidades",c:"Gaviones"},{n:"GAVION MAQUINADO CON CAL 12.5 H 12*12",u:"unidades",c:"Gaviones"},{n:"POSTE TERMINADO CAL 18 EN 2\"",u:"unidades",c:"Postes"},{n:"POSTE TERMINADO CAL 18 EN 1\"1/2",u:"unidades",c:"Postes"},{n:"POSTE TERMINADO CAL 16 EN 2\"",u:"unidades",c:"Postes"},{n:"POSTE TERMINADO CAL 16 EN 1\"1/2",u:"unidades",c:"Postes"},{n:"POSTE TERMINADO CAL 14 EN 2\"",u:"unidades",c:"Postes"},{n:"TUBO GALVANIZADO CAL 14 EN 2\" * 6 MTS",u:"unidades",c:"Tubos"},{n:"TUBO GALVANIZADO CAL 14 EN 1\"1/2 * 6 MTS",u:"unidades",c:"Tubos"},{n:"TUBO GALVANIZADO IMPORTADO CAL 18 EN 2\" * 6 MTS",u:"unidades",c:"Tubos"},{n:"TUBO GALVANIZADO IMPORTADO CAL 18 EN 1\"1/2 * 6 MTS",u:"unidades",c:"Tubos"},{n:"TUBO GALVANIZADO IMPORTADO CAL 16 EN 2\" * 6 MTS",u:"unidades",c:"Tubos"},{n:"TUBO GALVANIZADO IMPORTADO CAL 16 EN 1\"1/2 * 6 MTS",u:"unidades",c:"Tubos"},{n:"TUBO GALVANIZADO IMPORTADO CAL 14 EN 2\" * 6 MTS",u:"unidades",c:"Tubos"},{n:"TUBO GALVANIZADO IMPORTADO CAL 14 EN 1\"1/2 * 6 MTS",u:"unidades",c:"Tubos"},{n:"TUBO GALVANIZADO IMPORTADO CAL 18 EN 2\" * 3 MTS",u:"unidades",c:"Tubos"},{n:"TUBO GALVANIZADO IMPORTADO CAL 18 EN 1\"1/2 * 3 MTS",u:"unidades",c:"Tubos"},{n:"TAPON 2\"",u:"unidades",c:"Accesorios"},{n:"TAPON 1\"1/2",u:"unidades",c:"Accesorios"},{n:"GRAPA",u:"unidades",c:"Accesorios"},{n:"PLATINA 1/2*1/8 * 6 MTS",u:"unidades",c:"Accesorios"},{n:"ANGULO 1*1/8 * 6 MTS",u:"unidades",c:"Accesorios"}];

const catalogoMap = new Map(CATALOGO_PREVIO.map(p => [normName(p.n), p]));

function normName(s) {
  return String(s || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function inferCategoria(nombre) {
  const n = normName(nombre);
  if (n.startsWith("ALAMBRE DE PUAS")) return "Alambre de Púas";
  if (n.startsWith("ALAMBRE")) return "Alambre";
  if (n.startsWith("MALLA ESLABONADA") || n.startsWith("MALLA IMPORTADA") || n.startsWith("MALLA MAQUINADA")) return "Malla Eslabonada";
  if (n.startsWith("MALLA")) return "Malla";
  if (n.startsWith("GAVION")) return "Gaviones";
  if (n.startsWith("CONCERTINA")) return "Concertina";
  if (n.startsWith("POSTE")) return "Postes";
  if (n.startsWith("TUBO")) return "Tubos";
  if (["GUAYA","VARILLA","PERRO","TENSOR","TAPON","GRAPA","PLATINA","ANGULO"].some(p => n.startsWith(p))) return "Accesorios";
  return "Otro";
}

function normUnidad(raw) {
  const u = String(raw || "").trim().toUpperCase();
  if (u === "KILOS") return "kg";
  if (u === "MTS") return "metros";
  if (u === "UNIDAD") return "unidades";
  return "unidades";
}

function unidadAbrev(raw) {
  const u = String(raw || "").trim().toUpperCase();
  if (u === "KILOS") return "kg";
  if (u === "MTS") return "m";
  return "";
}

// ── 1. Leer Excel ────────────────────────────────────────────
const wb = XLSX.readFile("data/productos.xlsx");

function leerHoja(nombre, filaInicioDatos) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, defval: null });
  return rows.slice(filaInicioDatos).filter(r => r[0] != null);
}

const filasGeneral = leerHoja("INVENTARIO GENERAL", 3); // [n, item, unidad, presentacion, santaLucia, centro, total]
const filasCable = leerHoja("CABLE", 2); // [n, producto, unidad, presentacion, ...transacciones..., totalEntradas, totalSalidas, total]
const cableHeaderLen = XLSX.utils.sheet_to_json(wb.Sheets["CABLE"], { header: 1, defval: null })[0].length;
const cableTotalIdx = cableHeaderLen - 1;

// ── 2. Detectar duplicados de nombre dentro de cada hoja ─────
function contarNombres(filas, idxNombre) {
  const conteo = new Map();
  filas.forEach(r => {
    const key = normName(r[idxNombre]);
    conteo.set(key, (conteo.get(key) || 0) + 1);
  });
  return conteo;
}
const conteoGeneral = contarNombres(filasGeneral, 1);
const conteoCable = contarNombres(filasCable, 1);

// ── 3. Construir productos INVENTARIO GENERAL ─────────────────
const negativosLog = [];
const productosGeneral = filasGeneral.map(r => {
  const [n, itemRaw, unidadRaw, presentacion, slRaw, ceRaw] = r;
  let sl = Number(slRaw) || 0;
  let ce = Number(ceRaw) || 0;
  const nombreBase = String(itemRaw).trim().replace(/\s+/g, " ");
  if (sl < 0) { negativosLog.push({ hoja: "INVENTARIO GENERAL", n, nombre: nombreBase, sede: "Santa Lucia", valor: sl }); sl = 0; }
  if (ce < 0) { negativosLog.push({ hoja: "INVENTARIO GENERAL", n, nombre: nombreBase, sede: "Centro", valor: ce }); ce = 0; }

  const esDuplicado = conteoGeneral.get(normName(nombreBase)) > 1;
  const nombreFinal = esDuplicado && presentacion != null
    ? `${nombreBase} (${presentacion} ${unidadAbrev(unidadRaw)})`.trim()
    : nombreBase;

  const enCatalogo = catalogoMap.get(normName(nombreBase));
  const categoria = enCatalogo?.c || inferCategoria(nombreBase);
  const unidad = enCatalogo?.u || normUnidad(unidadRaw);

  return {
    id: `inv_xls_general_${n}`,
    nombre: nombreFinal,
    categoria, calibre: "", medida: "", color: "",
    unidad, origen: "importado", importadoExcel: true,
    minimo: 0, precioMin: "",
    stock: { "Centro": ce, "Santa Lucia": sl, "La Granja": 0 },
    presentacionOriginal: presentacion ?? "",
    mov: [{ ts: Date.now(), tipo: "alta", sede: "—", cant: 0, motivo: "Importado de Excel (INVENTARIO GENERAL)", usuario: "Import Excel" }],
    creadoPor: "Import Excel", timestamp: Date.now(),
  };
});

// ── 4. Construir productos CABLE (sin desglose por sede) ──────
const productosCable = filasCable.map(r => {
  const [n, itemRaw, unidadRaw, presentacion] = r;
  const total = Number(r[cableTotalIdx]) || 0;
  const nombreBase = String(itemRaw).trim().replace(/\s+/g, " ");
  const esDuplicado = conteoCable.get(normName(nombreBase)) > 1;
  const nombreFinal = esDuplicado && presentacion != null
    ? `${nombreBase} (${presentacion} ${unidadAbrev(unidadRaw)})`.trim()
    : nombreBase;

  return {
    id: `inv_xls_cable_${n}`,
    nombre: nombreFinal,
    categoria: "Cable", calibre: "", medida: "", color: "",
    unidad: normUnidad(unidadRaw), origen: "importado", importadoExcel: true,
    minimo: 0, precioMin: "",
    stock: { "Centro": null, "Santa Lucia": null, "La Granja": null },
    stockSinAsignar: total,
    pendienteAsignarSede: true,
    presentacionOriginal: presentacion ?? "",
    mov: [{ ts: Date.now(), tipo: "alta", sede: "—", cant: 0, motivo: "Importado de Excel (CABLE) — pendiente asignar sede", usuario: "Import Excel" }],
    creadoPor: "Import Excel", timestamp: Date.now(),
  };
});

const todos = [...productosGeneral, ...productosCable];

// ── 5. Resumen ─────────────────────────────────────────────────
console.log(`\n=== RESUMEN IMPORT (${EXECUTE ? "EJECUCIÓN REAL" : "DRY-RUN"}) ===`);
console.log(`INVENTARIO GENERAL: ${productosGeneral.length} productos`);
console.log(`CABLE: ${productosCable.length} productos (stock sin asignar sede)`);
console.log(`TOTAL: ${todos.length} productos\n`);

console.log(`Renombrados por duplicado (${todos.filter(p => p.nombre.includes("(") && p.presentacionOriginal !== "").length} candidatos, ver lista):`);
[...productosGeneral, ...productosCable].forEach(p => {
  if (/\([\d.,]+ (kg|m)\)$/.test(p.nombre)) console.log(`  - ${p.nombre}`);
});

console.log(`\nStock negativo corregido a 0 (${negativosLog.length}):`);
negativosLog.forEach(x => console.log(`  - #${x.n} "${x.nombre}" sede ${x.sede}: ${x.valor} -> 0`));

const categCounts = {};
todos.forEach(p => { categCounts[p.categoria] = (categCounts[p.categoria] || 0) + 1; });
console.log(`\nPor categoría:`);
Object.entries(categCounts).forEach(([c, n]) => console.log(`  ${c}: ${n}`));

// ── 6. Escribir a Firestore (si --execute) ─────────────────────
if (!EXECUTE) {
  console.log("\nDry-run: no se escribió nada. Corre con --execute para importar de verdad.");
  process.exit(0);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const existentesSnap = await getDocs(collection(db, "inventario"));
const existentesNombres = new Set(existentesSnap.docs.map(d => normName(d.data().nombre)));

const nuevos = todos.filter(p => !existentesNombres.has(normName(p.nombre)));
console.log(`\nYa existen en Firestore (se omiten): ${todos.length - nuevos.length}`);
console.log(`Se van a crear: ${nuevos.length}`);

let i = 0;
for (const p of nuevos) {
  await setDoc(doc(db, "inventario", p.id), p);
  i++;
  if (i % 20 === 0) console.log(`  ...${i}/${nuevos.length}`);
}
console.log(`\nListo. ${i} productos creados en Firestore.`);
