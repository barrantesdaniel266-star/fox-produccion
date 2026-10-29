// api/catalogo.js — catálogo público + contenido editable del sitio (mallasfox.com).
// Lee Firestore con la cuenta de servicio y devuelve SOLO campos seguros: nunca costo,
// precioMin ni cantidades exactas de stock (solo disponible / pocas / bajo pedido).
// La CDN de Vercel lo cachea unos segundos, así que muchos visitantes = pocas lecturas.
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
  try {
    if (!getApps().length) {
      initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    }
    const db = getFirestore();
    const [inv, cfg] = await Promise.all([
      db.collection('inventario').where('publicarWeb', '==', true).get(),
      db.doc('sitio/config').get(),
    ]);
    const productos = inv.docs.map(d => {
      const p = d.data();
      const total = Object.values(p.stock || {}).reduce((a, b) => a + (Number(b) || 0), 0);
      const minimo = Number(p.minimo) || 0;
      const precio = p.precioWeb === '' || p.precioWeb == null ? null : Number(p.precioWeb);
      return {
        id: d.id, nombre: p.nombre || '', categoria: p.categoria || 'Otro',
        calibre: p.calibre || '', medida: p.medida || '', color: p.color || '', unidad: p.unidad || '',
        imagen: p.imagenWeb || '', precio: Number.isFinite(precio) && precio > 0 ? precio : null,
        disponibilidad: total <= 0 ? 'bajo_pedido' : (minimo > 0 && total <= minimo ? 'pocas' : 'disponible'),
      };
    }).sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre));
    return res.status(200).json({ productos, config: cfg.exists ? cfg.data() : {}, actualizado: Date.now() });
  } catch (err) {
    return res.status(500).json({ error: 'Error leyendo catálogo' });
  }
}
