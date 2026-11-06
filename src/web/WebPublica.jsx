import React, { useState, useEffect, useMemo, useRef } from "react";
import ChatCliente from "./ChatCliente.jsx";
import { CONFIG_DEFAULT } from "./configDefault.js";
import { money, telefonosWa, waLink, mapaEmbed, mapaRuta, fotoCategoria, DISP } from "./webUtils.js";
import "./web.css";

const ROJO = "#E13E30";
const CATS_BASE = [
  { n: "Malla eslabonada", f: "/web/img/rollos.jpg" },
  { n: "Malla PVC", f: "/web/img/hero-rollos.jpg" },
  { n: "Postes y tubería", f: "/web/img/tubos.jpg" },
  { n: "Alambres", f: "/web/img/malla.jpg" },
];

// Íconos de línea (sin dependencias)
const Ico = ({ d, size = 22, sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {[].concat(d).map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const I = {
  fab: "M3 21V9l6 4V9l6 4V5h3v16H3z",
  pin: ["M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z", "M12 7.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"],
  box: ["M3 7l9-4 9 4v10l-9 4-9-4V7z", "M3 7l9 4 9-4M12 11v10"],
  chat: "M4 5h16v11H9l-5 4V5z",
  tel: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z",
  ok: "M5 12l4 4 10-10",
  arrow: "M5 12h14M13 6l6 6-6 6",
  wa: ["M3 21l1.6-4.6A8.5 8.5 0 1112 20.5a8.4 8.4 0 01-4-1L3 21z", "M9 8.5c.5 3 2.5 5 5.5 6l1.2-1.4-1.9-1-.8.7a4 4 0 01-1.7-1.7l.7-.8-1-1.9L9 8.5z"],
};

export default function WebPublica() {
  const [data, setData] = useState({ productos: [], config: {} });
  const [cargando, setCargando] = useState(true);
  const [errCat, setErrCat] = useState("");
  const [cat, setCat] = useState("Todas");
  const [q, setQ] = useState("");
  const [calibre, setCalibre] = useState("");
  const [soloDisp, setSoloDisp] = useState(false);
  const [orden, setOrden] = useState("nombre");
  const [limite, setLimite] = useState(24);
  const [prod, setProd] = useState(null);
  const [carrito, setCarrito] = useState({});
  const [verCarro, setVerCarro] = useState(false);
  const [chat, setChat] = useState(false);
  const [solicitud, setSolicitud] = useState(null);
  const [menu, setMenu] = useState(false);
  const raiz = useRef(null);

  // Tipografías de marca (Archivo para títulos, Inter para texto)
  useEffect(() => {
    if (document.getElementById("fx-fonts")) return;
    const l = document.createElement("link");
    l.id = "fx-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
  }, []);

  // Inventario y contenido en vivo (la CDN lo refresca cada ~10 s)
  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      try {
        const r = await fetch("/api/catalogo");
        const d = await r.json().catch(() => ({}));
        if (!vivo) return;
        if (r.ok && d.productos) { setData(d); setErrCat(""); }
        else setErrCat("No pudimos cargar el catálogo en este momento. Escríbenos y te cotizamos.");
        setCargando(false);
      } catch { if (vivo) { setErrCat("Sin conexión con el catálogo. Escríbenos y te cotizamos."); setCargando(false); } }
    };
    cargar();
    const t = setInterval(cargar, 30000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  const cfg = { ...CONFIG_DEFAULT, ...data.config };
  const sedes = (cfg.sedes && cfg.sedes.length ? cfg.sedes : CONFIG_DEFAULT.sedes);
  const waNum = (cfg.whatsapp || "").replace(/\D/g, "") || telefonosWa(sedes[0]?.telefono)[0] || "";
  const waTxt = "Hola, quiero cotizar con Mallas y Alambres Fox.";

  // SEO básico + datos estructurados
  useEffect(() => {
    document.title = `${cfg.titulo} | Fabricantes de malla eslabonada, PVC, postes y alambres en Bogotá`;
    const desc = "Fabricamos y distribuimos malla eslabonada, malla PVC, postes, tubería y alambres en Bogotá. Inventario en tiempo real y cotización inmediata.";
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement("meta"); m.name = "description"; document.head.appendChild(m); }
    m.content = desc;
    const ic = document.querySelector('link[rel="icon"]');
    if (ic) ic.href = "/web/favicon.png";
    let ld = document.getElementById("fx-ld");
    if (!ld) { ld = document.createElement("script"); ld.id = "fx-ld"; ld.type = "application/ld+json"; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org", "@type": "HardwareStore", name: cfg.titulo, description: desc,
      image: location.origin + "/web/logo.png", url: location.origin,
      department: sedes.map(s => ({ "@type": "HardwareStore", name: s.nombre, telephone: (telefonosWa(s.telefono)[0] || "").replace(/^57/, "+57"), address: { "@type": "PostalAddress", streetAddress: s.direccion, addressLocality: "Bogotá", addressCountry: "CO" } })),
    });
  }, [cfg.titulo, JSON.stringify(sedes)]);

  // Animación de entrada al hacer scroll
  useEffect(() => {
    const els = raiz.current?.querySelectorAll(".rv:not(.in)") || [];
    if (!("IntersectionObserver" in window)) { els.forEach(e => e.classList.add("in")); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.08 });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  });

  // Categorías (reales si hay catálogo; base de Fox si aún no)
  const categorias = useMemo(() => {
    const m = {};
    data.productos.forEach(p => { m[p.categoria] = (m[p.categoria] || 0) + 1; });
    const reales = Object.entries(m).map(([n, c]) => ({ n, c, f: fotoCategoria(n) }));
    // Siempre se muestran las líneas base de Fox; las que aún no tienen productos publicados llevan al chat
    const norm = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const clave = t => norm(t).split(/[^a-z]+/).filter(w => w.length > 3).map(w => w.slice(0, 5));
    const faltan = CATS_BASE.filter(b => !reales.some(r => clave(b.n).some(k => clave(r.n).includes(k))));
    return [...reales, ...faltan.map(x => ({ ...x, c: 0 }))];
  }, [data.productos]);
  const calibres = useMemo(() => [...new Set(data.productos.filter(p => cat === "Todas" || p.categoria === cat).map(p => p.calibre).filter(Boolean))].sort((a, b) => parseFloat(a) - parseFloat(b)), [data.productos, cat]);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    let l = data.productos.filter(p =>
      (cat === "Todas" || p.categoria === cat) &&
      (!calibre || p.calibre === calibre) &&
      (!soloDisp || p.disponibilidad !== "bajo_pedido") &&
      (!t || `${p.nombre} ${p.categoria} ${p.calibre} ${p.medida} ${p.color}`.toLowerCase().includes(t)));
    if (orden === "precio-asc") l = [...l].sort((a, b) => (a.precio || 1e12) - (b.precio || 1e12));
    if (orden === "precio-desc") l = [...l].sort((a, b) => (b.precio || 0) - (a.precio || 0));
    return l;
  }, [data.productos, cat, q, calibre, soloDisp, orden]);
  useEffect(() => { setLimite(24); }, [cat, q, calibre, soloDisp, orden]);

  const lineas = data.productos.filter(p => carrito[p.id] > 0).map(p => ({ p, n: carrito[p.id] }));
  const nCot = lineas.length;
  const total = lineas.reduce((s, { p, n }) => s + (p.precio ? p.precio * n : 0), 0);
  const sinPrecio = lineas.some(({ p }) => !p.precio);
  const cambiar = (id, d) => setCarrito(c => {
    const n = Math.max(0, Math.floor((c[id] || 0) + d));
    const x = { ...c }; if (n) x[id] = n; else delete x[id]; return x;
  });
  const textoCot = () => {
    const l = lineas.map(({ p, n }) => `• ${n} ${p.unidad} — ${p.nombre}${p.precio ? ` (${money(p.precio)}/${p.unidad})` : " (a cotizar)"}`).join("\n");
    return `Solicito cotización:\n${l}\n${total ? `Estimado referencial: ${money(total)}${sinPrecio ? " + ítems a cotizar" : ""}` : "Precios por confirmar"}`;
  };
  const pedirChat = () => { setSolicitud({ n: Date.now(), texto: textoCot() }); setVerCarro(false); setChat(true); };

  const irCatalogo = c => { setCat(c); setCalibre(""); setMenu(false); setTimeout(() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }), 30); };

  // Calculadora de cerramiento
  const [calc, setCalc] = useState({ largo: "", alto: "2", tipo: "Malla eslabonada" });
  const L = parseFloat(calc.largo) || 0, H = parseFloat(calc.alto) || 0;
  const area = +(L * H).toFixed(1);
  const postes = L > 0 ? Math.ceil(L / 2.5) + 1 : 0;
  const pedirCalc = () => {
    setSolicitud({ n: Date.now(), texto: `Quiero cotizar un cerramiento:\n• Material: ${calc.tipo}\n• Perímetro: ${L} m\n• Altura: ${H} m\n• Área aprox.: ${area} m²\n• Postes aprox.: ${postes}` });
    setChat(true);
  };

  const titulo = String(cfg.heroTitulo || "").split(/(\*[^*]+\*)/g).map((s, i) => /^\*.*\*$/.test(s) ? <em key={i}>{s.slice(1, -1)}</em> : s);
  const imgHero = cfg.imagenHero || "/web/img/hero-rollos.jpg";

  return (
    <div className="fx" ref={raiz}>
      {cfg.banner && <div className="aviso">{cfg.banner}</div>}
      <div className="top">
        <div className="wrap">
          <span>Fabricantes en Bogotá · <b>{sedes.map(s => s.nombre.replace(/^Sede /, "")).join(" y ")}</b></span>
          <span>
            {waNum && <a href={waLink(waNum, waTxt)} target="_blank" rel="noreferrer">WhatsApp <b>+57 {waNum.replace(/^57/, "").replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3")}</b></a>}
            {cfg.horario && <> · {cfg.horario}</>}
          </span>
        </div>
      </div>

      <header className="hd">
        <div className="wrap">
          <a href="#inicio" className="logo"><img src="/web/logo.png" alt={cfg.titulo} /></a>
          <nav className={"nav" + (menu ? " open" : "")}>
            <a href="#categorias" onClick={() => setMenu(false)}>Categorías</a>
            <a href="#catalogo" onClick={() => setMenu(false)}>Catálogo</a>
            <a href="#cotizador" onClick={() => setMenu(false)}>Calcula tu cerca</a>
            <a href="#nosotros" onClick={() => setMenu(false)}>Nosotros</a>
            <a href="#sedes" onClick={() => setMenu(false)}>Sedes</a>
          </nav>
          <div className="acts">
            {waNum && <a className="btn wa sm" href={waLink(waNum, waTxt)} target="_blank" rel="noreferrer"><Ico d={I.wa} size={18} /> WhatsApp</a>}
            <button className="btn red sm cot-btn" onClick={() => setVerCarro(true)}>Cotización {nCot > 0 && <span className="n">{nCot}</span>}</button>
            <button className="burger" onClick={() => setMenu(m => !m)} aria-label="Menú">{menu ? "×" : "☰"}</button>
          </div>
        </div>
      </header>

      <section className="hero" id="inicio">
        <div className="wrap grid">
          <div className="rv">
            <span className="eyebrow">Mallas &amp; Alambres Fox · Bogotá</span>
            <h1>{titulo}</h1>
            <p className="sub">{cfg.heroSubtitulo}</p>
            <div className="ctas">
              <a href="#catalogo" className="btn red">Ver catálogo <Ico d={I.arrow} size={18} /></a>
              <button className="btn line" onClick={() => setChat(true)}>Hablar con un asesor</button>
            </div>
          </div>
          <div className="media rv">
            <div className="sq" />
            <div className="main"><img src={imgHero} alt="Rollos de malla eslabonada galvanizada y en PVC verde" fetchpriority="high" /></div>
            <div className="mini"><img src="/web/img/operario.jpg" alt="Operario en la línea de producción" loading="lazy" /></div>
            <div className="tag"><b>100%</b>producción propia</div>
          </div>
        </div>
        <div className="band" />
      </section>

      <section className="stats">
        <div className="wrap">
          {[
            [I.fab, "Fabricantes directos", "Producción propia en Bogotá"],
            [I.pin, "Dos sedes en Bogotá", sedes.map(s => s.nombre.replace(/^Sede /, "")).join(" · ")],
            [I.box, "Inventario en vivo", "Disponibilidad actualizada"],
            [I.chat, "Cotiza en minutos", "Chat y WhatsApp con asesores"],
          ].map(([ic, t, s], i) => (
            <div className="it" key={i}><div className="ic"><Ico d={ic} /></div><div><b>{t}</b><span>{s}</span></div></div>
          ))}
        </div>
      </section>

      <section className="sec" id="categorias">
        <div className="wrap">
          <div className="rv"><span className="eyebrow">Productos</span><h2 className="h2">Todo para tu cerramiento</h2><p className="lead">Elige una categoría y mira lo que tenemos disponible ahora mismo.</p></div>
          <div className="cats">
            {categorias.map((c, i) => (
              <button key={c.n} className="cat rv" style={{ transitionDelay: `${i * 60}ms` }} onClick={() => c.c ? irCatalogo(c.n) : setChat(true)}>
                <img src={c.f} alt={c.n} loading="lazy" />
                <span className="go"><Ico d={I.arrow} size={18} /></span>
                <div className="t"><h3>{c.n}</h3><span className="c">{c.c ? `${c.c} producto${c.c > 1 ? "s" : ""}` : "Consulta con un asesor"}</span></div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="sec gray" id="catalogo">
        <div className="wrap">
          <div className="rv"><span className="eyebrow">Catálogo</span><h2 className="h2">Disponibilidad en tiempo real</h2><p className="lead">Agrega lo que necesitas a tu cotización y un asesor confirma precio final, existencias y despacho.</p></div>
          <div className="cat-layout">
            <aside className="side">
              <div className="grp">
                <h4>Categoría</h4>
                {["Todas", ...categorias.filter(c => c.c).map(c => c.n)].map(n => (
                  <button key={n} className={"opt" + (cat === n ? " on" : "")} onClick={() => { setCat(n); setCalibre(""); }}>
                    <span>{n}</span><i>{n === "Todas" ? data.productos.length : (categorias.find(c => c.n === n)?.c || 0)}</i>
                  </button>
                ))}
              </div>
              {calibres.length > 0 && (
                <div className="grp">
                  <h4>Calibre</h4>
                  <select className="inp" value={calibre} onChange={e => setCalibre(e.target.value)}>
                    <option value="">Todos</option>{calibres.map(c => <option key={c} value={c}>Cal {c}</option>)}
                  </select>
                </div>
              )}
              <label className="chk"><input type="checkbox" checked={soloDisp} onChange={e => setSoloDisp(e.target.checked)} /> Solo en existencia</label>
            </aside>
            <div>
              <div className="toolbar">
                <input className="inp" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar producto, calibre, medida…" />
                <select className="inp" value={orden} onChange={e => setOrden(e.target.value)}>
                  <option value="nombre">Ordenar: nombre</option><option value="precio-asc">Menor precio</option><option value="precio-desc">Mayor precio</option>
                </select>
              </div>
              {cargando && <div className="count">Cargando catálogo…</div>}
              {errCat && <div className="count" style={{ color: "#b91c1c" }}>{errCat}</div>}
              {!cargando && !errCat && <div className="count">{visibles.length} producto{visibles.length === 1 ? "" : "s"}</div>}
              {!cargando && !errCat && visibles.length === 0 && (
                <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 6, padding: 36, textAlign: "center" }}>
                  <p style={{ margin: "0 0 16px" }}>No encontramos productos con esos filtros. Cuéntanos qué necesitas y te cotizamos a la medida.</p>
                  <button className="btn red" onClick={() => setChat(true)}>Hablar con un asesor</button>
                </div>
              )}
              <div className="pgrid">
                {visibles.slice(0, limite).map(p => {
                  const d = DISP[p.disponibilidad] || DISP.bajo_pedido;
                  const spec = [p.calibre && `Cal ${p.calibre}`, p.medida, p.color].filter(Boolean).join(" · ");
                  return (
                    <article key={p.id} className="pc">
                      <button className="ph" onClick={() => setProd(p)} aria-label={`Ver ${p.nombre}`}>
                        <span className={"badge " + d.cls}>{d.t}</span>
                        {p.imagen ? <img className="foto" src={p.imagen} alt={p.nombre} loading="lazy" />
                          : <div className="spec"><div className="k">{p.calibre ? `Cal ${p.calibre}` : p.categoria}</div><div className="m">{p.medida || p.color || p.categoria}</div></div>}
                      </button>
                      <div className="bd">
                        <div className="ct">{p.categoria}</div>
                        <button className="nm" onClick={() => setProd(p)}>{p.nombre}</button>
                        {spec && <div style={{ fontSize: 13, color: "var(--mut)" }}>{spec}</div>}
                        <div className="pr">{p.precio ? <>{money(p.precio)} <small>/ {p.unidad}</small></> : <span className="cq">Precio por cotización</span>}</div>
                        <button className="btn dark sm" onClick={() => cambiar(p.id, 1)}>{carrito[p.id] ? `En cotización (${carrito[p.id]}) · +1` : "Agregar a cotización"}</button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {visibles.length > limite && <button className="btn line vermas" onClick={() => setLimite(l => l + 24)}>Ver más productos</button>}
            </div>
          </div>
        </div>
      </section>

      <section className="sec" id="cotizador">
        <div className="wrap">
          <div className="rv"><span className="eyebrow">Cotizador</span><h2 className="h2">Calcula los materiales de tu cerca</h2><p className="lead">Dinos cuántos metros vas a cercar y la altura. Te damos un estimado y un asesor lo confirma.</p></div>
          <div className="calc rv">
            <div className="f">
              <div style={{ marginBottom: 18 }}>
                <label>Material</label>
                <select className="inp" value={calc.tipo} onChange={e => setCalc({ ...calc, tipo: e.target.value })}>
                  {["Malla eslabonada", "Malla PVC", "Malla galvanizada"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="row">
                <div><label>Perímetro (m)</label><input className="inp" inputMode="decimal" value={calc.largo} onChange={e => setCalc({ ...calc, largo: e.target.value.replace(",", ".") })} placeholder="Ej: 40" /></div>
                <div><label>Altura de malla</label>
                  <select className="inp" value={calc.alto} onChange={e => setCalc({ ...calc, alto: e.target.value })}>
                    {["1", "1.2", "1.5", "1.8", "2", "2.5"].map(h => <option key={h} value={h}>{h} m</option>)}
                  </select>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--mut)", margin: 0 }}>Los postes se estiman a una separación de 2,5 m. El asesor ajusta según esquinas, puertas y terreno.</p>
            </div>
            <div className="r">
              <div className="res">
                <div><span>Área de malla</span><div className="big">{area || "—"}{area ? <small>m²</small> : null}</div></div>
                <div><span>Postes aproximados</span><div className="big">{postes || "—"}{postes ? <small>unidades</small> : null}</div></div>
              </div>
              <button className="btn red" onClick={pedirCalc} disabled={!L}>Cotizar estos materiales</button>
              <div className="nota">Estimado referencial. El precio final y la disponibilidad los confirma un asesor.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec gray" id="nosotros">
        <div className="wrap about">
          <div className="ph rv">
            <div className="a"><img src="/web/img/produccion.jpg" alt="Línea de producción de malla eslabonada" loading="lazy" /></div>
            <div className="b"><img src="/web/img/tubos.jpg" alt="Tubería galvanizada en inventario" loading="lazy" /></div>
          </div>
          <div className="rv">
            <span className="eyebrow">Nosotros</span>
            <h2 className="h2">Fabricamos lo que vendemos</h2>
            <p style={{ marginTop: 18 }}>{cfg.nosotros}</p>
            <ul className="checks">
              {[["Producción propia", "Controlamos calibre, medida y acabado desde la máquina."], ["Asesoría técnica", "Te ayudamos a elegir el material correcto para tu proyecto."], ["Inventario real", "Lo que ves en el catálogo es lo que hay en bodega."]].map(([t, s]) => (
                <li key={t}><span className="ck"><Ico d={I.ok} size={15} sw={3} /></span><div><b>{t}</b><div style={{ fontSize: 15 }}>{s}</div></div></li>
              ))}
            </ul>
            <a href="#sedes" className="btn dark">Visítanos <Ico d={I.arrow} size={18} /></a>
          </div>
        </div>
      </section>

      <section className="sec" id="sedes">
        <div className="wrap">
          <div className="rv"><span className="eyebrow">Sedes</span><h2 className="h2">Visítanos en Bogotá</h2><p className="lead">Dos puntos de atención con inventario y asesores.</p></div>
          <div className="sedes">
            {sedes.map((s, i) => {
              const tels = telefonosWa(s.telefono);
              return (
                <div className="sede rv" key={i}>
                  <iframe title={`Mapa ${s.nombre}`} src={mapaEmbed(s.direccion, cfg.ciudad)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
                  <div className="bd">
                    <h3>{s.nombre}</h3>
                    <div className="ln"><i><Ico d={I.pin} size={18} /></i><span>{s.direccion}, {cfg.ciudad.split(",")[0]}</span></div>
                    <div className="ln"><i><Ico d={I.tel} size={18} /></i><span>{s.telefono}</span></div>
                    {s.horario && <div className="ln"><i>🕒</i><span>{s.horario}</span></div>}
                    <div className="acts">
                      <a className="btn red sm" href={mapaRuta(s.direccion, cfg.ciudad)} target="_blank" rel="noreferrer">Cómo llegar</a>
                      {tels[0] && <a className="btn wa sm" href={waLink(tels[0], `Hola, escribo desde la web. Quiero información de la ${s.nombre}.`)} target="_blank" rel="noreferrer">WhatsApp</a>}
                      {tels[0] && <a className="btn line sm" href={`tel:+${tels[0]}`}>Llamar</a>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="ft">
        <div className="wrap">
          <div className="cols">
            <div><img className="lg" src="/web/logo.png" alt={cfg.titulo} /><p style={{ fontSize: 14, maxWidth: 320 }}>Fabricantes de malla eslabonada, malla PVC, postes, tubería y alambres en Bogotá.</p></div>
            <div><h4>Navegación</h4><a href="#categorias">Categorías</a><a href="#catalogo">Catálogo</a><a href="#cotizador">Calcula tu cerca</a><a href="#nosotros">Nosotros</a><a href="#sedes">Sedes</a></div>
            <div><h4>Contacto</h4>{waNum && <a href={waLink(waNum, waTxt)} target="_blank" rel="noreferrer">WhatsApp</a>}{cfg.email && <a href={`mailto:${cfg.email}`}>{cfg.email}</a>}{cfg.instagram && <a href={cfg.instagram} target="_blank" rel="noreferrer">Instagram</a>}{cfg.facebook && <a href={cfg.facebook} target="_blank" rel="noreferrer">Facebook</a>}<a href="#" onClick={e => { e.preventDefault(); setChat(true); }}>Chat con un asesor</a></div>
            <div><h4>Sedes</h4>{sedes.map(s => <a key={s.nombre} href="#sedes">{s.nombre}<br /><span style={{ fontSize: 12, color: "#8a8789" }}>{s.direccion}</span></a>)}</div>
          </div>
          <div className="cp"><span>© {new Date().getFullYear()} {cfg.titulo}. Todos los derechos reservados.</span><span>Bogotá, Colombia</span></div>
        </div>
        <div className="band" />
      </footer>

      {waNum && <a className="wa-f" href={waLink(waNum, waTxt)} target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp"><Ico d={I.wa} size={28} /></a>}

      {prod && (
        <div className="ov" onClick={() => setProd(null)}>
          <div className="pm" onClick={e => e.stopPropagation()} role="dialog" aria-label={prod.nombre}>
            <div className="im"><img src={prod.imagen || fotoCategoria(prod.categoria)} alt={prod.nombre} /></div>
            <div className="info">
              <button className="x" onClick={() => setProd(null)} aria-label="Cerrar">×</button>
              <div className="eyebrow" style={{ marginBottom: 0 }}>{prod.categoria}</div>
              <h3>{prod.nombre}</h3>
              <table><tbody>
                {[["Calibre", prod.calibre], ["Medida", prod.medida], ["Color", prod.color], ["Unidad", prod.unidad], ["Disponibilidad", (DISP[prod.disponibilidad] || DISP.bajo_pedido).t], ["Precio", prod.precio ? `${money(prod.precio)} / ${prod.unidad} (IVA incl.)` : "Por cotización"]]
                  .filter(r => r[1]).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
              </tbody></table>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div className="qty"><button onClick={() => cambiar(prod.id, -1)}>−</button><input readOnly value={carrito[prod.id] || 0} /><button onClick={() => cambiar(prod.id, 1)}>+</button></div>
                <button className="btn red" onClick={() => { if (!carrito[prod.id]) cambiar(prod.id, 1); setProd(null); setVerCarro(true); }}>Agregar a cotización</button>
              </div>
              {waNum && <a className="btn wa sm" style={{ marginTop: 14 }} href={waLink(waNum, `Hola, me interesa: ${prod.nombre}`)} target="_blank" rel="noreferrer">Consultar por WhatsApp</a>}
            </div>
          </div>
        </div>
      )}

      {verCarro && (
        <div className="ov right" onClick={() => setVerCarro(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>Tu cotización</h3>
              <button onClick={() => setVerCarro(false)} style={{ background: "none", border: 0, fontSize: 30, color: "var(--ink)" }} aria-label="Cerrar">×</button>
            </div>
            {lineas.length === 0 && <p style={{ color: "var(--mut)" }}>Aún no agregas productos. Explora el catálogo y pulsa «Agregar a cotización».</p>}
            {lineas.map(({ p, n }) => (
              <div key={p.id} className="ln-c">
                <div className="nm">{p.nombre}</div>
                <div className="ctl">
                  <div className="qty"><button onClick={() => cambiar(p.id, -1)}>−</button>
                    <input value={n} inputMode="numeric" onChange={e => setCarrito(c => ({ ...c, [p.id]: Math.max(0, parseInt(e.target.value) || 0) }))} />
                    <button onClick={() => cambiar(p.id, 1)}>+</button></div>
                  <span style={{ color: "var(--mut)", fontSize: 13 }}>{p.unidad}</span>
                  <span style={{ marginLeft: "auto", fontWeight: 700, color: "var(--ink)" }}>{p.precio ? money(p.precio * n) : "A cotizar"}</span>
                </div>
              </div>
            ))}
            {lineas.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Archivo,sans-serif", fontWeight: 800, fontSize: 22, color: "var(--ink)" }}><span>Estimado</span><span>{total ? money(total) : "—"}</span></div>
                <p style={{ fontSize: 12, color: "var(--mut)", margin: "6px 0 18px" }}>Valor referencial con IVA incluido{sinPrecio ? ", sin los ítems por cotizar" : ""}. Un asesor confirma precio final, existencias y despacho.</p>
                <div style={{ display: "grid", gap: 10 }}>
                  <button className="btn red" onClick={pedirChat}>Enviar a un asesor (chat)</button>
                  {waNum && <a className="btn wa" href={waLink(waNum, textoCot())} target="_blank" rel="noreferrer">Enviar por WhatsApp</a>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ChatCliente abierto={chat} setAbierto={setChat} solicitud={solicitud} color={ROJO} />
    </div>
  );
}
