// Script de un solo uso: asigna el stock "sin asignar" de los productos CABLE
// (importados del Excel) a la sede Centro.
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, doc, updateDoc, deleteField } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.local.mjs";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const q = query(collection(db, "inventario"), where("pendienteAsignarSede", "==", true));
const snap = await getDocs(q);

console.log(`Productos pendientes de asignar: ${snap.size}`);

let i = 0;
for (const d of snap.docs) {
  const p = d.data();
  const cantidad = Number(p.stockSinAsignar) || 0;
  await updateDoc(doc(db, "inventario", d.id), {
    stock: { "Centro": cantidad, "Santa Lucia": 0, "La Granja": 0 },
    stockSinAsignar: deleteField(),
    pendienteAsignarSede: deleteField(),
  });
  i++;
  console.log(`  ${p.nombre}: ${cantidad} -> Centro`);
}
console.log(`\nListo. ${i} productos actualizados.`);
