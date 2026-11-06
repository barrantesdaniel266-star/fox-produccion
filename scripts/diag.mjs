// scripts/diag.mjs — diagnóstico de SOLO LECTURA para Fase 3 (catálogo y chat web).
// Uso: node scripts/diag.mjs "C:/ruta/cuenta-de-servicio.json"
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const ruta = process.argv[2];
if (!ruta) { console.error('Falta la ruta del JSON de la cuenta de servicio.'); process.exit(1); }
initializeApp({ credential: cert(JSON.parse(fs.readFileSync(ruta, 'utf8'))) });
const db = getFirestore();

const inv = await db.collection('inventario').get();
console.log('inventario total:', inv.size);
console.log('publicados en web (publicarWeb=true):', inv.docs.filter(d => d.data().publicarWeb === true).length);
console.log('sitio/config existe:', (await db.doc('sitio/config').get()).exists);
console.log('conversaciones:', (await db.collection('conversaciones').get()).size);
console.log('mensajes:', (await db.collection('mensajes').get()).size);
