import React, { useState, useEffect, useRef } from "react";
import { signInAnonymously } from "firebase/auth";
import { collection, doc, setDoc, addDoc, onSnapshot, query, where } from "firebase/firestore";
import { db, auth } from "../firebase.js";

// Chat del visitante con las vendedoras. Sesión anónima de Firebase; la conversación
// y los mensajes quedan atados a ese uid por las reglas de Firestore.
const LS = "fox_chat_conv";
const leer = () => { try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch { return null; } };
const guardar = v => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} };

export default function ChatCliente({ abierto, setAbierto, solicitud, color }) {
  const [conv, setConv] = useState(leer);
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [texto, setTexto] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [err, setErr] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fin = useRef(null);
  const ultimaSolicitud = useRef(0);

  const sesion = async () => {
    await auth.authStateReady();
    if (!auth.currentUser) await signInAnonymously(auth);
    return auth.currentUser;
  };

  // Mensajes en tiempo real de la conversación del visitante
  useEffect(() => {
    if (!conv?.id) return;
    let off = () => {};
    let vivo = true;
    sesion().then(() => {
      if (!vivo) return;
      off = onSnapshot(query(collection(db, "mensajes"), where("convId", "==", conv.id)),
        s => setMsgs(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.ts - b.ts)),
        () => setErr("No se pudo cargar la conversación."));
    }).catch(() => setErr("No se pudo iniciar el chat."));
    return () => { vivo = false; off(); };
  }, [conv?.id]);

  useEffect(() => { fin.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, abierto]);

  const enviar = async (t, c = conv) => {
    const limpio = String(t).trim().slice(0, 1500);
    if (!limpio || !c) return;
    const ts = Date.now();
    await addDoc(collection(db, "mensajes"), { convId: c.id, de: "cliente", texto: limpio, ts });
    await setDoc(doc(db, "conversaciones", c.id), { ultimoMensaje: limpio.slice(0, 120), ts, sinLeerStaff: true, estado: "abierta" }, { merge: true });
  };

  const iniciar = async (primerTexto) => {
    if (nombre.trim().length < 2) { setErr("Escribe tu nombre."); return null; }
    if (celular.replace(/\D/g, "").length < 7) { setErr("Escribe un celular válido."); return null; }
    const u = await sesion();
    const id = "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const ts = Date.now();
    await setDoc(doc(db, "conversaciones", id), {
      clienteUid: u.uid, clienteNombre: nombre.trim().slice(0, 80), clienteContacto: celular.trim().slice(0, 30),
      vendedoraAsignada: "", estado: "abierta", ultimoMensaje: "", ts, sinLeerStaff: false, origen: "web",
    });
    const c = { id, nombre: nombre.trim() };
    guardar(c); setConv(c);
    return c;
  };

  const submitInicio = async e => {
    e.preventDefault(); setErr(""); setEnviando(true);
    try {
      const c = await iniciar();
      if (c) await enviar(solicitud?.texto && solicitud.n !== ultimaSolicitud.current ? solicitud.texto : "Hola, quisiera información.", c);
      if (c && solicitud) ultimaSolicitud.current = solicitud.n;
    } catch { setErr("No se pudo iniciar el chat. Intenta de nuevo."); }
    setEnviando(false);
  };

  // Cotización enviada desde el carrito cuando ya existe la conversación
  useEffect(() => {
    if (!solicitud || !conv?.id || solicitud.n === ultimaSolicitud.current) return;
    ultimaSolicitud.current = solicitud.n;
    sesion().then(() => enviar(solicitud.texto)).catch(() => setErr("No se pudo enviar la cotización."));
  }, [solicitud?.n, conv?.id]);

  const submitMsg = async e => {
    e.preventDefault();
    const t = texto; setTexto("");
    try { await enviar(t); } catch { setErr("No se pudo enviar."); setTexto(t); }
  };

  const nuevo = () => { try { localStorage.removeItem(LS); } catch {} setConv(null); setMsgs([]); };

  return (
    <>
      {!abierto && (
        <button onClick={() => setAbierto(true)} aria-label="Abrir chat" style={{ position:"fixed", right:20, bottom:20, zIndex:50, background:color, color:"#fff", border:"none", borderRadius:999, padding:"14px 20px", fontSize:16, fontWeight:700, boxShadow:"0 8px 24px rgba(0,0,0,.3)", cursor:"pointer" }}>
          💬 Chatea con una asesora
        </button>
      )}
      {abierto && (
        <div style={{ position:"fixed", right:16, bottom:16, zIndex:60, width:"min(380px, calc(100vw - 32px))", height:"min(540px, calc(100vh - 32px))", background:"#fff", borderRadius:16, boxShadow:"0 16px 48px rgba(0,0,0,.35)", display:"flex", flexDirection:"column", overflow:"hidden", color:"#0f172a" }}>
          <div style={{ background:"#1a1a1a", color:"#fff", padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div><div style={{ fontWeight:800 }}>Asesoras Fox</div><div style={{ fontSize:12, color:"#f87171" }}>Te respondemos en este chat</div></div>
            <button onClick={() => setAbierto(false)} style={{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer" }} aria-label="Cerrar">×</button>
          </div>
          {!conv ? (
            <form onSubmit={submitInicio} style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
              <p style={{ margin:0, fontSize:14, color:"#475569" }}>Déjanos tus datos y una asesora te atiende por aquí.</p>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" style={campo} maxLength={80} />
              <input value={celular} onChange={e => setCelular(e.target.value)} placeholder="Celular / WhatsApp" inputMode="tel" style={campo} maxLength={30} />
              {err && <div style={{ color:"#dc2626", fontSize:13 }}>{err}</div>}
              <button disabled={enviando} style={{ background:color, color:"#fff", border:"none", borderRadius:10, padding:12, fontWeight:700, fontSize:15, cursor:"pointer" }}>{enviando ? "Conectando…" : "Iniciar chat"}</button>
            </form>
          ) : (
            <>
              <div style={{ flex:1, overflowY:"auto", padding:12, background:"#f1f5f9", display:"flex", flexDirection:"column", gap:8 }}>
                {msgs.length === 0 && <div style={{ color:"#94a3b8", fontSize:13, textAlign:"center", marginTop:20 }}>Cargando…</div>}
                {msgs.map(m => (
                  <div key={m.id} style={{ alignSelf:m.de === "cliente" ? "flex-end" : "flex-start", maxWidth:"85%", background:m.de === "cliente" ? color : "#fff", color:m.de === "cliente" ? "#fff" : "#0f172a", borderRadius:12, padding:"8px 12px", fontSize:14, whiteSpace:"pre-wrap", boxShadow:"0 1px 2px rgba(0,0,0,.08)" }}>
                    {m.de !== "cliente" && <div style={{ fontSize:11, fontWeight:700, color:"#64748b", marginBottom:2 }}>{m.de === "agente" ? "Asistente Fox" : (m.vendedoraName || "Asesora")}</div>}
                    {m.texto}
                  </div>
                ))}
                <div ref={fin} />
              </div>
              {err && <div style={{ color:"#dc2626", fontSize:12, padding:"4px 12px" }}>{err}</div>}
              <form onSubmit={submitMsg} style={{ display:"flex", gap:8, padding:10, borderTop:"1px solid #e2e8f0" }}>
                <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribe tu mensaje…" style={{ ...campo, flex:1 }} maxLength={1500} />
                <button style={{ background:color, color:"#fff", border:"none", borderRadius:10, padding:"0 16px", fontWeight:700, cursor:"pointer" }}>Enviar</button>
              </form>
              <button onClick={nuevo} style={{ background:"none", border:"none", color:"#94a3b8", fontSize:12, padding:"0 0 8px", cursor:"pointer" }}>Iniciar otra conversación</button>
            </>
          )}
        </div>
      )}
    </>
  );
}

const campo = { border:"1px solid #cbd5e1", borderRadius:10, padding:"10px 12px", fontSize:15, outline:"none" };
