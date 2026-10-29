// api/tv.js — datos de solo lectura para la pantalla de planta (sin login).
// Acceso por token secreto (variable TV_TOKEN en Vercel). Usa la cuenta de servicio
// (las reglas de Firestore siguen cerradas) y devuelve SOLO la cola de producción,
// sin precios, teléfonos ni datos de facturación.
import { timingSafeEqual } from 'node:crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const igual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const esperado = process.env.TV_TOKEN;
  const t = req.query?.t;
  if (!esperado || !t || !igual(t, esperado)) return res.status(401).json({ error: 'No autorizado' });
  try {
    if (!getApps().length) {
      initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    }
    const col = getFirestore().collection('orders');
    const [snap, hechas] = await Promise.all([
      col.where('status', 'in', ['queue', 'active']).get(),
      col.where('status', '==', 'completed').count().get(),
    ]);
    const orders = snap.docs.map(d => {
      const o = d.data();
      return {
        orden: o.orden ?? '', cliente: o.cliente ?? '', sede: o.sede ?? '', remision: o.remision ?? '',
        vendedoraName: o.vendedoraName ?? '', estadoEntrega: o.estadoEntrega ?? null, assignedAt: o.assignedAt ?? null,
        status: o.status, timestamp: typeof o.timestamp === 'number' ? o.timestamp : 0,
        machineId: o.machineId ?? null, machineLabel: o.machineLabel ?? null,
        items: (o.items || []).map(it => ({
          producto: it.producto ?? '', status: it.status ?? null, assignedAt: it.assignedAt ?? null,
          machineId: it.machineId ?? null, machineLabel: it.machineLabel ?? null,
          metros: it.metros ?? '', ancho: it.ancho ?? '', alto: it.alto ?? '',
          abertura: it.abertura ?? '', calibre: it.calibre ?? '', calibreInterno: it.calibreInterno ?? '',
          color: it.color ?? '', grosor: it.grosor ?? '', largo: it.largo ?? '', cantidad: it.cantidad ?? '',
        })),
      };
    });
    return res.status(200).json({ orders, completadas: hechas.data().count, actualizado: Date.now() });
  } catch (err) {
    return res.status(500).json({ error: 'Error leyendo datos' });
  }
}
