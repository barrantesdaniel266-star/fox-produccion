import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";
import { CONFIG_DEFAULT } from "./web/configDefault.js";

// Editor del sitio público (solo gerencia). Guarda en Firestore: sitio/config.
// La web lo muestra en ~15 s sin redesplegar. Vista previa: /web
export default function SitioWebTab() {
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "sitio", "config"))
      .then(s => setCfg({ ...CONFIG_DEFAULT, ...(s.exists() ? s.data() : {}) }))
      .catch(() => setMsg("No se pudo cargar la configuración."));
  }, []);

  if (!cfg) return <div style={{ color: "#64748b" }}>{msg || "Cargando…"}</div>;

  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));
  const setSede = (i, k, v) => setCfg(c => ({ ...c, sedes: c.sedes.map((s, j) => j === i ? { ...s, [k]: v } : s) }));
  const guardar = async () => {
    setGuardando(true); setMsg("");
    try { await setDoc(doc(db, "sitio", "config"), { ...cfg, actualizado: Date.now() }); setMsg("✓ Guardado. La web se actualiza en unos segundos."); }
    catch { setMsg("No se pudo guardar (¿reglas de Firestore publicadas?)."); }
    setGuardando(false);
  };

  const inp = { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 11px", fontSize: 14, boxSizing: "border-box" };
  const F = ({ label, children, hint }) => (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 4 }}>{label}</div>
      {children}{hint && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{hint}</div>}
    </label>
  );

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>🌐 Sitio Web</h2>
          <a href="/web" target="_blank" rel="noreferrer" style={{ color: "#E8262A", fontWeight: 700, fontSize: 14 }}>Ver sitio ↗</a>
        </div>
        <F label="Nombre / título"><input style={inp} value={cfg.titulo} onChange={e => set("titulo", e.target.value)} /></F>
        <F label="Color principal" hint="Botones, etiquetas y acentos."><input type="color" value={cfg.colorAcento} onChange={e => set("colorAcento", e.target.value)} style={{ width: 60, height: 36, border: "none", background: "none" }} /></F>
        <F label="Aviso superior (opcional)" hint="Ej: Promoción de la semana. Déjalo vacío para ocultarlo."><input style={inp} value={cfg.banner} onChange={e => set("banner", e.target.value)} /></F>
        <F label="Título principal"><input style={inp} value={cfg.heroTitulo} onChange={e => set("heroTitulo", e.target.value)} /></F>
        <F label="Subtítulo"><textarea style={{ ...inp, minHeight: 60 }} value={cfg.heroSubtitulo} onChange={e => set("heroSubtitulo", e.target.value)} /></F>
        <F label="Imagen de portada (enlace https)" hint="Pega la URL de una imagen. Vacío = fondo oscuro."><input style={inp} value={cfg.imagenHero} onChange={e => set("imagenHero", e.target.value)} placeholder="https://…" /></F>
        <F label="Texto «Nosotros»"><textarea style={{ ...inp, minHeight: 110 }} value={cfg.nosotros} onChange={e => set("nosotros", e.target.value)} /></F>
        <F label="WhatsApp (con indicativo, ej. 573214240407)"><input style={inp} value={cfg.whatsapp} onChange={e => set("whatsapp", e.target.value)} /></F>
        {cfg.sedes.map((s, i) => (
          <div key={i} style={{ background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <F label={`Sede ${i + 1} — nombre`}><input style={inp} value={s.nombre} onChange={e => setSede(i, "nombre", e.target.value)} /></F>
            <F label="Dirección"><input style={inp} value={s.direccion} onChange={e => setSede(i, "direccion", e.target.value)} /></F>
            <F label="Teléfonos"><input style={inp} value={s.telefono} onChange={e => setSede(i, "telefono", e.target.value)} /></F>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={guardar} disabled={guardando} style={{ background: "#E8262A", color: "#fff", border: "none", borderRadius: 10, padding: "11px 22px", fontWeight: 800, cursor: "pointer" }}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
          {msg && <span style={{ fontSize: 14, color: msg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>{msg}</span>}
        </div>
        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 14 }}>Qué productos se ven en la web y su precio público se define en Inventario → editar producto (casilla «Publicar en la web»).</p>
      </div>
    </div>
  );
}
