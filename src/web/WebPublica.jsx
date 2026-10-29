import React, { useState, useEffect, useMemo } from "react";
import ChatCliente from "./ChatCliente.jsx";
import { CONFIG_DEFAULT } from "./configDefault.js";

const money = n => "$" + Number(n).toLocaleString("es-CO");
const DISP = {
  disponible:   { t:"Disponible",   c:"#16a34a", bg:"#dcfce7" },
  pocas:        { t:"Pocas unidades", c:"#b45309", bg:"#fef3c7" },
  bajo_pedido:  { t:"Bajo pedido",  c:"#475569", bg:"#e2e8f0" },
};

export default function WebPublica() {
  const [data, setData] = useState({ productos: [], config: {} });
  const [cargando, setCargando] = useState(true);
  const [cat, setCat] = useState("Todas");
  const [q, setQ] = useState("");
  const [carrito, setCarrito] = useState({});          // id -> cantidad
  const [verCarro, setVerCarro] = useState(false);
  const [chat, setChat] = useState(false);
  const [solicitud, setSolicitud] = useState(null);

  // Inventario y contenido en vivo (la CDN lo refresca cada ~10 s)
  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      try {
        const r = await fetch("/api/catalogo");
        const d = await r.json();
        if (vivo && d.productos) { setData(d); setCargando(false); }
      } catch { if (vivo) setCargando(false); }
    };
    cargar();
    const t = setInterval(cargar, 15000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  const cfg = { ...CONFIG_DEFAULT, ...data.config };
  const color = cfg.colorAcento || CONFIG_DEFAULT.colorAcento;
  useEffect(() => { document.title = cfg.titulo || "Mallas y Alambres Fox"; }, [cfg.titulo]);

  const categorias = useMemo(() => ["Todas", ...new Set(data.productos.map(p => p.categoria))], [data.productos]);
  const visibles = data.productos.filter(p =>
    (cat === "Todas" || p.categoria === cat) &&
    (!q.trim() || `${p.nombre} ${p.categoria} ${p.calibre} ${p.medida} ${p.color}`.toLowerCase().includes(q.trim().toLowerCase())));

  const lineas = data.productos.filter(p => carrito[p.id] > 0).map(p => ({ p, n: carrito[p.id] }));
  const total = lineas.reduce((s, { p, n }) => s + (p.precio ? p.precio * n : 0), 0);
  const sinPrecio = lineas.some(({ p }) => !p.precio);
  const cambiar = (id, d) => setCarrito(c => {
    const n = Math.max(0, Math.floor((c[id] || 0) + d));
    const x = { ...c }; if (n) x[id] = n; else delete x[id]; return x;
  });

  const pedirCotizacion = () => {
    const l = lineas.map(({ p, n }) => `• ${n} ${p.unidad} — ${p.nombre}${p.precio ? ` (${money(p.precio)}/${p.unidad})` : " (a cotizar)"}`).join("\n");
    const t = `Solicito cotización:\n${l}\n${total ? `Estimado referencial: ${money(total)}${sinPrecio ? " + ítems a cotizar" : ""}` : "Precios por confirmar"}`;
    setSolicitud({ n: Date.now(), texto: t });
    setVerCarro(false); setChat(true);
  };

  const wa = (cfg.whatsapp || "").replace(/\D/g, "");

  return (
    <div style={{ fontFamily:"Inter,-apple-system,'Segoe UI',sans-serif", color:"#0f172a", background:"#f8fafc", minHeight:"100vh" }}>
      <style>{`.fx-card{transition:transform .15s,box-shadow .15s}.fx-card:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.1)}@media(max-width:640px){.fx-hero h1{font-size:30px!important}}`}</style>

      {cfg.banner && <div style={{ background:color, color:"#fff", textAlign:"center", padding:"8px 16px", fontSize:14, fontWeight:600 }}>{cfg.banner}</div>}

      <header style={{ background:"#1a1a1a", color:"#fff", position:"sticky", top:0, zIndex:40 }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
          <div style={{ fontWeight:900, fontSize:20 }}>{cfg.titulo}</div>
          <nav style={{ display:"flex", gap:16, alignItems:"center", fontSize:15 }}>
            <a href="#catalogo" style={enlace}>Catálogo</a>
            <a href="#nosotros" style={enlace}>Nosotros</a>
            <a href="#contacto" style={enlace}>Contacto</a>
            <button onClick={() => setVerCarro(true)} style={{ background:color, color:"#fff", border:"none", borderRadius:999, padding:"8px 16px", fontWeight:700, cursor:"pointer" }}>
              Cotización{lineas.length ? ` (${lineas.length})` : ""}
            </button>
          </nav>
        </div>
      </header>

      <section className="fx-hero" style={{ background: cfg.imagenHero ? `linear-gradient(rgba(0,0,0,.6),rgba(0,0,0,.6)), url(${cfg.imagenHero}) center/cover` : "linear-gradient(135deg,#1a1a1a,#3b0d0d)", color:"#fff", padding:"72px 16px" }}>
        <div style={{ maxWidth:1200, margin:"0 auto" }}>
          <h1 style={{ fontSize:48, margin:0, fontWeight:900, maxWidth:760, lineHeight:1.1 }}>{cfg.heroTitulo}</h1>
          <p style={{ fontSize:19, maxWidth:620, color:"#e5e5e5", margin:"16px 0 28px" }}>{cfg.heroSubtitulo}</p>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
            <a href="#catalogo" style={{ background:color, color:"#fff", padding:"14px 24px", borderRadius:10, fontWeight:700, textDecoration:"none" }}>Ver catálogo</a>
            <button onClick={() => setChat(true)} style={{ background:"transparent", color:"#fff", border:"2px solid #fff", padding:"12px 24px", borderRadius:10, fontWeight:700, cursor:"pointer", fontSize:16 }}>Hablar con una asesora</button>
          </div>
        </div>
      </section>

      <section id="catalogo" style={{ maxWidth:1200, margin:"0 auto", padding:"48px 16px" }}>
        <h2 style={{ fontSize:30, margin:"0 0 4px" }}>Catálogo</h2>
        <p style={{ color:"#64748b", margin:"0 0 20px" }}>Disponibilidad actualizada en tiempo real. Agrega productos y pide tu cotización.</p>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:20 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar producto, calibre, medida…" style={{ flex:"1 1 240px", border:"1px solid #cbd5e1", borderRadius:10, padding:"10px 14px", fontSize:15 }} />
          <select value={cat} onChange={e => setCat(e.target.value)} style={{ border:"1px solid #cbd5e1", borderRadius:10, padding:"10px 14px", fontSize:15, background:"#fff" }}>
            {categorias.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        {cargando && <div style={{ color:"#64748b" }}>Cargando catálogo…</div>}
        {!cargando && visibles.length === 0 && <div style={{ color:"#64748b" }}>No hay productos para mostrar. Escríbenos y te cotizamos a la medida.</div>}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))", gap:16 }}>
          {visibles.map(p => {
            const d = DISP[p.disponibilidad] || DISP.bajo_pedido;
            return (
              <div key={p.id} className="fx-card" style={{ background:"#fff", borderRadius:14, overflow:"hidden", border:"1px solid #e2e8f0", display:"flex", flexDirection:"column" }}>
                {p.imagen && <img src={p.imagen} alt={p.nombre} loading="lazy" style={{ width:"100%", height:150, objectFit:"cover" }} />}
                <div style={{ padding:14, display:"flex", flexDirection:"column", gap:6, flex:1 }}>
                  <div style={{ fontSize:12, color:color, fontWeight:700 }}>{p.categoria}</div>
                  <div style={{ fontWeight:800, fontSize:16 }}>{p.nombre}</div>
                  <div style={{ fontSize:13, color:"#64748b" }}>{[p.calibre && `Cal ${p.calibre}`, p.medida, p.color].filter(Boolean).join(" · ")}</div>
                  <span style={{ alignSelf:"flex-start", background:d.bg, color:d.c, fontSize:12, fontWeight:700, borderRadius:999, padding:"3px 10px" }}>{d.t}</span>
                  <div style={{ marginTop:"auto", paddingTop:8, fontWeight:900, fontSize:18 }}>{p.precio ? <>{money(p.precio)} <span style={{ fontSize:12, color:"#64748b", fontWeight:500 }}>/ {p.unidad}</span></> : <span style={{ fontSize:14, color:"#64748b" }}>Precio por cotización</span>}</div>
                  <button onClick={() => { cambiar(p.id, 1); }} style={{ background:"#1a1a1a", color:"#fff", border:"none", borderRadius:10, padding:10, fontWeight:700, cursor:"pointer" }}>
                    {carrito[p.id] ? `En cotización (${carrito[p.id]}) · +1` : "Agregar a cotización"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="nosotros" style={{ background:"#fff", padding:"48px 16px" }}>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          <h2 style={{ fontSize:30, margin:"0 0 12px" }}>Nosotros</h2>
          <p style={{ fontSize:17, lineHeight:1.7, color:"#334155", whiteSpace:"pre-wrap" }}>{cfg.nosotros}</p>
        </div>
      </section>

      <section id="contacto" style={{ background:"#1a1a1a", color:"#fff", padding:"48px 16px" }}>
        <div style={{ maxWidth:1200, margin:"0 auto" }}>
          <h2 style={{ fontSize:30, margin:"0 0 16px" }}>Contacto</h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:20 }}>
            {(cfg.sedes || []).map((s, i) => (
              <div key={i}><div style={{ fontWeight:800, color:"#f87171" }}>{s.nombre}</div><div style={{ color:"#d4d4d4", lineHeight:1.6 }}>{s.direccion}<br />{s.telefono}</div></div>
            ))}
            {wa && <div><div style={{ fontWeight:800, color:"#f87171" }}>WhatsApp</div><a href={`https://wa.me/${wa}`} style={{ color:"#fff" }}>Escríbenos por WhatsApp</a></div>}
          </div>
          <div style={{ marginTop:28, color:"#737373", fontSize:13 }}>© {new Date().getFullYear()} {cfg.titulo}</div>
        </div>
      </section>

      {verCarro && (
        <div onClick={() => setVerCarro(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:70, display:"flex", justifyContent:"flex-end" }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#fff", width:"min(440px,100vw)", height:"100%", padding:20, overflowY:"auto", display:"flex", flexDirection:"column" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <h3 style={{ margin:0, fontSize:22 }}>Tu cotización</h3>
              <button onClick={() => setVerCarro(false)} style={{ background:"none", border:"none", fontSize:26, cursor:"pointer" }}>×</button>
            </div>
            {lineas.length === 0 && <p style={{ color:"#64748b" }}>Aún no agregas productos.</p>}
            {lineas.map(({ p, n }) => (
              <div key={p.id} style={{ borderBottom:"1px solid #e2e8f0", padding:"12px 0" }}>
                <div style={{ fontWeight:700 }}>{p.nombre}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6 }}>
                  <button onClick={() => cambiar(p.id, -1)} style={mini}>−</button>
                  <input value={n} onChange={e => setCarrito(c => ({ ...c, [p.id]: Math.max(0, parseInt(e.target.value) || 0) }))} inputMode="numeric" style={{ width:64, textAlign:"center", border:"1px solid #cbd5e1", borderRadius:8, padding:6 }} />
                  <button onClick={() => cambiar(p.id, 1)} style={mini}>+</button>
                  <span style={{ color:"#64748b", fontSize:13 }}>{p.unidad}</span>
                  <span style={{ marginLeft:"auto", fontWeight:700 }}>{p.precio ? money(p.precio * n) : "A cotizar"}</span>
                </div>
              </div>
            ))}
            {lineas.length > 0 && (
              <>
                <div style={{ display:"flex", justifyContent:"space-between", fontWeight:900, fontSize:20, margin:"16px 0 4px" }}><span>Estimado</span><span>{total ? money(total) : "—"}</span></div>
                <p style={{ fontSize:12, color:"#64748b", margin:"0 0 16px" }}>Valor referencial con IVA incluido{sinPrecio ? ", sin los ítems por cotizar" : ""}. Una asesora confirma precio final, existencias y despacho.</p>
                <button onClick={pedirCotizacion} style={{ background:color, color:"#fff", border:"none", borderRadius:10, padding:14, fontWeight:800, fontSize:16, cursor:"pointer" }}>Enviar a una asesora</button>
              </>
            )}
          </div>
        </div>
      )}

      <ChatCliente abierto={chat} setAbierto={setChat} solicitud={solicitud} color={color} />
    </div>
  );
}

const enlace = { color:"#e5e5e5", textDecoration:"none" };
const mini = { width:32, height:32, border:"1px solid #cbd5e1", background:"#f8fafc", borderRadius:8, fontSize:18, cursor:"pointer" };
