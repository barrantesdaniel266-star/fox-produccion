import React, { useState, useEffect, useRef } from "react";
import { collection, doc, setDoc, addDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase.js";

// Bandeja de chat con clientes de la web. `conversaciones` llega ya en tiempo real desde App.
const hora = ts => new Date(ts).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const ESTADO = { abierta: { t: "Abierta", c: "#16a34a" }, en_espera: { t: "En espera", c: "#b45309" }, cerrada: { t: "Cerrada", c: "#64748b" } };

export default function ChatTab({ conversaciones, user }) {
  const [selId, setSelId] = useState(null);
  const [filtro, setFiltro] = useState("activas");
  const [msgs, setMsgs] = useState([]);
  const [texto, setTexto] = useState("");
  const [err, setErr] = useState("");
  const fin = useRef(null);
  const email = String(user.email || user.username || "").toLowerCase();

  const lista = conversaciones
    .filter(c => filtro === "todas" || (filtro === "activas" ? c.estado !== "cerrada" : c.estado === "cerrada"))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const sel = conversaciones.find(c => c.id === selId);

  useEffect(() => {
    if (!selId) { setMsgs([]); return; }
    return onSnapshot(query(collection(db, "mensajes"), where("convId", "==", selId)),
      s => setMsgs(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.ts - b.ts)),
      () => setErr("No se pudieron cargar los mensajes."));
  }, [selId]);

  useEffect(() => { fin.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  // Marcar como leída al abrir o cuando llega un mensaje nuevo estando abierta
  useEffect(() => {
    if (sel?.sinLeerStaff) setDoc(doc(db, "conversaciones", sel.id), { sinLeerStaff: false }, { merge: true }).catch(() => {});
  }, [sel?.id, sel?.sinLeerStaff]);

  const patch = d => setDoc(doc(db, "conversaciones", sel.id), d, { merge: true }).catch(() => setErr("No se pudo actualizar."));

  const enviar = async e => {
    e.preventDefault();
    const t = texto.trim().slice(0, 1500);
    if (!t || !sel) return;
    setTexto(""); setErr("");
    const ts = Date.now();
    try {
      await addDoc(collection(db, "mensajes"), { convId: sel.id, de: "vendedora", vendedoraName: user.name, texto: t, ts });
      await setDoc(doc(db, "conversaciones", sel.id), { ultimoMensaje: t.slice(0, 120), ts, estado: "abierta", ...(sel.vendedoraAsignada ? {} : { vendedoraAsignada: email, vendedoraNombre: user.name }) }, { merge: true });
    } catch { setErr("No se pudo enviar."); setTexto(t); }
  };

  const caja = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(260px,340px) 1fr", gap: 14, minHeight: 520 }}>
      <div style={{ ...caja, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 6, padding: 10, borderBottom: "1px solid #e2e8f0" }}>
          {[["activas", "Activas"], ["cerrada", "Cerradas"], ["todas", "Todas"]].map(([k, l]) => (
            <button key={k} onClick={() => setFiltro(k)} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: filtro === k ? "#E8262A" : "#f1f5f9", color: filtro === k ? "#fff" : "#475569" }}>{l}</button>
          ))}
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {lista.length === 0 && <div style={{ padding: 20, color: "#94a3b8", fontSize: 14 }}>Sin conversaciones.</div>}
          {lista.map(c => (
            <div key={c.id} onClick={() => setSelId(c.id)} style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", background: selId === c.id ? "#fef2f2" : "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <b style={{ fontSize: 14 }}>{c.sinLeerStaff && <span style={{ color: "#E8262A" }}>● </span>}{c.clienteNombre}</b>
                <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>{c.ts ? hora(c.ts) : ""}</span>
              </div>
              <div style={{ fontSize: 13, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.ultimoMensaje || "—"}</div>
              <div style={{ fontSize: 11, marginTop: 2, color: ESTADO[c.estado]?.c }}>{ESTADO[c.estado]?.t || c.estado}{c.vendedoraNombre ? ` · ${c.vendedoraNombre}` : " · Sin asignar"}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...caja, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!sel ? <div style={{ margin: "auto", color: "#94a3b8" }}>Selecciona una conversación</div> : (
          <>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div>
                <b>{sel.clienteNombre}</b>
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  {sel.clienteContacto} · <a href={`https://wa.me/57${String(sel.clienteContacto || "").replace(/\D/g, "").replace(/^57/, "")}`} target="_blank" rel="noreferrer" style={{ color: "#16a34a" }}>WhatsApp</a>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {sel.vendedoraAsignada !== email && <button onClick={() => patch({ vendedoraAsignada: email, vendedoraNombre: user.name })} style={btn}>Tomar</button>}
                {sel.estado !== "cerrada"
                  ? <button onClick={() => patch({ estado: "cerrada" })} style={btn}>Cerrar</button>
                  : <button onClick={() => patch({ estado: "abierta" })} style={btn}>Reabrir</button>}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 12, background: "#f1f5f9", display: "flex", flexDirection: "column", gap: 8 }}>
              {msgs.map(m => (
                <div key={m.id} style={{ alignSelf: m.de === "cliente" ? "flex-start" : "flex-end", maxWidth: "80%", background: m.de === "cliente" ? "#fff" : m.de === "agente" ? "#ede9fe" : "#E8262A", color: m.de === "vendedora" ? "#fff" : "#0f172a", borderRadius: 12, padding: "8px 12px", fontSize: 14, whiteSpace: "pre-wrap", boxShadow: "0 1px 2px rgba(0,0,0,.08)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, opacity: .7 }}>{m.de === "cliente" ? sel.clienteNombre : m.de === "agente" ? "Agente IA" : (m.vendedoraName || "Vendedora")} · {hora(m.ts)}</div>
                  {m.texto}
                </div>
              ))}
              <div ref={fin} />
            </div>
            {err && <div style={{ color: "#dc2626", fontSize: 13, padding: "4px 12px" }}>{err}</div>}
            <form onSubmit={enviar} style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid #e2e8f0" }}>
              <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribe una respuesta…" style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 12px", fontSize: 15 }} maxLength={1500} />
              <button style={{ background: "#E8262A", color: "#fff", border: "none", borderRadius: 10, padding: "0 18px", fontWeight: 700, cursor: "pointer" }}>Enviar</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const btn = { border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, padding: "6px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer" };
