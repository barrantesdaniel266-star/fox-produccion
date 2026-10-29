import React, { useState, useEffect } from "react";

// Pantalla de planta (sin login): /?tv=TOKEN. Solo lectura, se refresca sola.
const MAQUINAS = [
  { id:"C1", label:"C-1", sede:"Centro" }, { id:"C2", label:"C-2", sede:"Centro" },
  { id:"SL1", label:"SL-1", sede:"Santa Lucia" }, { id:"SL2", label:"SL-2", sede:"Santa Lucia" },
  { id:"SL3", label:"SL-3", sede:"Santa Lucia" }, { id:"SL4", label:"SL-4", sede:"Santa Lucia" },
  { id:"SL5", label:"SL-5", sede:"Santa Lucia" },
];
const PROD = { eslabonada:"Malla Eslabonada", pvc:"Malla PVC", postes:"Postes", tubos:"Tubos" };

const resumen = it => {
  const p = [];
  if (it.producto === "postes") {
    if (it.calibre) p.push(`Cal ${it.calibre}`);
    if (it.grosor) p.push(`${it.grosor}"`);
    if (it.largo) p.push(`${it.largo}m`);
    if (it.cantidad) p.push(`${it.cantidad} un`);
  } else {
    if (it.metros) p.push(`${it.metros}m²`);
    if (it.ancho && it.alto) p.push(`${it.ancho}×${it.alto}m`);
    if (it.abertura) p.push(`Ab ${it.abertura}`);
    if (it.calibre) p.push(`Cal ${it.calibre}`);
    if (it.calibreInterno) p.push(`CalInt ${it.calibreInterno}`);
    if (it.color) p.push(it.color);
  }
  return p.join(" · ");
};

export default function TvView({ token }) {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [hora, setHora] = useState(new Date());

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      try {
        const r = await fetch(`/api/tv?t=${encodeURIComponent(token)}`, { cache: "no-store" });
        if (r.status === 401) { if (vivo) setError("Enlace no válido"); return; }
        const d = await r.json();
        if (vivo && d.orders) { setOrders(d.orders); setError(""); }
      } catch { if (vivo) setError("Sin conexión, reintentando…"); }
    };
    cargar();
    const a = setInterval(cargar, 15000), b = setInterval(() => setHora(new Date()), 30000);
    return () => { vivo = false; clearInterval(a); clearInterval(b); };
  }, [token]);

  const items = orders.flatMap(o => (o.items.length ? o.items : [{ producto:"", status:o.status, machineId:o.machineId }])
    .map(it => ({ o, it: { ...it, status: it.status || o.status, machineId: it.machineId ?? o.machineId } })));
  const activos = items.filter(x => x.it.status === "active");
  const cola = items.filter(x => x.it.status === "queue").sort((a, b) => a.o.timestamp - b.o.timestamp);

  const caja = { background:"#262626", borderRadius:12, padding:16 };
  return (
    <div style={{ minHeight:"100vh", background:"#111", color:"#fff", fontFamily:"system-ui,sans-serif", padding:24 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h1 style={{ margin:0, fontSize:34 }}>Producción — <span style={{ color:"#E8262A" }}>Fox</span></h1>
        <div style={{ fontSize:22, color:"#a3a3a3" }}>
          {error && <span style={{ color:"#fbbf24", marginRight:16 }}>{error}</span>}
          {hora.toLocaleTimeString("es-CO", { hour:"2-digit", minute:"2-digit" })}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))", gap:16 }}>
        {MAQUINAS.map(m => {
          const l = activos.filter(x => x.it.machineId === m.id);
          return (
            <div key={m.id} style={{ ...caja, borderLeft:`6px solid ${l.length ? "#16a34a" : "#525252"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:24, fontWeight:800 }}>
                <span>{m.label}</span><span style={{ fontSize:16, color:"#a3a3a3", fontWeight:500 }}>{m.sede}</span>
              </div>
              {l.length === 0 && <div style={{ color:"#737373", marginTop:10, fontSize:20 }}>Libre</div>}
              {l.map((x, i) => (
                <div key={i} style={{ marginTop:10 }}>
                  <div style={{ fontSize:22, fontWeight:700 }}>#{x.o.orden} · {x.o.cliente}</div>
                  <div style={{ fontSize:18, color:"#d4d4d4" }}>{PROD[x.it.producto] || x.it.producto} {resumen(x.it)}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <h2 style={{ margin:"28px 0 12px", fontSize:26 }}>En cola ({cola.length})</h2>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))", gap:12 }}>
        {cola.map((x, i) => (
          <div key={i} style={{ ...caja, borderLeft:"6px solid #1d4ed8" }}>
            <div style={{ fontSize:20, fontWeight:700 }}>#{x.o.orden} · {x.o.cliente} <span style={{ color:"#a3a3a3", fontWeight:400, fontSize:15 }}>{x.o.sede}</span></div>
            <div style={{ fontSize:17, color:"#d4d4d4" }}>{PROD[x.it.producto] || x.it.producto} {resumen(x.it)}</div>
          </div>
        ))}
        {cola.length === 0 && <div style={{ color:"#737373", fontSize:20 }}>Sin órdenes en cola</div>}
      </div>
    </div>
  );
}
