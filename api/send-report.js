import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// api/send-report.js
export default async function handler(req, res) {
  const cronHeader = req.headers['x-vercel-cron'];
  const authHeader = req.headers['authorization'];
  if (!cronHeader && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    // Vercel cron corre en UTC: hay dos disparos (20:00 y 21:00 UTC) y solo envia el que
    // coincide con las 3 PM de America/Chicago (CST/CDT). Con ?force=1 + CRON_SECRET se envia ya.
    const forzar = req.query?.force === '1' && authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const horaChicago = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false }).format(new Date())) % 24;
    if (!forzar && horaChicago !== 15) return res.status(200).json({ skipped: true, horaChicago });

    // Cuenta de servicio (las reglas de Firestore exigen sesion @telefoxsas.com; el admin SDK las salta)
    if (!getApps().length) {
      initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    }
    const snap = await getFirestore().collection('orders').get();
    if (snap.empty) return res.status(200).json({ message: 'Sin ordenes' });
    const gv = v => v ?? '';
    const ms = v => v?.toDate ? v.toDate().getTime() : (typeof v === 'number' ? v : 0);
    const gt = v => ms(v) ? new Date(ms(v)).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : '';
    const orders = snap.docs.map(doc => {
      const f = doc.data();
      return { orden:gv(f.orden), cliente:gv(f.cliente), sede:gv(f.sede),
        vendedoraName:gv(f.vendedoraName), status:gv(f.status),
        ts:ms(f.timestamp), timestamp:gt(f.timestamp), completedAt:gt(f.completedAt),
        items:(f.items||[]).map(it => ({ producto:gv(it.producto), calibre:gv(it.calibre),
          calibreInterno:gv(it.calibreInterno), color:gv(it.color), ancho:gv(it.ancho),
          alto:gv(it.alto), metros:gv(it.metros), abertura:gv(it.abertura), grosor:gv(it.grosor),
          largo:gv(it.largo), cantidad:gv(it.cantidad), status:gv(it.status),
          machineLabel:gv(it.machineLabel) })) };
    });
    orders.sort((a,b) => b.ts - a.ts);
    const map = { eslabonada:'Malla Eslabonada', pvc:'Malla PVC', postes:'Postes', tubos:'Tubos' };
    const lp = id => map[id] || id;
    const st = { queue:'En Cola', active:'En Produccion', completed:'Completada' };
    const hdr = ['No.Orden','Cliente','Sede','Creado por','Estado','Creado','Completado',
      'Producto','Estado Item','Maquina','M2','Ancho','Alto','Abertura',
      'Calibre','Cal.Interno','Color','Grosor','Largo','Cantidad'];
    const rows = [];
    orders.forEach(o => {
      if (!o.items.length) {
        rows.push([o.orden,o.cliente,o.sede,o.vendedoraName,st[o.status]||o.status,
          o.timestamp,o.completedAt,'—','—','—','—','—','—','—','—','—','—','—','—','—']);
      } else {
        o.items.forEach((it,idx) => rows.push([
          idx===0?o.orden:'', idx===0?o.cliente:'', idx===0?o.sede:'',
          idx===0?o.vendedoraName:'', idx===0?(st[o.status]||o.status):'',
          idx===0?o.timestamp:'', idx===0?o.completedAt:'',
          lp(it.producto), st[it.status]||it.status||'—', it.machineLabel||'—',
          it.metros||'—', it.ancho||'—', it.alto||'—', it.abertura||'—',
          it.calibre||'—', it.calibreInterno||'—', it.color||'—',
          it.grosor||'—', it.largo||'—', it.cantidad||'—']));
      }
    });
    const csv = [hdr,...rows].map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
    const b64 = Buffer.from('\uFEFF'+csv,'utf8').toString('base64');
    const done = orders.filter(o=>o.status==='completed').length;
    const active = orders.filter(o=>o.status==='active').length;
    const queue = orders.filter(o=>o.status==='queue').length;
    const hoy = new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Fox Produccion <onboarding@resend.dev>',
        to: process.env.REPORT_EMAIL.split(',').map(e=>e.trim()),
        subject: `Reporte de Produccion Fox - ${hoy}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1a1a;padding:24px;border-radius:12px 12px 0 0;text-align:center"><h1 style="color:#fff;margin:0">Mallas y Alambres Fox</h1><p style="color:#f87171;margin:4px 0 0">Reporte Automatico de Produccion</p></div><div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0"><p>Buen dia, adjunto el reporte de ordenes al dia <strong>${hoy}</strong>.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center"><div style="font-size:28px;font-weight:900">${orders.length}</div><div style="color:#64748b;font-size:12px">Total ordenes</div></td><td style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center"><div style="font-size:28px;font-weight:900;color:#16a34a">${done}</div><div style="color:#64748b;font-size:12px">Completadas</div></td><td style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center"><div style="font-size:28px;font-weight:900;color:#E8262A">${active}</div><div style="color:#64748b;font-size:12px">En produccion</div></td><td style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center"><div style="font-size:28px;font-weight:900;color:#1d4ed8">${queue}</div><div style="color:#64748b;font-size:12px">En cola</div></td></tr></table><p style="color:#64748b;font-size:13px">El CSV adjunto contiene el detalle completo. Abralo con Excel.</p></div><div style="background:#1a1a1a;padding:16px;border-radius:0 0 12px 12px;text-align:center"><p style="color:#64748b;font-size:12px;margin:0">Mallas y Alambres Fox - Sistema de Gestion de Produccion - Bogota</p></div></div>`,
        attachments: [{ filename: `Fox_Ordenes_${new Date().toISOString().slice(0,10)}.csv`, content: b64 }]
      })
    });
    const r = await emailRes.json();
    return emailRes.ok
      ? res.status(200).json({ success:true, emailId:r.id, orders:orders.length })
      : res.status(500).json({ error:'Error Resend', detail:r });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
