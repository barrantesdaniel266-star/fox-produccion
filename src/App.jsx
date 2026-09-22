import React, { useState, useEffect, useCallback, useRef } from "react";
import { db } from "./firebase.js";
import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy,
} from "firebase/firestore";
import logoUrl from "./assets/logo.png";

const RED="#E8262A", DARK="#1a1a1a", GREEN="#16a34a";
const APP_VERSION="v2026.09.20";

// ═══ USUARIOS ══════════════════════════════════════════════
const USERS = {
  "mireya.centro":   { password:"Foxcentrom2026", name:"Mireya",         role:"vendedora", sede:"Centro"      },
  "jhoana.centro":   { password:"Foxcentroj2026", name:"Jhoana",         role:"vendedora", sede:"Centro"      },
  "tatiana.santal":  { password:"Foxsantat2026",  name:"Tatiana",        role:"vendedora", sede:"Santa Lucia" },
  "carolina.santal": { password:"Foxsantac2026",  name:"Carolina",       role:"vendedora", sede:"Santa Lucia" },
  "rafael":          { password:"Fox2026*",        name:"Rafael",         role:"gerencia",  sede:"Ambas Sedes" },
  "natalia":         { password:"Fox2026*",        name:"Natalia",        role:"gerencia",  sede:"Ambas Sedes" },
  "jefe.planta":     { password:"Fox2026*",        name:"Jefe de Planta", role:"gerencia",  sede:"Ambas Sedes" },
  "tv.planta":       { password:"FoxTV2026",        name:"Pantalla Planta", role:"viewer",      sede:"Ambas Sedes" },
  "alejandra":       { password:"FoxAle2026*",      name:"Alejandra",      role:"logistica",   sede:"Ambas Sedes" },
  "granja":          { password:"FoxGranja2026",    name:"La Granja",      role:"vendedora",   sede:"La Granja"   },
};

const MACHINES = [
  { id:"C1",  label:"C-1",  name:"Maquina 1", sede:"Centro"      },
  { id:"C2",  label:"C-2",  name:"Maquina 2", sede:"Centro"      },
  { id:"SL1", label:"SL-1", name:"Maquina 1", sede:"Santa Lucia" },
  { id:"SL2", label:"SL-2", name:"Maquina 2", sede:"Santa Lucia" },
  { id:"SL3", label:"SL-3", name:"Maquina 3", sede:"Santa Lucia" },
  { id:"SL4", label:"SL-4", name:"Maquina 4", sede:"Santa Lucia" },
  { id:"SL5", label:"SL-5", name:"Maquina 5", sede:"Santa Lucia" },
];

const PRODUCTOS = [
  { id:"eslabonada", label:"Malla Eslabonada", color:"#1d4ed8", bg:"#eff6ff" },
  { id:"pvc",        label:"Malla PVC",        color:"#15803d", bg:"#f0fdf4" },
  { id:"postes",     label:"Postes",           color:"#b45309", bg:"#fffbeb" },
];

const SEDES = ["Centro","Santa Lucia","La Granja"];

// Datos de la empresa (para remisiones y cotizaciones)
const EMPRESA = {
  nombre:"MALLAS & ALAMBRES FOX",
  email:"mallasyalambresfox@gmail.com",
  sedes:[
    { nombre:"Sede Centro",       dir:"Calle 12 # 15-87",        tels:"321 424 0407 · 322 914 7720" },
    { nombre:"Sede Santa Lucía",  dir:"Carrera 21 # 44 Sur - 62", tels:"320 315 9731 · 320 320 2481 · 312 384 4768" },
  ],
  ciudad:"Bogotá",
  nota:"Transcurridos treinta (30) días calendario desde la fecha de compra, no nos hacemos responsables por la conservación, custodia o devolución del mismo.",
};
const IVA_DEFAULT = 19;      // %
const RETE_DEFAULT = 2.5;    // %
// Números iniciales — cámbialos al próximo número real de tu talonario para no duplicar
const REMISION_INICIAL = 3463;
const COTIZACION_INICIAL = 1;

const MOV_PRODUCTOS = [
  { id:"eslabonada",  label:"Malla Eslabonada",  unidad:"m²",     conDesc:true },
  { id:"pvc",         label:"Malla PVC",          unidad:"m²",     conDesc:true },
  { id:"postes",      label:"Postes",             unidad:"unid",   conDesc:true },
  { id:"tubos",       label:"Tubos",              unidad:"unid",   conDesc:true },
  { id:"alambrepuas", label:"Alambre de Púas",    unidad:"rollos", conDesc:true },
  { id:"gallinero",   label:"Malla Gallinero",    unidad:"unid",   conDesc:true  },
  { id:"pajarito",    label:"Malla Pajarito",     unidad:"unid",   conDesc:true  },
  { id:"concertina",  label:"Concertina",         unidad:"rollos", conDesc:true },
  { id:"gaviones",    label:"Gaviones",           unidad:"unid",   conDesc:true  },
];

const ABERTURA_SIZES = ['1"','1"1/2','2"','2"1/4','2"1/2'];
const STORAGE_KEY = "fox_orders_v8";

// ═══ UTILIDADES ════════════════════════════════════════════
const fmtDate = ts => {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("es-CO",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
};
const timeAgo = ts => {
  const m=Math.floor((Date.now()-ts)/60000);
  if(m<1)return"ahora"; if(m<60)return`${m}min`;
  const h=Math.floor(m/60); return h<24?`${h}h`:`${Math.floor(h/24)}d`;
};
const calcM2 = (ancho,alto) => { const v=parseFloat(ancho)*parseFloat(alto); return isNaN(v)||v<=0?"":v.toFixed(2); };
const labelProducto = id => { const p=PRODUCTOS.find(x=>x.id===id); return p?p.label:id||""; };
const infoProducto  = id => PRODUCTOS.find(x=>x.id===id)||{color:"#64748b",bg:"#f1f5f9",label:id};

// ¿La orden es de inventario/stock? (en esos casos se ignoran costo y precio de venta)
const esStockCliente = cliente =>
  String(cliente||"").toLowerCase().includes("stock") ||
  String(cliente||"").toLowerCase().includes("inventario");

// Identificador estable de cliente a partir del nombre (une órdenes, ventas y clientes)
const clienteId = nombre => String(nombre||"").trim().toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");

// Todos los ids (nombre + alias) que pertenecen a un cliente ya fusionado
const clienteMatchIds = c => {
  const s=new Set();
  if(c?.id) s.add(c.id);
  (c?.aliases||[]).forEach(a=>{ const id=clienteId(a); if(id) s.add(id); });
  return s;
};
// Encuentra el cliente canónico para un nombre (revisa nombre y alias)
const findClienteByNombre = (clientes,nombre) => {
  const id=clienteId(nombre); if(!id) return null;
  return (clientes||[]).find(c=>clienteMatchIds(c).has(id))||null;
};

// Formatea valores de dinero en pesos colombianos
const fmtMoney = v => {
  const n=Number(v);
  if(v===""||v==null||isNaN(n)) return "—";
  return "$"+n.toLocaleString("es-CO");
};

// Estados de entrega (independientes del estado de producción)
const ENTREGA_ESTADOS = {
  pendiente: { label:"Pendiente de entrega", short:"Pendiente", color:"#b45309", bg:"#fffbeb", border:"#fde68a" },
  entregado: { label:"Entregado",            short:"Entregado", color:"#15803d", bg:"#f0fdf4", border:"#86efac" },
};
const entregaInfo = o => ENTREGA_ESTADOS[o?.estadoEntrega==="entregado"?"entregado":"pendiente"];

// Estado combinado de la orden (producción + entrega):
//   queue / active  → en proceso
//   terminada       → producida pero SIN entregar
//   completada      → producida y ENTREGADA (cerrada del todo)
const orderDisplayStatus = o => {
  const prod=deriveOrderStatus(normalizeItems(o));
  if(prod!=="completed") return prod; // "queue" | "active"
  return o?.estadoEntrega==="entregado" ? "completada" : "terminada";
};
const ORDER_ST = {
  queue:      { bg:"#eff6ff", col:"#1d4ed8", txt:"En Cola" },
  active:     { bg:"#fef2f2", col:"#991b1b", txt:"En Producción" },
  terminada:  { bg:"#fffbeb", col:"#b45309", txt:"Terminada" },
  completada: { bg:"#f0fdf4", col:"#15803d", txt:"Completada" },
};
const orderStInfo = o => ORDER_ST[orderDisplayStatus(o)] || ORDER_ST.queue;

// Construye una entrada de log de cambios
const makeLog = (user,accion,detalle="") => ({
  ts: Date.now(),
  usuario: user?.name || user?.username || "—",
  username: user?.username || "",
  accion,
  detalle,
});

// Normaliza items y agrega status/machineId por item (compat. retroactiva)
const normalizeItems = o => {
  const baseStatus = o.status==="completed"?"completed":o.status==="active"?"active":"queue";
  if (Array.isArray(o.items) && o.items.length>0){
    return o.items.map(it=>({
      ...it,
      status:    it.status    !== undefined ? it.status    : baseStatus,
      machineId: it.machineId !== undefined ? it.machineId : (o.machineId||null),
      machineLabel: it.machineLabel !== undefined ? it.machineLabel : (o.machineLabel||null),
      assignedAt:   it.assignedAt   !== undefined ? it.assignedAt   : (o.assignedAt||null),
      completedAt:  it.completedAt  !== undefined ? it.completedAt  : (o.completedAt||null),
    }));
  }
  if (o.producto){
    return [{
      _key:"legacy", producto:o.producto,
      calibre:o.calibre||"", calibreInterno:o.calibreInterno||"",
      color:o.color||"", ancho:o.ancho||"", alto:o.alto||"",
      metros:o.metros||"", abertura:o.abertura||"",
      grosor:o.grosor||"", largo:o.largo||"", cantidad:o.cantidad||"",
      status: baseStatus,
      machineId: o.machineId||null, machineLabel: o.machineLabel||null,
      assignedAt: o.assignedAt||null, completedAt: o.completedAt||null,
    }];
  }
  return [];
};

// Deriva el status de la orden a partir del estado de sus items
const deriveOrderStatus = items => {
  if (!items||items.length===0) return "queue";
  if (items.every(it=>it.status==="completed")) return "completed";
  if (items.some(it=>it.status==="active"||it.status==="completed")) return "active";
  return "queue";
};

// Dado machineId, devuelve [{order, item, itemIndex}] — todos los items activos en esa maquina
const getMachineItems = (machineId, orders) => {
  const result=[];
  for (const o of orders){
    const items=normalizeItems(o);
    for (let i=0;i<items.length;i++){
      if(items[i].status==="active"&&items[i].machineId===machineId)
        result.push({order:o, item:items[i], itemIndex:i});
    }
  }
  return result;
};
// Compat: devuelve solo el primero (usado en partes no migradas)
const getMachineItem = (machineId, orders) => {
  const all=getMachineItems(machineId,orders);
  return all.length>0?all[0]:null;
};

const resumenItem = it => {
  if (!it||!it.producto) return "";
  const v=(val,label)=>val?`${label}${val}`:"";
  const vn=(val,label)=>val?`${label}${val}`:"";
  if (it.producto==="eslabonada"){
    const parts=[it.metros&&`${it.metros}m²`,it.ancho&&it.alto&&`${it.ancho}×${it.alto}m`,v(it.abertura,"Ab:"),v(it.calibre,"Cal:")].filter(Boolean);
    return parts.join(" | ");
  }
  if (it.producto==="pvc"){
    const parts=[it.metros&&`${it.metros}m²`,it.ancho&&it.alto&&`${it.ancho}×${it.alto}m`,v(it.abertura,"Ab:"),v(it.calibre,"Cal:"),v(it.calibreInterno,"CalInt:"),it.color].filter(Boolean);
    return parts.join(" | ");
  }
  if (it.producto==="postes"){
    const parts=[v(it.calibre,"Cal:"),it.grosor&&`${it.grosor}"`,it.largo&&`${it.largo}m`,it.cantidad&&`${it.cantidad} un`].filter(Boolean);
    return parts.join(" | ");
  }
  return "";
};

const exportExcel = (rows,includeCost=false) => {
  const stat={queue:"En Cola",active:"En Produccion",completed:"Terminado"};
  // Usar tabulacion como separador - Excel lo reconoce universalmente sin importar configuracion regional
  const TAB="\t";
  // Limpiar el valor: quitar tabs y saltos de linea que rompen el formato
  const clean=v=>String(v==null?"":v).replace(/\t/g," ").replace(/\r?\n/g," ").trim();
  const money=v=>(v===""||v==null||isNaN(Number(v)))?"":Number(v);

  const headers=[
    "No.Orden","Cliente","Remision","Sede","Creado por","Estado Orden",
    "Estado Entrega","Fecha Entrega","Fecha Creacion","Fecha Terminado",
    "Producto","Estado Producto","Maquina",
    "M2","Ancho(m)","Alto(m)","Abertura",
    "Calibre","Cal.Interno","Color","Grosor","Largo(m)","Cantidad",
    "Precio Venta", ...(includeCost?["Costo"]:[])
  ];

  const data=[];
  rows.forEach(o=>{
    const items=normalizeItems(o);
    const est=ORDER_ST[orderDisplayStatus(o)]?.txt||"";
    const fc=fmtDate(o.timestamp)||"";
    const fcomp=o.completedAt?fmtDate(o.completedAt):fmtDate(normalizeItems(o).map(it=>it.completedAt).filter(Boolean).sort((a,b)=>b-a)[0])||"";
    const estEnt=o.estadoEntrega==="entregado"?"Entregado":"Pendiente";
    const fEnt=o.fechaEntrega?fmtDate(o.fechaEntrega):"";
    const pre=[o.orden,o.cliente||"",o.remision||"",o.sede||"",o.vendedoraName||"",est,estEnt,fEnt,fc,fcomp];
    if(items.length===0){
      data.push([...pre,"","","","","","","","","","","","","",...(includeCost?[""]:[])]);
    } else {
      // Repetir datos de la orden en CADA producto — sin gaps
      items.forEach(it=>{
        data.push([
          ...pre,
          labelProducto(it.producto)||"", stat[it.status]||it.status||"", it.machineLabel||"",
          it.metros||"", it.ancho||"", it.alto||"", it.abertura||"",
          it.calibre||"", it.calibreInterno||"", it.color||"",
          it.grosor||"", it.largo||"", it.cantidad||"",
          money(it.precioVenta), ...(includeCost?[money(it.costo)]:[]),
        ]);
      });
    }
  });

  // Construir TSV: BOM UTF-8 + encabezado + filas
  const tsv=[headers,...data]
    .map(row=>row.map(clean).join(TAB))
    .join("\r\n");

  // BOM \uFEFF hace que Excel abra UTF-8 correctamente con tildes y ñ
  const blob=new Blob(["\uFEFF"+tsv],{type:"text/tab-separated-values;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`Fox_Ordenes_${new Date().toISOString().slice(0,10)}.tsv`;
  a.click();
  URL.revokeObjectURL(a.href);
};

// ═══ ESTILOS ═══════════════════════════════════════════════
const inp={width:"100%",border:"1.5px solid #e2e8f0",borderRadius:10,padding:"10px 14px",fontSize:14,color:"#1e293b",outline:"none",boxSizing:"border-box"};
const btnR={background:RED,border:"none",borderRadius:10,padding:"11px 20px",fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer"};
const btnS={background:"#fff",border:"1.5px solid #e2e8f0",borderRadius:10,padding:"11px 20px",fontSize:14,fontWeight:600,color:"#64748b",cursor:"pointer"};
const btnG={background:GREEN,border:"none",borderRadius:10,padding:"11px 20px",fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer"};

// ═══ ROOT ══════════════════════════════════════════════════
export default function App(){
  const [user,setUser]=useState(()=>{
    try{ const s=localStorage.getItem("fox_session"); return s?JSON.parse(s):null; }catch{return null;}
  });
  const [orders,setOrders]=useState([]);
  const [ready,setReady]=useState(false);
  const [dbErr,setDbErr]=useState(false);

  const [movimientos,setMovimientos]=useState([]);
  useEffect(()=>{
    const q2=query(collection(db,"movimientos"),orderBy("timestamp","desc"));
    return onSnapshot(q2,snap=>setMovimientos(snap.docs.map(d=>d.data())),()=>{});
  },[]);

  const [inventario,setInventario]=useState([]);
  useEffect(()=>{
    return onSnapshot(collection(db,"inventario"),snap=>setInventario(snap.docs.map(d=>d.data())),()=>{});
  },[]);

  const [remisiones,setRemisiones]=useState([]);
  useEffect(()=>{
    return onSnapshot(collection(db,"remisiones"),snap=>setRemisiones(snap.docs.map(d=>d.data())),()=>{});
  },[]);
  const [clientes,setClientes]=useState([]);
  useEffect(()=>{
    return onSnapshot(collection(db,"clientes"),snap=>setClientes(snap.docs.map(d=>d.data())),()=>{});
  },[]);

  useEffect(()=>{
    const q=query(collection(db,"orders"),orderBy("timestamp","desc"));
    return onSnapshot(q,
      snap=>{ setOrders(snap.docs.map(d=>d.data())); setReady(true); },
      err=>{ console.error(err); setDbErr(true); setReady(true); }
    );
  },[]);

  // Auto-reparar ordenes completadas que tienen completedAt null en Firestore
  useEffect(()=>{
    if(orders.length===0) return;
    orders.forEach(o=>{
      const items=normalizeItems(o);
      const isCompleted=deriveOrderStatus(items)==="completed";
      if(isCompleted&&!o.completedAt){
        // Busca el completedAt mas reciente entre los items
        const fallback=items.map(it=>it.completedAt).filter(Boolean).sort((a,b)=>b-a)[0];
        if(fallback){
          updateDoc(doc(db,"orders",String(o.orden)),{completedAt:fallback}).catch(()=>{});
        }
      }
    });
  },[orders]);

  const login=u=>{ setUser(u); localStorage.setItem("fox_session",JSON.stringify(u)); };
  const logout=()=>{ setUser(null); localStorage.removeItem("fox_session"); };

  if(!ready)return <Splash error={dbErr}/>;
  if(!user)return <Login onLogin={login}/>;
  return <Shell user={user} onLogout={logout} orders={orders} movimientos={movimientos} inventario={inventario} remisiones={remisiones} clientes={clientes}/>;
}

// ═══ SPLASH ════════════════════════════════════════════════
function Splash({error}){
  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:DARK,gap:16}}>
      <img src={logoUrl} style={{width:90,height:90,borderRadius:16}} alt="Fox"/>
      {error?(
        <div style={{textAlign:"center",color:"#f87171",maxWidth:320,padding:"0 16px"}}>
          <p style={{fontWeight:700,marginBottom:8}}>Error de conexión con Firebase</p>
          <p style={{fontSize:14,lineHeight:1.6}}>Verifica que las variables de entorno (.env) estén configuradas y que el proyecto Firebase existe.</p>
        </div>
      ):(
        <>
          <div style={{width:44,height:44,border:`3px solid ${RED}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
          <p style={{color:"#94a3b8",fontSize:14,margin:0}}>Cargando sistema...</p>
        </>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}*{box-sizing:border-box}`}</style>
    </div>
  );
}

// ═══ LOGIN ═════════════════════════════════════════════════
function Login({onLogin}){
  const [u,setU]=useState("");const [p,setP]=useState("");const [err,setErr]=useState("");const [show,setShow]=useState(false);
  const attempt=()=>{const d=USERS[u.trim().toLowerCase()];if(d&&d.password===p)onLogin({username:u.trim().toLowerCase(),...d});else setErr("Usuario o contraseña incorrectos");};
  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:`linear-gradient(160deg,${DARK} 0%,#2d1010 100%)`,padding:16}}>
      <div style={{textAlign:"center",marginBottom:28,display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
        <div style={{width:120,height:120,borderRadius:24,overflow:"hidden",boxShadow:`0 0 48px rgba(232,38,42,.5)`}}>
          <img src={logoUrl} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="Fox"/>
        </div>
        <h1 style={{color:"#fff",fontSize:22,fontWeight:900,margin:0}}>Mallas y Alambres Fox</h1>
        <p style={{color:"#f87171",fontSize:14,margin:0}}>Sistema de Gestión de Producción · Bogotá</p>
      </div>
      <div style={{background:"#fff",borderRadius:20,padding:"28px 32px",boxShadow:"0 25px 50px rgba(0,0,0,.5)",width:"100%",maxWidth:420}}>
        <h2 style={{fontSize:17,fontWeight:700,color:"#1e293b",marginBottom:20,marginTop:0,textAlign:"center"}}>Iniciar sesión</h2>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:14,fontWeight:600,color:"#64748b",display:"block",marginBottom:5}}>Usuario</label>
          <input style={inp} value={u} onChange={e=>{setU(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&attempt()} autoComplete="username"/>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:14,fontWeight:600,color:"#64748b",display:"block",marginBottom:5}}>Contraseña</label>
          <div style={{position:"relative"}}>
            <input type={show?"text":"password"} style={{...inp,paddingRight:80}} value={p} onChange={e=>{setP(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&attempt()} autoComplete="current-password"/>
            <button onClick={()=>setShow(!show)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:14,fontWeight:600}}>{show?"Ocultar":"Mostrar"}</button>
          </div>
        </div>
        {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"9px 13px",color:"#dc2626",fontSize:14,marginBottom:14}}>⚠ {err}</div>}
        <button onClick={attempt} style={{...btnR,width:"100%",padding:"12px"}}>Ingresar al sistema</button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}*{box-sizing:border-box}`}</style>
    </div>
  );
}

// ═══ SHELL ═════════════════════════════════════════════════
function Shell({user,onLogout,orders,movimientos=[],inventario=[],remisiones=[],clientes=[]}){
  // tab init deferred below after isLogistica is defined
  const [modal,setModal]=useState(null);
  const [saving,setSaving]=useState(false);
  const isG=user.role==="gerencia";
  const isViewer=user.role==="viewer";
  const isLogistica=user.role==="logistica";
  const isVendedora=user.role==="vendedora";
  // ── PERMISOS CENTRALIZADOS (misma regla por rol, sin importar la sede) ──
  const canProd=isG||isVendedora;                 // crear/asignar/completar/editar productos
  const canEditDatos=isG||isVendedora;            // editar nombre + remisión
  const canDeliver=isG||isVendedora||isLogistica; // marcar entregado
  const canMov=isG||isVendedora||isLogistica;     // movimientos (todos menos la pantalla TV)
  const canDelete=isG;                            // eliminar órdenes
  const [tab,setTab]=useState(isLogistica?"movimientos":"machines");

  // Auto-logout por inactividad (30 min). Viewer (TV) nunca cierra sesion.
  useEffect(()=>{
    if(isViewer) return;
    const TIMEOUT=30*60*1000;
    let timer=setTimeout(()=>{ alert("Sesion cerrada por inactividad (30 min)."); onLogout(); },TIMEOUT);
    const reset=()=>{ clearTimeout(timer); timer=setTimeout(()=>{ alert("Sesion cerrada por inactividad (30 min)."); onLogout(); },TIMEOUT); };
    const ev=["mousedown","keydown","touchstart","click"];
    ev.forEach(e=>window.addEventListener(e,reset,{passive:true}));
    return()=>{ clearTimeout(timer); ev.forEach(e=>window.removeEventListener(e,reset)); };
  },[isViewer,onLogout]);

  // Todas las órdenes que NO están completadas (al menos 1 item pendiente)
  const queueOrders=orders.filter(o=>deriveOrderStatus(normalizeItems(o))!=="completed");
  // Órdenes totalmente completadas
  const doneOrders=orders.filter(o=>deriveOrderStatus(normalizeItems(o))==="completed");
  // Producidas y ya entregadas (completadas) vs producidas sin entregar (terminadas)
  const entregadasCount=doneOrders.filter(o=>o.estadoEntrega==="entregado").length;
  const terminadasCount=doneOrders.length-entregadasCount;
  // Número de items activos en total
  const activeItemCount=orders.reduce((acc,o)=>acc+normalizeItems(o).filter(it=>it.status==="active").length,0);

  const withSave=async fn=>{setSaving(true);try{await fn();}catch(e){alert("Error al guardar: "+e.message);}finally{setSaving(false);}};

  // Devuelve el arreglo de logs de una orden + nuevas entradas
  const withLogs=(o,...entries)=>[...(Array.isArray(o?.logs)?o.logs:[]),...entries];

  const createOrder=async d=>{
    if(orders.find(o=>o.orden===d.orden)) return "Ya existe una orden con este número";
    await withSave(()=>setDoc(doc(db,"orders",d.orden),{
      ...d,
      remision:d.remision||"",
      vendedora:user.username,vendedoraName:user.name,
      status:"queue",timestamp:Date.now(),completedAt:null,
      estadoEntrega:"pendiente",fechaEntrega:null,
      logs:[makeLog(user,"Creó la orden",d.remision?`Remisión: ${d.remision}`:"")],
    }));
    // Crea/actualiza el cliente automáticamente (salvo órdenes de stock)
    if(d.cliente&&!esStockCliente(d.cliente)) await upsertCliente({nombre:d.cliente});
    return null;
  };

  // Edición ligera de nombre + remisión (disponible para todos, con log)
  const quickEditOrder=async(orden,{cliente,remision})=>{
    const o=orders.find(x=>String(x.orden)===String(orden));
    if(!o) return;
    const cambios=[];
    if((o.cliente||"")!==(cliente||"")) cambios.push(`Cliente: "${o.cliente||"—"}" → "${cliente||"—"}"`);
    if((o.remision||"")!==(remision||"")) cambios.push(`Remisión: "${o.remision||"—"}" → "${remision||"—"}"`);
    if(cambios.length===0) return;
    await withSave(()=>updateDoc(doc(db,"orders",String(orden)),{
      cliente,remision,
      logs:withLogs(o,makeLog(user,"Editó datos de la orden",cambios.join(" · "))),
    }));
    if(cliente&&!esStockCliente(cliente)) await upsertCliente({nombre:cliente});
  };

  // Marca la entrega (entregado / pendiente) con fecha y log
  const setEntrega=async(orden,estado)=>{
    const o=orders.find(x=>String(x.orden)===String(orden));
    if(!o) return;
    const entregado=estado==="entregado";
    await withSave(()=>updateDoc(doc(db,"orders",String(orden)),{
      estadoEntrega:entregado?"entregado":"pendiente",
      fechaEntrega:entregado?Date.now():null,
      logs:withLogs(o,makeLog(user,entregado?"Marcó como entregado":"Revirtió entrega")),
    }));
  };

  const assignItem=async(orden,itemIndex,machineId)=>{
    const m=MACHINES.find(x=>x.id===machineId);
    const o=orders.find(x=>x.orden===orden);
    const items=normalizeItems(o).map((it,i)=>
      i===itemIndex?{...it,status:"active",machineId,machineLabel:m.label,assignedAt:Date.now()}:it
    ).map(({_key:_k,...rest})=>rest);
    await withSave(()=>updateDoc(doc(db,"orders",orden),{items,status:deriveOrderStatus(items)}));
  };

  // Asignar múltiples items de una sola orden en un solo write (fix lag bug)
  const assignMultipleItems=async(orden,selMap)=>{
    const o=orders.find(x=>x.orden===orden);
    const now=Date.now();
    const items=normalizeItems(o).map((it,i)=>{
      const machineId=selMap[i];
      if(machineId){
        const m=MACHINES.find(x=>x.id===machineId);
        return {...it,status:"active",machineId,machineLabel:m?.label||machineId,assignedAt:now};
      }
      return it;
    }).map(({_key:_k,...rest})=>rest);
    await withSave(()=>updateDoc(doc(db,"orders",orden),{items,status:deriveOrderStatus(items)}));
  };

  const completeItem=async(orden,itemIndex)=>{
    const ts=Date.now();
    const o=orders.find(x=>String(x.orden)===String(orden));
    if(!o) return;
    const items=normalizeItems(o).map((it,i)=>
      i===itemIndex?{...it,status:"completed",completedAt:ts}:it
    ).map(({_key:_k,...rest})=>rest);
    const newStatus=deriveOrderStatus(items);
    // completedAt: si todos completados usa ts, si ya habia fecha la mantiene, sino busca en items
    const existingCompletedAt=o.completedAt||items.map(it=>it.completedAt).filter(Boolean).sort((a,b)=>b-a)[0]||null;
    await withSave(()=>updateDoc(doc(db,"orders",String(orden)),{
      items,status:newStatus,
      completedAt:newStatus==="completed"?ts:existingCompletedAt,
    }));
  };

  const returnItemToQueue=async(orden,itemIndex)=>{
    const o=orders.find(x=>x.orden===orden);
    const items=normalizeItems(o).map((it,i)=>
      i===itemIndex?{...it,status:"queue",machineId:null,machineLabel:null,assignedAt:null}:it
    ).map(({_key:_k,...rest})=>rest);
    await withSave(()=>updateDoc(doc(db,"orders",orden),{items,status:deriveOrderStatus(items)}));
  };

  const removeOrder=async orden=>{ await withSave(()=>deleteDoc(doc(db,"orders",orden))); };
  const editOrder=async(orden,changes)=>{
    const o=orders.find(x=>String(x.orden)===String(orden));
    await withSave(()=>updateDoc(doc(db,"orders",String(orden)),{
      ...changes,
      logs:withLogs(o,makeLog(user,"Editó la orden (productos/datos)")),
    }));
    if(changes.cliente&&!esStockCliente(changes.cliente)) await upsertCliente({nombre:changes.cliente});
  };
  const createMovimiento=async(data)=>{
    const num="MOV-"+String(movimientos.length+1).padStart(3,"0");
    const id="mov_"+Date.now();
    const mov={
      id,numero:num,...data,
      estado:"enviado",
      creadoPor:user.username,
      creadoPorNombre:user.name,
      timestamp:Date.now(),
      fechaRecibo:null,
      recibidoPor:null,
      alertaDiscrepancia:false,
      alertaResuelta:false,
    };
    await withSave(()=>setDoc(doc(db,"movimientos",id),mov));
  };

  const recibirMovimiento=async(id,itemsRecibidos)=>{
    const mov=movimientos.find(m=>m.id===id);
    if(!mov)return;
    const hasDiscrep=itemsRecibidos.some((it,i)=>
      Number(it.cantidadRecibida)!==Number(mov.items[i].cantidadEnviada)
    );
    const updatedItems=mov.items.map((it,i)=>({
      ...it,
      cantidadRecibida:Number(itemsRecibidos[i].cantidadRecibida),
      aprobado:true,
    }));
    await withSave(()=>updateDoc(doc(db,"movimientos",id),{
      estado:hasDiscrep?"discrepancia":"recibido",
      items:updatedItems,
      fechaRecibo:Date.now(),
      recibidoPor:user.name,
      alertaDiscrepancia:hasDiscrep,
      alertaResuelta:false,
    }));
  };

  const resolverAlerta=async(id)=>{
    if(!isG)return;
    await withSave(()=>updateDoc(doc(db,"movimientos",id),{alertaResuelta:true,alertaDiscrepancia:false}));
  };

  const editarMovimiento=async(id,nuevosDatos)=>{
    await withSave(()=>updateDoc(doc(db,"movimientos",id),{
      items:nuevosDatos.items,
      notas:nuevosDatos.notas,
    }));
  };

  // ── INVENTARIO ─────────────────────────────────────────────
  const createProducto=async d=>{
    if(inventario.find(p=>p.nombre?.trim().toLowerCase()===d.nombre.trim().toLowerCase()))
      return "Ya existe un producto con ese nombre";
    const id="inv_"+Date.now();
    await withSave(()=>setDoc(doc(db,"inventario",id),{
      id, nombre:d.nombre.trim(),
      categoria:d.categoria||"Otro", calibre:d.calibre||"", medida:d.medida||"", color:d.color||"",
      unidad:d.unidad, origen:d.origen, minimo:Number(d.minimo)||0,
      stock:{ "Centro":0, "Santa Lucia":0, "La Granja":0 },
      mov:[{ts:Date.now(),tipo:"alta",sede:"—",cant:0,motivo:"Producto creado",usuario:user.name}],
      creadoPor:user.name, timestamp:Date.now(),
    }));
    return null;
  };
  const editProducto=async(id,changes)=>{ await withSave(()=>updateDoc(doc(db,"inventario",id),{...changes,minimo:Number(changes.minimo)||0})); };
  const deleteProducto=async id=>{ await withSave(()=>deleteDoc(doc(db,"inventario",id))); };
  const moverInventario=async(id,{sede,cant,tipo,motivo})=>{
    const p=inventario.find(x=>x.id===id);
    if(!p) return;
    const q=Math.abs(Number(cant)||0);
    if(q<=0) return;
    const delta = tipo==="salida" ? -q : q;
    const actual=Number(p.stock?.[sede])||0;
    const nuevoStock={ ...(p.stock||{}), [sede]: Math.max(0, actual+delta) };
    const entry={ ts:Date.now(), tipo, sede, cant:q, motivo:motivo||"", usuario:user.name };
    const mov=[...(Array.isArray(p.mov)?p.mov:[]), entry].slice(-120);
    await withSave(()=>updateDoc(doc(db,"inventario",id),{stock:nuevoStock, mov}));
  };
  // Productos con stock en o por debajo del mínimo (para alertas)
  const lowStock=[];
  inventario.forEach(p=>{ if((p.minimo||0)>0) SEDES.forEach(s=>{ if((Number(p.stock?.[s])||0)<=p.minimo) lowStock.push({producto:p,sede:s}); }); });

  // ── VENTAS / REMISIONES / COTIZACIONES ─────────────────────
  const nextNumero=tipo=>{
    const base=tipo==="remision"?REMISION_INICIAL:COTIZACION_INICIAL;
    const nums=remisiones.filter(d=>d.tipo===tipo).map(d=>Number(d.numero)||0);
    return Math.max(base-1,...(nums.length?nums:[base-1]))+1;
  };
  const upsertCliente=async cli=>{
    if(!cli||!cli.nombre) return;
    // Si el nombre ya corresponde a un cliente existente (por nombre o alias), enriquece ESE
    const canonical=findClienteByNombre(clientes,cli.nombre);
    const id=canonical?canonical.id:clienteId(cli.nombre);
    if(!id) return;
    const prev=canonical||{};
    const merged={
      id,
      nombre:(prev.nombre||cli.nombre).trim(),        // no reemplaza el nombre canónico por una variante
      aliases: prev.aliases||[],
      docTipo: cli.docTipo||prev.docTipo||"NIT",
      docNumero: cli.docNumero||prev.docNumero||"",
      telefono: cli.telefono||prev.telefono||"",
      email: cli.email||prev.email||"",
      direccion: cli.direccion||prev.direccion||"",
      updatedAt: Date.now(),
    };
    try{ await setDoc(doc(db,"clientes",id),merged,{merge:true}); }catch(e){ /* best-effort: no romper la orden/venta si falla */ }
  };
  // Fusiona clientes duplicados en uno principal (mantiene alias, embebe sus órdenes y ventas)
  const fusionarClientes=async(primaryId,dupeIds)=>{
    const primary=clientes.find(c=>c.id===primaryId);
    if(!primary) return;
    const dupes=clientes.filter(c=>dupeIds.includes(c.id)&&c.id!==primaryId);
    if(dupes.length===0) return;
    const aliasSet=new Set((primary.aliases||[]).map(String));
    dupes.forEach(d=>{ if(d.nombre) aliasSet.add(d.nombre); (d.aliases||[]).forEach(a=>aliasSet.add(a)); });
    const aliases=[...aliasSet].filter(n=>clienteId(n)&&clienteId(n)!==primary.id);
    const pick=f=>primary[f]||((dupes.find(d=>d[f])||{})[f])||"";
    await withSave(async()=>{
      await setDoc(doc(db,"clientes",primary.id),{
        ...primary,aliases,
        docTipo:primary.docTipo||pick("docTipo")||"NIT",
        docNumero:pick("docNumero"),telefono:pick("telefono"),email:pick("email"),direccion:pick("direccion"),
        updatedAt:Date.now(),
      },{merge:true});
      for(const d of dupes){ await deleteDoc(doc(db,"clientes",d.id)); }
    });
  };
  // Crea/actualiza clientes a partir de TODAS las órdenes y ventas ya registradas
  const sincronizarClientes=async()=>{
    const nombres=new Map();
    orders.forEach(o=>{ if(o.cliente&&!esStockCliente(o.cliente)) nombres.set(clienteId(o.cliente),o.cliente); });
    remisiones.forEach(d=>{ const n=d.cliente?.nombre; if(n) nombres.set(clienteId(n),n); });
    let creados=0;
    await withSave(async()=>{
      for(const [id,nombre] of nombres){
        if(!id) continue;
        if(clientes.find(c=>c.id===id)) continue; // ya existe
        await setDoc(doc(db,"clientes",id),{id,nombre:String(nombre).trim(),docTipo:"NIT",docNumero:"",telefono:"",email:"",direccion:"",updatedAt:Date.now()},{merge:true});
        creados++;
      }
    });
    alert(creados>0?`Se crearon ${creados} cliente(s) nuevos desde las órdenes y ventas.`:"Todos los clientes ya estaban sincronizados.");
  };
  const createDocumento=async d=>{
    const numero=nextNumero(d.tipo);
    const id=(d.tipo==="remision"?"rem_":"cot_")+Date.now();
    await withSave(async()=>{
      // Actualiza/crea el cliente (mini-CRM) con los datos capturados al imprimir
      await upsertCliente(d.cliente);
      // Descuenta del stock si es una remisión vendida desde inventario
      if(d.tipo==="remision"&&d.origen==="stock"){
        for(const it of d.items){
          if(!it.productoId) continue;
          const p=inventario.find(x=>x.id===it.productoId);
          if(!p) continue;
          const sede=it.sede||d.sede;
          const actual=Number(p.stock?.[sede])||0;
          const nuevoStock={...(p.stock||{}),[sede]:Math.max(0,actual-(Number(it.cantidad)||0))};
          const entry={ts:Date.now(),tipo:"salida",sede,cant:Number(it.cantidad)||0,motivo:`Remisión #${numero} · ${d.cliente?.nombre||""}`,usuario:user.name};
          const mov=[...(Array.isArray(p.mov)?p.mov:[]),entry].slice(-120);
          await updateDoc(doc(db,"inventario",p.id),{stock:nuevoStock,mov});
        }
      }
      await setDoc(doc(db,"remisiones",id),{
        id,tipo:d.tipo,numero,origen:d.origen||null,ordenRef:d.ordenRef||null,
        cliente:d.cliente||{},sede:d.sede||user.sede,items:d.items||[],
        subtotal:d.subtotal||0,iva:d.iva||{aplica:false,porc:0,valor:0},retefuente:d.retefuente||{aplica:false,porc:0,valor:0},
        total:d.total||0,abono:d.abono||0,saldo:d.saldo||0,
        creadoPor:user.username,creadoPorNombre:user.name,timestamp:Date.now(),
      });
    });
    return {numero,id};
  };

  // Pasar una orden terminada (no comprada) al inventario/stock
  const pasarOrdenAInventario=async(orden,asigns)=>{
    const o=orders.find(x=>String(x.orden)===String(orden));
    if(!o) return;
    await withSave(async()=>{
      for(const a of asigns){
        if(!a.productoId||!(Number(a.cant)>0)) continue;
        const p=inventario.find(x=>x.id===a.productoId);
        if(!p) continue;
        const actual=Number(p.stock?.[a.sede])||0;
        const nuevoStock={...(p.stock||{}),[a.sede]:actual+(Number(a.cant)||0)};
        const entry={ts:Date.now(),tipo:"entrada",sede:a.sede,cant:Number(a.cant)||0,motivo:`Orden #${orden} no comprada`,usuario:user.name};
        const mov=[...(Array.isArray(p.mov)?p.mov:[]),entry].slice(-120);
        await updateDoc(doc(db,"inventario",p.id),{stock:nuevoStock,mov});
      }
      await updateDoc(doc(db,"orders",String(orden)),{
        pasadaAInventario:true,
        logs:withLogs(o,makeLog(user,"Pasada a inventario","El cliente no compró; productos enviados al stock")),
      });
    });
  };

  const saveCliente=async cli=>{
    if(!cli?.id) return;
    await withSave(()=>setDoc(doc(db,"clientes",cli.id),{...cli,updatedAt:Date.now()},{merge:true}));
  };



  const movPendientes=movimientos.filter(m=>m.estado==="enviado"&&m.destino===user.sede&&!isG&&!isLogistica).length;
  const tabs=[
    {id:"machines",   label:"Máquinas",        count:activeItemCount},
    {id:"queue",      label:"Cola de Órdenes", count:queueOrders.length},
    {id:"history",    label:"Historial",       count:doneOrders.length},
    {id:"movimientos",label:"🚚 Movimientos",  count:movimientos.filter(m=>m.estado==="enviado"||m.estado==="discrepancia").length},
    {id:"inventario", label:"📦 Inventario",    count:lowStock.length},
    {id:"ventas",     label:"🧾 Ventas",         count:0},
    {id:"clientes",   label:"👤 Clientes",       count:0},
  ];

  return(
    <div style={{minHeight:"100vh",background:"#f1f5f9",fontFamily:"Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",WebkitFontSmoothing:"antialiased"}}>
      <div style={{background:DARK}}>
        <div style={{maxWidth:1280,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src={logoUrl} style={{width:38,height:38,borderRadius:9,flexShrink:0}} alt="Fox"/>
            <div>
              <div style={{fontSize:14,fontWeight:800,color:"#fff",lineHeight:1.2}}>Mallas y Alambres Fox</div>
              <div style={{fontSize:14,color:"#f87171"}}>Gestión de Producción · Bogotá <span style={{color:"#6b7280",fontSize:11,fontWeight:600,marginLeft:4}}>{APP_VERSION}</span></div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {saving&&<span style={{color:RED,fontSize:14}}>● Guardando...</span>}
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{user.name}</div>
              <div style={{fontSize:14,color:isG?"#fbbf24":"#93c5fd"}}>{isG?"Gerencia — Acceso total":isLogistica?"Logística — Movimientos":user.role==="viewer"?"Visualizador":`Vendedora · ${user.sede}`}</div>
            </div>
            <button onClick={onLogout} style={{background:RED,border:"none",color:"#fff",borderRadius:7,padding:"5px 12px",fontSize:14,fontWeight:700,cursor:"pointer"}}>Salir</button>
          </div>
        </div>
        <div style={{borderTop:"1px solid #262626",padding:"5px 0"}}>
          <div style={{maxWidth:1280,margin:"0 auto",padding:"0 16px",display:"flex",gap:18,fontSize:14,flexWrap:"wrap"}}>
            <span style={{color:"#4ade80"}}>● {MACHINES.filter(m=>!getMachineItem(m.id,orders)).length} libres</span>
            <span style={{color:"#f87171"}}>● {activeItemCount} items en producción</span>
            <span style={{color:"#60a5fa"}}>● {queueOrders.length} órdenes en cola</span>
            <span style={{color:"#f59e0b"}}>● {terminadasCount} terminadas (sin entregar)</span>
            <span style={{color:"#9ca3af"}}>● {entregadasCount} entregadas</span>
          </div>
        </div>
      </div>

      <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0"}}>
        <div style={{maxWidth:1280,margin:"0 auto",padding:"0 16px",display:"flex"}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"12px 14px",fontSize:14,fontWeight:600,border:"none",background:"none",cursor:"pointer",borderBottom:tab===t.id?`2px solid ${RED}`:"2px solid transparent",color:tab===t.id?RED:"#64748b",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}>
              {t.label}
              {t.count>0&&<span style={{background:tab===t.id?"#fef2f2":"#f1f5f9",color:tab===t.id?RED:"#64748b",borderRadius:999,padding:"1px 7px",fontSize:14,fontWeight:700}}>{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:1280,margin:"0 auto",padding:16}}>
        {tab==="machines"&&<MachinesTab machines={MACHINES} orders={orders} user={user} isG={isG} canProd={canProd}
          onItemClick={(ord,it,idx)=>canProd&&setModal({t:"complete",order:ord,item:it,itemIndex:idx})}
          onCompleteItem={(orden,idx)=>canProd&&completeItem(orden,idx)}
          onAssignFree={mid=>canProd&&setModal({t:"pickItem",machineId:mid})}
          onNew={()=>canProd&&setModal({t:"new"})}/>}
        {tab==="queue"&&<QueueTab orders={queueOrders} allOrders={orders} isG={isG}
          onNew={canProd?(()=>setModal({t:"new"})):null}
          onAssignOrder={canProd?(o=>setModal({t:"assignOrder",order:o})):null}
          onDel={canDelete?(r=>{if(window.confirm(`¿Confirmas eliminar la orden #${r}?`))removeOrder(r);}):null}
          onDetail={o=>setModal({t:"detail",order:o})}
          onQuickEdit={canEditDatos?(o=>setModal({t:"quickEdit",order:o})):null}
          canFullEdit={canProd}
          onSetEntrega={canDeliver?setEntrega:null}
          onEdit={o=>canProd&&setModal({t:"edit",order:o})}/>}
        {tab==="movimientos"&&<MovimientosTab movimientos={movimientos} user={user} isG={isG} canMov={canMov} onNew={()=>setModal({t:"newMov"})} onRecibir={m=>setModal({t:"recibirMov",mov:m})} onEditar={m=>setModal({t:"editarMov",mov:m})} onResolver={resolverAlerta}/>}
        {tab==="inventario"&&<InventarioTab inventario={inventario} orders={orders} lowStock={lowStock} user={user} isG={isG} canStock={!isViewer}          onNuevo={()=>isG&&setModal({t:"invNuevo"})}
          onEditar={p=>isG&&setModal({t:"invEditar",prod:p})}
          onEliminar={isG?(p=>{if(window.confirm(`¿Eliminar "${p.nombre}" del inventario?`))deleteProducto(p.id);}):null}
          onEntrada={p=>!isViewer&&setModal({t:"invMov",prod:p,tipo:"entrada"})}
          onSalida={p=>!isViewer&&setModal({t:"invMov",prod:p,tipo:"salida"})}
          onKardex={p=>setModal({t:"invKardex",prod:p})}/>}
        {tab==="ventas"&&<VentasTab remisiones={remisiones} user={user} canProd={canProd}
          onNueva={tipo=>canProd&&setModal({t:"nuevaVenta",tipo})}
          onImprimir={doc=>setModal({t:"verDoc",doc})}/>}
        {tab==="clientes"&&<ClientesTab clientes={clientes} remisiones={remisiones} orders={orders} isG={isG} canProd={canProd}
          onVer={c=>setModal({t:"clienteDetalle",cli:c})}
          onEditar={canProd?(c=>setModal({t:"cliente",cli:c})):null}
          onFusionar={isG?(()=>setModal({t:"fusionar"})):null}
          onSync={isG?sincronizarClientes:null}/>}
        {tab==="history"&&<HistoryTab orders={doneOrders} allOrders={orders} isG={isG}
          onDel={canDelete?(r=>{if(window.confirm(`¿Confirmas eliminar el registro #${r}?`))removeOrder(r);}):null}
          onDetail={o=>setModal({t:"detail",order:o})}
          onQuickEdit={canEditDatos?(o=>setModal({t:"quickEdit",order:o})):null}
          onPasarInv={!isViewer?(o=>setModal({t:"pasarInv",order:o})):null}
          onSetEntrega={canDeliver?setEntrega:null}/>}
      </div>

      {modal?.t==="new"         &&<NewOrderModal    user={user} orders={orders} clientes={clientes} onClose={()=>setModal(null)} onCreate={createOrder}/>}
      {modal?.t==="edit"        &&<EditOrderModal   order={modal.order} isG={isG} onClose={()=>setModal(null)} onSave={editOrder}/>}
      {modal?.t==="quickEdit"   &&<QuickEditModal   order={modal.order} onClose={()=>setModal(null)} onSave={quickEditOrder}/>}
      {modal?.t==="assignOrder" &&<AssignOrderModal order={modal.order} allOrders={orders} machines={MACHINES} user={user} isG={isG} onClose={()=>setModal(null)} onAssign={assignItem} onAssignMultiple={assignMultipleItems}/>}
      {modal?.t==="pickItem"    &&<PickItemModal    machineId={modal.machineId} orders={queueOrders} allOrders={orders} user={user} isG={isG} machines={MACHINES} onClose={()=>setModal(null)} onAssign={assignItem}/>}
      {modal?.t==="complete"    &&<CompleteItemModal order={modal.order} item={modal.item} itemIndex={modal.itemIndex} onClose={()=>setModal(null)} onComplete={completeItem} onReturn={returnItemToQueue}/>}
      {modal?.t==="detail"      &&<DetailModal      order={orders.find(o=>String(o.orden)===String(modal.order.orden))||modal.order} isG={isG}
          onClose={()=>setModal(null)}
          onQuickEdit={canEditDatos?(o=>setModal({t:"quickEdit",order:o})):null}
          onSetEntrega={canDeliver?setEntrega:null}/>}
      {modal?.t==="newMov"     &&<NewMovimientoModal user={user} movimientos={movimientos} onClose={()=>setModal(null)} onCreate={createMovimiento}/>}
      {modal?.t==="recibirMov" &&<RecibirMovimientoModal mov={modal.mov} user={user} onClose={()=>setModal(null)} onRecibir={recibirMovimiento}/>}
      {modal?.t==="editarMov" &&<EditarMovimientoModal mov={modal.mov} onClose={()=>setModal(null)} onSave={editarMovimiento}/>}
      {modal?.t==="invNuevo"  &&<ProductoModal onClose={()=>setModal(null)} onSave={createProducto}/>}
      {modal?.t==="invEditar" &&<ProductoModal prod={modal.prod} onClose={()=>setModal(null)} onSave={d=>editProducto(modal.prod.id,d)}/>}
      {modal?.t==="invMov"    &&<MovInventarioModal prod={modal.prod} tipo={modal.tipo} onClose={()=>setModal(null)} onSave={moverInventario}/>}
      {modal?.t==="invKardex" &&<KardexModal prod={modal.prod} onClose={()=>setModal(null)}/>}
      {modal?.t==="nuevaVenta"&&<NuevaVentaModal tipo={modal.tipo} user={user} inventario={inventario} orders={orders} clientes={clientes} onClose={()=>setModal(null)} onCreate={createDocumento} onDone={doc=>setModal({t:"verDoc",doc})}/>}
      {modal?.t==="verDoc"    &&<VerDocumentoModal doc={modal.doc} onClose={()=>setModal(null)}/>}
      {modal?.t==="pasarInv"  &&<PasarInventarioModal order={modal.order} inventario={inventario} onClose={()=>setModal(null)} onSave={pasarOrdenAInventario}/>}
      {modal?.t==="cliente"   &&<ClienteModal cli={modal.cli} onClose={()=>setModal(null)} onSave={saveCliente}/>}
      {modal?.t==="fusionar"  &&<FusionarClientesModal clientes={clientes} onClose={()=>setModal(null)} onMerge={fusionarClientes}/>}
      {modal?.t==="clienteDetalle"&&<ClienteDetalleModal cli={modal.cli} orders={orders} remisiones={remisiones} onClose={()=>setModal(null)} onEditar={canProd?(c=>setModal({t:"cliente",cli:c})):null} onVerOrden={o=>setModal({t:"detail",order:o})}/>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}*{box-sizing:border-box}`}</style>
    </div>
  );
}

// ═══ BADGES ════════════════════════════════════════════════
function ItemStatusBadge({item}){
  if(item.status==="completed") return <span style={{background:"#f0fdf4",color:"#15803d",borderRadius:999,padding:"1px 8px",fontSize:14,fontWeight:700}}>✓ Terminado</span>;
  if(item.status==="active")    return <span style={{background:"#fef2f2",color:RED,borderRadius:999,padding:"1px 8px",fontSize:14,fontWeight:700}}>{item.machineLabel||"Activo"}</span>;
  return <span style={{background:"#eff6ff",color:"#1d4ed8",borderRadius:999,padding:"1px 8px",fontSize:14,fontWeight:700}}>En Cola</span>;
}

function ProductoBadges({items}){
  if(!items||items.length===0) return null;
  const counts={};
  items.forEach(it=>{ const l=labelProducto(it.producto); counts[l]=(counts[l]||0)+1; });
  return(
    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
      {Object.entries(counts).map(([lbl,cnt])=>{
        const info=PRODUCTOS.find(p=>p.label===lbl)||{color:"#64748b",bg:"#f1f5f9"};
        return <span key={lbl} style={{background:info.bg,color:info.color,borderRadius:999,padding:"2px 9px",fontSize:14,fontWeight:700,whiteSpace:"nowrap"}}>{cnt>1?`${cnt}× `:""}{lbl}</span>;
      })}
    </div>
  );
}

// ═══ PESTAÑA MÁQUINAS ══════════════════════════════════════
// ═══ MOVIMIENTOS TAB ═══════════════════════════════════════
const MOV_ESTADOS = {
  enviado:     { label:"En tránsito", color:"#d97706", bg:"#fffbeb", border:"#fde68a" },
  recibido:    { label:"Recibido",    color:"#15803d", bg:"#f0fdf4", border:"#86efac" },
  discrepancia:{ label:"Discrepancia",color:"#dc2626", bg:"#fef2f2", border:"#fecaca" },
};

function MovimientosTab({movimientos,user,isG,canMov=true,onNew,onRecibir,onEditar,onResolver}){
  const isLogistica=user.role==="logistica";
  const [filtro,setFiltro]=useState("todos");
  const filtrados=filtro==="todos"?movimientos:movimientos.filter(m=>m.estado===filtro);
  const pendRecibir=movimientos.filter(m=>m.estado==="enviado"&&(isG||m.destino===user.sede));
  const discrepancias=movimientos.filter(m=>m.estado==="discrepancia"&&!m.alertaResuelta);

  return(
    <div>
      {/* Alertas discrepancia */}
      {discrepancias.length>0&&(
        <div style={{background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:12,padding:"12px 18px",marginBottom:18,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>🔴</span>
            <div>
              <div style={{fontWeight:700,color:"#dc2626",fontSize:15}}>⚠ {discrepancias.length} envío(s) con discrepancia</div>
              <div style={{fontSize:13,color:"#b91c1c"}}>Las cantidades recibidas no coinciden con las enviadas.</div>
            </div>
          </div>
          {isG&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {discrepancias.map(m=>(
              <button key={m.id} onClick={()=>onResolver(m.id)}
                style={{background:"#dc2626",border:"none",borderRadius:8,padding:"6px 14px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                Resolver #{m.numero}
              </button>
            ))}
          </div>}
        </div>
      )}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {["todos","enviado","recibido","discrepancia"].map(f=>(
            <button key={f} onClick={()=>setFiltro(f)}
              style={{background:filtro===f?"#1e293b":"#f8fafc",border:"1.5px solid",borderColor:filtro===f?"#1e293b":"#e2e8f0",borderRadius:8,padding:"5px 14px",cursor:"pointer",fontSize:13,fontWeight:600,color:filtro===f?"#fff":"#64748b"}}>
              {f==="todos"?"Todos":MOV_ESTADOS[f]?.label||f}
              {f!=="todos"&&<span style={{marginLeft:5,background:filtro===f?"rgba(255,255,255,.2)":"#e2e8f0",borderRadius:999,padding:"1px 6px",fontSize:12}}>
                {movimientos.filter(m=>m.estado===f).length}
              </span>}
            </button>
          ))}
        </div>
        {canMov&&<button onClick={onNew} style={{background:RED,border:"none",color:"#fff",borderRadius:10,padding:"8px 18px",fontSize:14,fontWeight:700,cursor:"pointer"}}>+ Nuevo Envío</button>}
      </div>

      {/* Lista */}
      {filtrados.length===0?(
        <div style={{textAlign:"center",padding:"48px 0",color:"#94a3b8",fontSize:15}}>No hay movimientos {filtro!=="todos"?`con estado "${MOV_ESTADOS[filtro]?.label||filtro}"`:""}</div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {filtrados.map(m=>{
            const est=MOV_ESTADOS[m.estado]||MOV_ESTADOS.enviado;
            const puedoRecibir=(isG||m.destino===user.sede)&&m.estado==="enviado";
            return(
              <div key={m.id} style={{background:"#fff",borderRadius:14,border:`1.5px solid ${m.alertaDiscrepancia&&!m.alertaResuelta?"#fca5a5":est.border}`,padding:"16px 20px",boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:12}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontSize:18,fontWeight:900,color:"#1e293b"}}>{m.numero}</span>
                      <span style={{background:est.bg,color:est.color,border:`1px solid ${est.border}`,borderRadius:999,padding:"2px 10px",fontSize:12,fontWeight:700}}>{est.label}</span>
                      {m.alertaDiscrepancia&&!m.alertaResuelta&&<span style={{background:"#fef2f2",color:"#dc2626",border:"1px solid #fecaca",borderRadius:999,padding:"2px 10px",fontSize:12,fontWeight:700}}>⚠ Discrepancia</span>}
                    </div>
                    <div style={{fontSize:14,color:"#475569"}}>
                      <strong>{m.origen}</strong> → <strong>{m.destino}</strong>
                      <span style={{color:"#94a3b8",marginLeft:10}}>{fmtDate(m.timestamp)}</span>
                    </div>
                    <div style={{fontSize:13,color:"#94a3b8",marginTop:2}}>Creado por {m.creadoPorNombre}</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    {puedoRecibir&&(
                      <button onClick={()=>onRecibir(m)}
                        style={{background:"#16a34a",border:"none",color:"#fff",borderRadius:9,padding:"7px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                        ✓ Registrar Recibo
                      </button>
                    )}
                    {m.estado==="enviado"&&(isG||isLogistica)&&(
                      <button onClick={()=>onEditar(m)}
                        style={{background:"#eff6ff",border:"1px solid #bfdbfe",color:"#1d4ed8",borderRadius:9,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                        ✏ Editar
                      </button>
                    )}
                    {m.estado==="recibido"&&m.fechaRecibo&&(
                      <span style={{fontSize:12,color:"#94a3b8",alignSelf:"center"}}>Recibido: {fmtDate(m.fechaRecibo)}</span>
                    )}
                  </div>
                </div>
                {/* Items table */}
                <div style={{background:"#f8fafc",borderRadius:10,overflow:"hidden",border:"1px solid #e2e8f0"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <thead>
                      <tr style={{background:"#f1f5f9"}}>
                        <th style={{padding:"7px 12px",textAlign:"left",color:"#64748b",fontWeight:700}}>Producto</th>
                        <th style={{padding:"7px 12px",textAlign:"left",color:"#64748b",fontWeight:700}}>Descripción</th>
                        <th style={{padding:"7px 12px",textAlign:"center",color:"#64748b",fontWeight:700}}>Enviado</th>
                        {m.estado!=="enviado"&&<th style={{padding:"7px 12px",textAlign:"center",color:"#64748b",fontWeight:700}}>Recibido</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {m.items.map((it,i)=>{
                        const diff=m.estado!=="enviado"?Number(it.cantidadRecibida)-Number(it.cantidadEnviada):0;
                        return(
                          <tr key={i} style={{borderTop:"1px solid #e2e8f0",background:diff<0?"#fef9f9":diff>0?"#f0fdf4":"#fff"}}>
                            <td style={{padding:"7px 12px",fontWeight:600,color:"#334155"}}>{MOV_PRODUCTOS.find(p=>p.id===it.producto)?.label||it.producto}</td>
                            <td style={{padding:"7px 12px",color:"#64748b"}}>{it.descripcion||"—"}</td>
                            <td style={{padding:"7px 12px",textAlign:"center",fontWeight:700}}>{it.cantidadEnviada} {it.unidad}</td>
                            {m.estado!=="enviado"&&<td style={{padding:"7px 12px",textAlign:"center",fontWeight:700,color:diff<0?"#dc2626":diff>0?"#16a34a":"#16a34a"}}>
                              {it.cantidadRecibida} {it.unidad}
                              {diff!==0&&<span style={{fontSize:11,marginLeft:4}}>{diff>0?`+${diff}`:diff}</span>}
                            </td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {m.notas&&<div style={{marginTop:8,fontSize:13,color:"#64748b"}}>📝 {m.notas}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══ NEW MOVIMIENTO MODAL ═══════════════════════════════════
function NewMovimientoModal({user,onClose,onCreate}){
  const [origen,setOrigen]=useState(user.sede==="Ambas Sedes"?"Centro":user.sede);
  const [destino,setDestino]=useState("");
  const [items,setItems]=useState([{producto:"",descripcion:"",cantidadEnviada:"",unidad:"rollos"}]);
  const [notas,setNotas]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);

  const addItem=()=>setItems(p=>[...p,{producto:"",descripcion:"",cantidadEnviada:"",unidad:"rollos"}]);
  const removeItem=i=>setItems(p=>p.filter((_,idx)=>idx!==i));
  const updateItem=(i,k,v)=>setItems(p=>p.map((x,idx)=>idx===i?{...x,[k]:v}:x));

  const submit=async()=>{
    if(!destino){setErr("Selecciona el destino");return;}
    if(destino===origen){setErr("Origen y destino no pueden ser iguales");return;}
    for(const it of items){
      if(!it.producto){setErr("Selecciona el producto en todos los items");return;}
      if(!it.cantidadEnviada||Number(it.cantidadEnviada)<=0){setErr("Ingresa la cantidad enviada en todos los items");return;}
    }
    setLoading(true);
    await onCreate({
      origen,destino,
      items:items.map(it=>({...it,cantidadEnviada:Number(it.cantidadEnviada),cantidadRecibida:null,aprobado:false})),
      notas:notas.trim(),
    });
    setLoading(false);onClose();
  };

  return(
    <Modal title="Nuevo Envío de Mercancía 🚚" onClose={onClose} maxWidth={600}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <div>
          <label style={{fontSize:14,fontWeight:600,color:"#64748b",display:"block",marginBottom:5}}>Origen *</label>
          <select style={inp} value={origen} onChange={e=>setOrigen(e.target.value)}>
            {SEDES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={{fontSize:14,fontWeight:600,color:"#64748b",display:"block",marginBottom:5}}>Destino *</label>
          <select style={inp} value={destino} onChange={e=>setDestino(e.target.value)}>
            <option value="">Seleccionar...</option>
            {SEDES.filter(s=>s!==origen).map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <label style={{fontSize:14,fontWeight:700,color:"#334155"}}>Productos a enviar ({items.length})</label>
        <button onClick={addItem} style={{background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:10,padding:"5px 12px",cursor:"pointer",color:GREEN,fontSize:13,fontWeight:700}}>+ Agregar</button>
      </div>

      {items.map((it,i)=>{
        const prod=MOV_PRODUCTOS.find(p=>p.id===it.producto);
        return(
          <div key={i} style={{background:"#f8fafc",borderRadius:10,padding:"12px",marginBottom:10,border:"1px solid #e2e8f0"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:700,color:"#64748b"}}>Item {i+1}</span>
              {items.length>1&&<button onClick={()=>removeItem(i)} style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:13}}>✕ Quitar</button>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>Producto *</label>
                <select style={{...inp,fontSize:13}} value={it.producto} onChange={e=>{
                  const p=MOV_PRODUCTOS.find(x=>x.id===e.target.value);
                  updateItem(i,"producto",e.target.value);
                  if(p) updateItem(i,"unidad",p.unidad);
                }}>
                  <option value="">Seleccionar...</option>
                  {MOV_PRODUCTOS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>Cantidad ({it.unidad||"unid"}) *</label>
                <input style={{...inp,fontSize:13}} type="number" min="1" value={it.cantidadEnviada} onChange={e=>updateItem(i,"cantidadEnviada",e.target.value)} placeholder="0"/>
              </div>
            </div>
            {prod?.conDesc&&(
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>Descripción</label>
                <input style={{...inp,fontSize:13}} value={it.descripcion} onChange={e=>updateItem(i,"descripcion",e.target.value)} placeholder="Calibre, medida, referencia..."/>
              </div>
            )}
          </div>
        );
      })}

      <div style={{marginBottom:14}}>
        <label style={{fontSize:14,fontWeight:600,color:"#64748b",display:"block",marginBottom:5}}>Notas</label>
        <input style={inp} value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Observaciones opcionales..."/>
      </div>

      {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 12px",color:"#dc2626",fontSize:13,marginBottom:12}}>⚠ {err}</div>}
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{...btnS,flex:1}}>Cancelar</button>
        <button onClick={submit} disabled={loading} style={{...btnR,flex:2}}>{loading?"Registrando...":"Registrar Envío 🚚"}</button>
      </div>
    </Modal>
  );
}

// ═══ RECIBIR MOVIMIENTO MODAL ═══════════════════════════════
function RecibirMovimientoModal({mov,user,onClose,onRecibir}){
  const [recibidos,setRecibidos]=useState(
    mov.items.map(it=>({...it,cantidadRecibida:String(it.cantidadEnviada)}))
  );
  const [loading,setLoading]=useState(false);

  const update=(i,v)=>setRecibidos(p=>p.map((x,idx)=>idx===i?{...x,cantidadRecibida:v}:x));

  const submit=async()=>{
    setLoading(true);
    await onRecibir(mov.id,recibidos);
    setLoading(false);onClose();
  };

  const hasDiscrepancia=recibidos.some((r,i)=>Number(r.cantidadRecibida)!==Number(mov.items[i].cantidadEnviada));

  return(
    <Modal title={`Recibir Envío ${mov.numero} 📦`} onClose={onClose} maxWidth={540}>
      <div style={{marginBottom:14,background:"#f8fafc",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#475569"}}>
        <strong>{mov.origen}</strong> → <strong>{mov.destino}</strong>
        <span style={{marginLeft:12,color:"#94a3b8"}}>{fmtDate(mov.timestamp)}</span>
      </div>
      <p style={{fontSize:13,color:"#64748b",marginBottom:14}}>Verifica las cantidades recibidas. Si hay diferencia, quedará registrada como discrepancia.</p>

      {mov.items.map((it,i)=>{
        const prod=MOV_PRODUCTOS.find(p=>p.id===it.producto);
        const diff=Number(recibidos[i]?.cantidadRecibida||0)-Number(it.cantidadEnviada);
        return(
          <div key={i} style={{background:"#fff",border:`1.5px solid ${diff<0?"#fecaca":diff>0?"#86efac":"#e2e8f0"}`,borderRadius:10,padding:"12px 14px",marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:"#1e293b"}}>{prod?.label||it.producto}</div>
                {it.descripcion&&<div style={{fontSize:12,color:"#94a3b8"}}>{it.descripcion}</div>}
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:12,color:"#94a3b8"}}>Enviado</div>
                <div style={{fontWeight:800,fontSize:16}}>{it.cantidadEnviada} {it.unidad}</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <label style={{fontSize:13,fontWeight:600,color:"#64748b",whiteSpace:"nowrap"}}>Cantidad recibida:</label>
              <input
                style={{...inp,fontSize:14,fontWeight:700,maxWidth:100,textAlign:"center",borderColor:diff<0?"#fca5a5":diff>0?"#86efac":"#e2e8f0"}}
                type="number" min="0"
                value={recibidos[i]?.cantidadRecibida||""}
                onChange={e=>update(i,e.target.value)}
              />
              <span style={{fontSize:12,color:"#94a3b8"}}>{it.unidad}</span>
              {diff!==0&&<span style={{fontSize:13,fontWeight:700,color:diff<0?"#dc2626":"#16a34a"}}>{diff>0?"+":""}{diff}</span>}
            </div>
          </div>
        );
      })}

      {hasDiscrepancia&&(
        <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#dc2626",fontWeight:600}}>
          ⚠ Hay diferencias en las cantidades. Se generará una alerta para gerencia.
        </div>
      )}
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{...btnS,flex:1}}>Cancelar</button>
        <button onClick={submit} disabled={loading} style={{...btnR,flex:2}}>{loading?"Registrando...":"Confirmar Recibo"}</button>
      </div>
    </Modal>
  );
}


// ═══ EDITAR MOVIMIENTO MODAL ════════════════════════════════
function EditarMovimientoModal({mov,onClose,onSave}){
  const [items,setItems]=useState(mov.items.map(it=>({...it})));
  const [notas,setNotas]=useState(mov.notas||"");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");

  const updateItem=(i,k,v)=>setItems(p=>p.map((x,idx)=>idx===i?{...x,[k]:v}:x));
  const addItem=()=>setItems(p=>[...p,{producto:"",descripcion:"",cantidadEnviada:"",unidad:"unid",cantidadRecibida:null,aprobado:false}]);
  const removeItem=i=>setItems(p=>p.filter((_,idx)=>idx!==i));

  const submit=async()=>{
    for(const it of items){
      if(!it.producto){setErr("Selecciona el producto en todos los items");return;}
      if(!it.cantidadEnviada||Number(it.cantidadEnviada)<=0){setErr("Ingresa la cantidad en todos los items");return;}
    }
    setLoading(true);
    await onSave(mov.id,{
      items:items.map(it=>({...it,cantidadEnviada:Number(it.cantidadEnviada)})),
      notas:notas.trim(),
    });
    setLoading(false);onClose();
  };

  return(
    <Modal title={`Editar Envío ${mov.numero} ✏`} onClose={onClose} maxWidth={600}>
      <div style={{marginBottom:12,background:"#f8fafc",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#475569"}}>
        <strong>{mov.origen}</strong> → <strong>{mov.destino}</strong>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <label style={{fontSize:14,fontWeight:700,color:"#334155"}}>Productos ({items.length})</label>
        <button onClick={addItem} style={{background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:10,padding:"5px 12px",cursor:"pointer",color:GREEN,fontSize:13,fontWeight:700}}>+ Agregar</button>
      </div>

      {items.map((it,i)=>{
        const prod=MOV_PRODUCTOS.find(p=>p.id===it.producto);
        return(
          <div key={i} style={{background:"#f8fafc",borderRadius:10,padding:"12px",marginBottom:10,border:"1px solid #e2e8f0"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:700,color:"#64748b"}}>Item {i+1}</span>
              {items.length>1&&<button onClick={()=>removeItem(i)} style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:13}}>✕ Quitar</button>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>Producto *</label>
                <select style={{...inp,fontSize:13}} value={it.producto} onChange={e=>{
                  const p=MOV_PRODUCTOS.find(x=>x.id===e.target.value);
                  updateItem(i,"producto",e.target.value);
                  if(p) updateItem(i,"unidad",p.unidad);
                }}>
                  <option value="">Seleccionar...</option>
                  {MOV_PRODUCTOS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>Cantidad ({it.unidad||"unid"}) *</label>
                <input style={{...inp,fontSize:13}} type="number" min="1" value={it.cantidadEnviada} onChange={e=>updateItem(i,"cantidadEnviada",e.target.value)} placeholder="0"/>
              </div>
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>Descripción</label>
              <input style={{...inp,fontSize:13}} value={it.descripcion||""} onChange={e=>updateItem(i,"descripcion",e.target.value)} placeholder="Calibre, medida, referencia..."/>
            </div>
          </div>
        );
      })}

      <div style={{marginBottom:14}}>
        <label style={{fontSize:14,fontWeight:600,color:"#64748b",display:"block",marginBottom:5}}>Notas</label>
        <input style={inp} value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Observaciones opcionales..."/>
      </div>

      {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 12px",color:"#dc2626",fontSize:13,marginBottom:12}}>⚠ {err}</div>}
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{...btnS,flex:1}}>Cancelar</button>
        <button onClick={submit} disabled={loading} style={{...btnR,flex:2}}>{loading?"Guardando...":"Guardar Cambios"}</button>
      </div>
    </Modal>
  );
}


function MachinesTab({machines,orders,user,isG,canProd,onItemClick,onCompleteItem,onAssignFree,onNew}){
  const canRename=user.username==="natalia";
  const [names,setNames]=useState(()=>Object.fromEntries(machines.map(m=>[m.id,m.name])));
  const [editing,setEditing]=useState(null);

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"9px 14px",fontSize:14,color:"#991b1b",flex:1}}>
          Cada máquina puede tener <strong>múltiples productos activos</strong>. Clic en máquina <strong>ROJA</strong> para finalizar productos. Clic en <strong>VERDE</strong> para asignar.
          {canProd&&!isG&&<span style={{display:"block",marginTop:4}}>Puedes asignar a máquinas de ambas sedes.</span>}
        </div>
        {canProd&&<button onClick={onNew} style={btnR}>+ Nueva Orden</button>}
      </div>
      {["Centro","Santa Lucia"].map(sede=>(
        <div key={sede} style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <div style={{width:4,height:20,background:RED,borderRadius:2}}/>
            <h2 style={{margin:0,fontSize:16,fontWeight:700,color:"#334155"}}>Sede {sede}</h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:12}}>
            {machines.filter(m=>m.sede===sede).map(m=>{
              const entries=getMachineItems(m.id,orders);
              const busy=entries.length>0;
              const puedeAsignar=isG||user.role==="vendedora"; // vendedoras y gerencia: cualquier sede
              const itemsEnCola=orders.reduce((acc,o)=>acc+normalizeItems(o).filter(it=>it.status==="queue").length,0);
              const displayName=names[m.id]||m.name;
              return <MachCard key={m.id} machine={{...m,name:displayName}} entries={entries} busy={busy}
                itemsEnCola={itemsEnCola} puedeAsignar={puedeAsignar}
                canRename={canRename} editing={editing===m.id}
                onStartEdit={()=>setEditing(m.id)}
                onSaveName={v=>{setNames(n=>({...n,[m.id]:v}));setEditing(null);}}
                onCancelEdit={()=>setEditing(null)}
                onItemsDone={(doneList)=>doneList.forEach(e=>onCompleteItem(e.order.orden,e.itemIndex))}
                onAssignFree={()=>onAssignFree(m.id)}/>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function MachCard({machine,entries,busy,itemsEnCola,puedeAsignar,canRename,editing,onStartEdit,onSaveName,onCancelEdit,onItemsDone,onAssignFree}){
  const [hover,setHover]=useState(false);
  const [checked,setChecked]=useState({});
  const [nameVal,setNameVal]=useState(machine.name);
  const [showList,setShowList]=useState(false);

  const toggleCheck=idx=>setChecked(c=>({...c,[idx]:!c[idx]}));
  const checkedCount=Object.values(checked).filter(Boolean).length;

  const handleConfirm=()=>{
    const toComplete=entries.filter((_,i)=>checked[i]);
    if(toComplete.length===0) return;
    onItemsDone(toComplete);
    setChecked({});
  };

  return(
    <div onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{border:`2px solid ${busy?RED:"#4ade80"}`,borderRadius:16,overflow:"hidden",background:"#fff",
        boxShadow:busy&&hover?`0 8px 24px rgba(232,38,42,.2)`:"none",transition:"box-shadow .15s"}}>
      {/* Cabecera */}
      <div style={{background:busy?RED:GREEN,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
          <div style={{width:28,height:28,background:"rgba(255,255,255,.2)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:"#fff",fontSize:14}}>M</div>
          <div style={{flex:1}}>
            {editing?(
              <div style={{display:"flex",gap:4}}>
                <input autoFocus value={nameVal} onChange={e=>setNameVal(e.target.value)}
                  style={{fontSize:14,fontWeight:700,border:"none",borderRadius:6,padding:"2px 6px",flex:1}}/>
                <button onClick={()=>onSaveName(nameVal)} style={{background:"#fff",border:"none",borderRadius:6,padding:"2px 6px",cursor:"pointer",color:GREEN,fontWeight:700,fontSize:14}}>✓</button>
                <button onClick={onCancelEdit} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:6,padding:"2px 6px",cursor:"pointer",color:"#fff",fontSize:14}}>✕</button>
              </div>
            ):(
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{color:"#fff",fontWeight:700,fontSize:14}}>{machine.name} · {machine.label}</div>
                {canRename&&<button onClick={onStartEdit} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:4,padding:"1px 5px",cursor:"pointer",color:"#fff",fontSize:14}}>✏</button>}
              </div>
            )}
            <div style={{color:"rgba(255,255,255,.75)",fontSize:14}}>Sede {machine.sede}</div>
          </div>
        </div>
        <span style={{background:"rgba(0,0,0,.22)",color:"#fff",borderRadius:999,padding:"2px 10px",fontSize:14,fontWeight:700,whiteSpace:"nowrap"}}>
          {busy?`${entries.length} ACTIVO${entries.length>1?"S":""}` : "LIBRE"}
        </span>
      </div>
      {/* Cuerpo */}
      <div style={{padding:14}}>
        {busy?(
          <>
            {/* Lista de productos activos con checkboxes */}
            <div style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:14,fontWeight:700,color:"#334155"}}>Productos en producción:</span>
                <button onClick={()=>setShowList(!showList)} style={{background:"none",border:"none",fontSize:14,color:RED,cursor:"pointer",fontWeight:600}}>
                  {showList?"Ocultar ▲":"Ver lista ▼"}
                </button>
              </div>
              {/* Siempre muestra resumen */}
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:6}}>
                {entries.map((e,i)=>{
                  const info=infoProducto(e.item.producto);
                  return <span key={i} style={{background:info.bg,color:info.color,borderRadius:999,padding:"2px 8px",fontSize:14,fontWeight:700}}>{labelProducto(e.item.producto)}</span>;
                })}
              </div>
              {/* Lista expandible con checkboxes */}
              {showList&&(
                <div style={{background:"#f8fafc",borderRadius:10,padding:10,border:"1px solid #e2e8f0"}}>
                  {entries.map((e,i)=>{
                    const info=infoProducto(e.item.producto);
                    return(
                      <div key={i} onClick={()=>toggleCheck(i)}
                        style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 6px",borderRadius:8,marginBottom:4,
                          background:checked[i]?"#f0fdf4":"#fff",border:`1px solid ${checked[i]?"#86efac":"#e2e8f0"}`,cursor:"pointer"}}>
                        <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${checked[i]?GREEN:"#cbd5e1"}`,
                          background:checked[i]?GREEN:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                          {checked[i]&&<span style={{color:"#fff",fontSize:14,fontWeight:900}}>✓</span>}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                            <span style={{background:info.bg,color:info.color,borderRadius:999,padding:"1px 7px",fontSize:14,fontWeight:700}}>{labelProducto(e.item.producto)}</span>
                            <span style={{fontSize:14,color:"#94a3b8"}}>#{e.order.orden}</span>
                          </div>
                          <div style={{fontSize:14,color:"#475569"}}>{e.order.cliente}</div>
                          <div style={{fontSize:14,color:"#94a3b8"}}>{resumenItem(e.item)}</div>
                        </div>
                      </div>
                    );
                  })}
                  {/* Botones de acción */}
                  <div style={{display:"flex",gap:6,marginTop:8}}>
                    <button onClick={handleConfirm} disabled={checkedCount===0}
                      style={{flex:1,background:checkedCount>0?GREEN:"#e2e8f0",border:"none",borderRadius:8,padding:"8px",
                        fontSize:14,fontWeight:700,color:checkedCount>0?"#fff":"#94a3b8",cursor:checkedCount>0?"pointer":"not-allowed"}}>
                      ✓ Terminar {checkedCount>0?`(${checkedCount})`:""}
                    </button>
                    {puedeAsignar&&<button onClick={e=>{e.stopPropagation();onAssignFree();}} disabled={!itemsEnCola}
                      style={{flex:1,background:itemsEnCola?"#eff6ff":"#e2e8f0",border:"none",borderRadius:8,padding:"8px",
                        fontSize:14,fontWeight:700,color:itemsEnCola?"#1d4ed8":"#94a3b8",cursor:itemsEnCola?"pointer":"not-allowed"}}>
                      + Agregar
                    </button>}
                  </div>
                </div>
              )}
              {!showList&&puedeAsignar&&(
                <button onClick={e=>{e.stopPropagation();onAssignFree();}} disabled={!itemsEnCola}
                  style={{width:"100%",background:itemsEnCola?"#eff6ff":"#e2e8f0",border:"1px solid #bfdbfe",borderRadius:8,padding:"6px",
                    fontSize:14,fontWeight:700,color:itemsEnCola?"#1d4ed8":"#94a3b8",cursor:itemsEnCola?"pointer":"not-allowed"}}>
                  + Agregar producto a esta máquina
                </button>
              )}
            </div>
          </>
        ):(
          <div style={{textAlign:"center",padding:"18px 0"}}>
            <div style={{fontSize:20,marginBottom:6,color:GREEN,fontWeight:900}}>LIBRE</div>
            <div style={{fontWeight:600,color:GREEN,fontSize:14,marginBottom:4}}>Máquina disponible</div>
            <div style={{fontSize:14,color:"#94a3b8",marginBottom:14}}>{itemsEnCola>0?`${itemsEnCola} producto(s) en cola`:"Sin productos en cola"}</div>
            {puedeAsignar?(
              <button onClick={e=>{e.stopPropagation();onAssignFree();}} disabled={!itemsEnCola}
                style={{width:"100%",background:itemsEnCola?GREEN:"#e2e8f0",border:"none",borderRadius:10,padding:"9px",fontSize:14,color:itemsEnCola?"#fff":"#94a3b8",cursor:itemsEnCola?"pointer":"not-allowed",fontWeight:700}}>
                {itemsEnCola?"+ Asignar producto":"Sin productos en cola"}
              </button>
            ):(
              <div style={{fontSize:14,color:"#94a3b8",background:"#f8fafc",borderRadius:8,padding:"8px"}}>Tu perfil no asigna producción</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ COLA DE ÓRDENES ═══════════════════════════════════════
function QueueTab({orders,allOrders,isG,onNew,onAssignOrder,onDel,onDetail,onEdit,onQuickEdit,canFullEdit,onSetEntrega}){
  const [q,setQ]=useState("");
  const fil=orders.filter(o=>String(o.orden).toLowerCase().includes(q.toLowerCase())||o.cliente.toLowerCase().includes(q.toLowerCase()));
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <input style={{...inp,flex:1,minWidth:200}} placeholder="Buscar por No. Orden o cliente..." value={q} onChange={e=>setQ(e.target.value)}/>
        {onNew&&<button onClick={onNew} style={btnR}>+ Nueva Orden</button>}
      </div>
      {fil.length===0?(
        <div style={{textAlign:"center",padding:"64px 0",color:"#94a3b8"}}>
          <div style={{fontSize:36,marginBottom:12,color:"#e2e8f0"}}>[ ]</div>
          <div style={{fontWeight:600,marginBottom:6}}>{q?"Sin resultados":"Cola vacía"}</div>
          {!q&&onNew&&<button onClick={onNew} style={{background:"none",border:"none",color:RED,fontSize:14,cursor:"pointer",textDecoration:"underline"}}>+ Crear primera orden</button>}
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {fil.map(o=>{
            const items=normalizeItems(o);
            const enCola=items.filter(it=>it.status==="queue").length;
            const activos=items.filter(it=>it.status==="active").length;
            const listos=items.filter(it=>it.status==="completed").length;
            return(
              <div key={o.orden} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:"14px 16px"}}>
                {/* Cabecera de la orden */}
                <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
                  <div style={{width:44,height:44,background:"#fef2f2",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontWeight:900,color:RED,fontSize:14}}>#</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                      <span style={{fontWeight:900,color:"#1e293b",fontSize:17}}>#{o.orden}</span>
                      {activos>0&&<span style={{background:"#fef2f2",color:RED,borderRadius:999,padding:"1px 8px",fontSize:14,fontWeight:700}}>{activos} en máquina</span>}
                      {enCola>0&&<span style={{background:"#eff6ff",color:"#1d4ed8",borderRadius:999,padding:"1px 8px",fontSize:14,fontWeight:700}}>{enCola} en cola</span>}
                      {listos>0&&<span style={{background:"#f0fdf4",color:"#15803d",borderRadius:999,padding:"1px 8px",fontSize:14,fontWeight:700}}>{listos} listos</span>}
                      <span style={{color:"#94a3b8",fontSize:14}}>{o.sede}</span>
                      {o.estadoEntrega==="entregado"&&<span style={{background:"#f0fdf4",color:"#15803d",border:"1px solid #86efac",borderRadius:999,padding:"1px 8px",fontSize:14,fontWeight:700}}>✓ Entregado</span>}
                    </div>
                    <div style={{fontWeight:600,color:"#475569",fontSize:14,marginBottom:6}}>{o.cliente}{o.remision?<span style={{color:"#94a3b8",fontWeight:500}}> · Rem: {o.remision}</span>:null}</div>
                    {/* Items de la orden con su estado individual */}
                    <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:4}}>
                      {items.map((it,i)=>{
                        const info=infoProducto(it.producto);
                        return(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                            <span style={{background:info.bg,color:info.color,borderRadius:999,padding:"1px 8px",fontSize:14,fontWeight:700,whiteSpace:"nowrap"}}>{labelProducto(it.producto)}</span>
                            <span style={{fontSize:14,color:"#64748b"}}>{resumenItem(it)}</span>
                            <ItemStatusBadge item={it}/>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{fontSize:14,color:"#94a3b8"}}>{o.vendedoraName} · {fmtDate(o.timestamp)}</div>
                  </div>
                  {/* Acciones */}
                  <div style={{display:"flex",gap:6,flexShrink:0,flexDirection:"column",alignItems:"stretch"}}>
                    {enCola>0&&onAssignOrder&&<button onClick={()=>onAssignOrder(o)} style={{...btnR,padding:"7px 14px",fontSize:14,whiteSpace:"nowrap"}}>Asignar productos</button>}
                    <button onClick={()=>onDetail(o)} style={{...btnS,padding:"7px 10px",fontSize:14}}>Ver detalle</button>
                    {onQuickEdit&&<button onClick={()=>onQuickEdit(o)} style={{background:"#eef2ff",border:"1px solid #c7d2fe",borderRadius:10,padding:"7px 10px",cursor:"pointer",color:"#4338ca",fontSize:14,fontWeight:600}}>Editar datos</button>}
                    {canFullEdit&&onEdit&&<button onClick={()=>onEdit(o)} style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:10,padding:"7px 10px",cursor:"pointer",color:"#0369a1",fontSize:14,fontWeight:600}}>Editar productos</button>}
                    {onSetEntrega&&(o.estadoEntrega==="entregado"
                      ?<button onClick={()=>onSetEntrega(o.orden,"pendiente")} style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"7px 10px",cursor:"pointer",color:"#b45309",fontSize:14,fontWeight:600}}>Revertir entrega</button>
                      :<button onClick={()=>onSetEntrega(o.orden,"entregado")} style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:10,padding:"7px 10px",cursor:"pointer",color:"#15803d",fontSize:14,fontWeight:700}}>Marcar entregado</button>)}
                    {isG&&onDel&&<button onClick={()=>onDel(o.orden)} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"7px 10px",cursor:"pointer",color:"#dc2626",fontSize:14}}>Eliminar</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══ HISTORIAL ═════════════════════════════════════════════
function HistoryTab({orders,allOrders,isG,onDel,onDetail,onQuickEdit,onSetEntrega,onPasarInv}){
  const [q,setQ]=useState("");const [view,setView]=useState("terminadas");
  const entregada=o=>o.estadoEntrega==="entregado";
  let base;
  if(view==="all") base=allOrders;
  else if(view==="completadas") base=orders.filter(entregada);      // producidas Y entregadas
  else base=orders.filter(o=>!entregada(o));                        // terminadas: producidas sin entregar
  const fil=base.filter(o=>String(o.orden).toLowerCase().includes(q.toLowerCase())||o.cliente.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>(b.completedAt||b.timestamp)-(a.completedAt||a.timestamp));
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <select value={view} onChange={e=>setView(e.target.value)} style={{...inp,flex:"0 0 auto",width:"auto"}}>
          <option value="terminadas">Terminadas (sin entregar)</option>
          <option value="completadas">Completadas (entregadas)</option>
          <option value="all">Todas las órdenes</option>
        </select>
        <input style={{...inp,flex:1,minWidth:180}} placeholder="Buscar por No. Orden o cliente..." value={q} onChange={e=>setQ(e.target.value)}/>
        {isG&&<button onClick={()=>exportExcel(fil,isG)} style={btnG}>Exportar Excel</button>}
      </div>
      <div style={{fontSize:14,color:"#94a3b8",marginBottom:10}}>{fil.length} registro(s)</div>
      {fil.length===0?(
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #e2e8f0",textAlign:"center",padding:"48px 0",color:"#94a3b8"}}><div style={{fontSize:32,marginBottom:8,color:"#e2e8f0"}}>[ ]</div><div>Sin registros</div></div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {fil.map(o=>{
            const items=normalizeItems(o);
            const st=orderStInfo(o);
            const compAt=o.completedAt?fmtDate(o.completedAt):fmtDate(items.map(it=>it.completedAt).filter(Boolean).sort((a,b)=>b-a)[0])||"—";
            return(
              <div key={o.orden} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"10px 14px"}}>
                {/* Línea 1: número + cliente + sede + estado (todo junto) */}
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                  <span style={{fontWeight:900,color:"#1e293b",fontSize:16}}>#{o.orden}</span>
                  <span style={{fontWeight:600,color:"#334155",fontSize:15}}>{o.cliente}</span>
                  <span style={{color:"#94a3b8",fontSize:13}}>· {o.sede}</span>
                  <span style={{background:st.bg,color:st.col,borderRadius:999,padding:"1px 9px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>{st.txt}</span>
                </div>
                {/* Línea 2: productos + meta */}
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:8}}>
                  <ProductoBadges items={items}/>
                  <span style={{fontSize:12,color:"#94a3b8"}}>{o.vendedoraName} · {compAt}{o.fechaEntrega?` · Entregado ${fmtDate(o.fechaEntrega)}`:""}{o.remision?` · Rem: ${o.remision}`:""}</span>
                </div>
                {/* Línea 3: acciones */}
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <button onClick={()=>onDetail(o)} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:"#64748b",fontSize:14}}>Ver detalle</button>
                  {onSetEntrega&&(o.estadoEntrega==="entregado"
                    ?<button onClick={()=>onSetEntrega(o.orden,"pendiente")} style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:"#b45309",fontSize:14,fontWeight:600}}>Revertir entrega</button>
                    :<button onClick={()=>onSetEntrega(o.orden,"entregado")} style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:"#15803d",fontSize:14,fontWeight:700}}>Marcar entregado</button>)}
                  {onQuickEdit&&<button onClick={()=>onQuickEdit(o)} style={{background:"#eef2ff",border:"1px solid #c7d2fe",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:"#4338ca",fontSize:14,fontWeight:600}}>Editar datos</button>}
                  {onPasarInv&&orderDisplayStatus(o)==="terminada"&&!o.pasadaAInventario&&<button onClick={()=>onPasarInv(o)} style={{background:"#f5f3ff",border:"1px solid #ddd6fe",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:"#7c3aed",fontSize:14,fontWeight:700}}>📦 Pasar a inventario</button>}
                  {o.pasadaAInventario&&<span style={{background:"#f5f3ff",color:"#7c3aed",border:"1px solid #ddd6fe",borderRadius:999,padding:"5px 10px",fontSize:13,fontWeight:700}}>En inventario</span>}
                  {isG&&onDel&&<button onClick={()=>onDel(o.orden)} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:"#dc2626",fontSize:14}}>Eliminar</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══ MODAL BASE / FIELD / NUMINP ═══════════════════════════
function Modal({title,onClose,children,maxWidth=560}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
      <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 25px 60px rgba(0,0,0,.4)",animation:"fadeIn .15s ease"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px 16px",borderBottom:"1px solid #f1f5f9"}}>
          <h3 style={{margin:0,fontSize:17,fontWeight:700,color:"#1e293b"}}>{title}</h3>
          <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:18,color:"#64748b",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>×</button>
        </div>
        <div style={{padding:"20px 24px"}}>{children}</div>
      </div>
    </div>
  );
}
function Field({label,children}){return <div style={{marginBottom:12}}><label style={{fontSize:14,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>{label}</label>{children}</div>;}
function NumInp({value,onChange,placeholder="",unit=""}){
  return(
    <div style={{position:"relative"}}>
      <input type="number" min="0" step="any" style={{...inp,paddingRight:unit?36:14,fontSize:14}} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>
      {unit&&<span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:"#94a3b8",fontSize:14,fontWeight:600}}>{unit}</span>}
    </div>
  );
}

// ═══ CAMPOS POR TIPO DE PRODUCTO ═══════════════════════════
function ItemFields({item,onChange}){
  const set=(k,v)=>onChange({...item,[k]:v});
  const metros=calcM2(item.ancho,item.alto);
  if(item.producto==="eslabonada"||item.producto==="pvc"){
    return(
      <div style={{marginTop:8}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <div><label style={{fontSize:14,color:"#94a3b8",display:"block",marginBottom:3}}>Ancho</label><NumInp value={item.ancho} onChange={v=>set("ancho",v)} placeholder="1.00" unit="m"/></div>
          <div><label style={{fontSize:14,color:"#94a3b8",display:"block",marginBottom:3}}>Alto / Largo</label><NumInp value={item.alto} onChange={v=>set("alto",v)} placeholder="3.00" unit="m"/></div>
        </div>
        <div style={{background:metros?"#f0fdf4":"#f8fafc",border:`1.5px solid ${metros?"#86efac":"#e2e8f0"}`,borderRadius:8,padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:14,color:"#64748b"}}>Metros cuadrados</span>
          <span style={{fontSize:16,fontWeight:900,color:metros?GREEN:"#94a3b8"}}>{metros?`${metros} m²`:"—"}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <Field label="Abertura *"><select style={{...inp,fontSize:14}} value={item.abertura||""} onChange={e=>set("abertura",e.target.value)}><option value="">Seleccionar...</option>{ABERTURA_SIZES.map(s=><option key={s} value={s}>{s}</option>)}</select></Field>
          <Field label="Calibre *"><NumInp value={item.calibre||""} onChange={v=>set("calibre",v)} placeholder="Ej: 11"/></Field>
        </div>
        {item.producto==="pvc"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <Field label="Calibre interno *"><NumInp value={item.calibreInterno||""} onChange={v=>set("calibreInterno",v)} placeholder="Ej: 9"/></Field>
            <Field label="Color *"><input style={{...inp,fontSize:14}} value={item.color||""} onChange={e=>set("color",e.target.value)} placeholder="Verde, Negro..."/></Field>
          </div>
        )}
      </div>
    );
  }
  if(item.producto==="postes"){
    return(
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginTop:8}}>
        <Field label="Calibre *"><NumInp value={item.calibre||""} onChange={v=>set("calibre",v)} placeholder="Ej: 14"/></Field>
        <Field label={'Grosor *'}><select style={{...inp,fontSize:14}} value={item.grosor||""} onChange={e=>set("grosor",e.target.value)}><option value="">Seleccionar...</option><option value="1.5">1½"</option><option value="2">2"</option></select></Field>
        <Field label="Largo (m) *"><NumInp value={item.largo||""} onChange={v=>set("largo",v)} placeholder="2.0" unit="m"/></Field>
        <Field label="Cantidad *"><NumInp value={item.cantidad||""} onChange={v=>set("cantidad",v)} placeholder="10" unit="un"/></Field>
      </div>
    );
  }
  return null;
}

// Campos de precio de venta (todos) y costo (solo gerencia). Ocultos en órdenes de inventario.
function PriceFields({item,onChange,isG}){
  const set=(k,v)=>onChange({...item,[k]:v});
  const pv=Number(item.precioVenta), co=Number(item.costo);
  const margen=(!isNaN(pv)&&!isNaN(co)&&item.precioVenta!==""&&item.costo!=="")?pv-co:null;
  return(
    <div style={{marginTop:10,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px 12px"}}>
      <div style={{fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:.4,marginBottom:8}}>Precios</div>
      <div style={{display:"grid",gridTemplateColumns:isG?"1fr 1fr":"1fr",gap:8}}>
        <div>
          <label style={{fontSize:13,color:"#64748b",display:"block",marginBottom:3,fontWeight:600}}>Precio de venta</label>
          <NumInp value={item.precioVenta} onChange={v=>set("precioVenta",v)} placeholder="0" unit="$"/>
        </div>
        {isG&&(
          <div>
            <label style={{fontSize:13,color:"#b45309",display:"block",marginBottom:3,fontWeight:700}}>Costo (solo gerencia)</label>
            <NumInp value={item.costo} onChange={v=>set("costo",v)} placeholder="0" unit="$"/>
          </div>
        )}
      </div>
      {isG&&margen!==null&&(
        <div style={{marginTop:8,fontSize:13,fontWeight:700,color:margen>=0?GREEN:"#dc2626"}}>
          Margen: {fmtMoney(margen)}{pv>0?` · ${Math.round((margen/pv)*100)}%`:""}
        </div>
      )}
    </div>
  );
}

function ItemCard({item,index,onUpdate,onRemove,canRemove,isG,esStock}){
  const info=item.producto?infoProducto(item.producto):{color:"#64748b",bg:"#f8fafc"};
  return(
    <div style={{border:`1.5px solid ${item.producto?info.color+"44":"#e2e8f0"}`,borderRadius:14,padding:14,marginBottom:10,background:item.producto?info.bg+"66":"#fafafa"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <span style={{fontSize:14,fontWeight:700,color:"#64748b"}}>Producto {index+1}</span>
        {canRemove&&<button onClick={onRemove} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,width:28,height:28,cursor:"pointer",color:"#dc2626",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,flexShrink:0}}>×</button>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:4}}>
        {PRODUCTOS.map(pr=>(
          <div key={pr.id} onClick={()=>onUpdate({...item,producto:pr.id,abertura:"",calibre:"",calibreInterno:"",color:"",ancho:"",alto:"",grosor:"",largo:"",cantidad:""})}
            style={{border:`2px solid ${item.producto===pr.id?pr.color:"#e2e8f0"}`,background:item.producto===pr.id?pr.bg:"#fff",borderRadius:8,padding:"7px 6px",textAlign:"center",cursor:"pointer",transition:"all .1s"}}>
            <div style={{fontWeight:700,color:item.producto===pr.id?pr.color:"#64748b",fontSize:14}}>{pr.label}</div>
          </div>
        ))}
      </div>
      <ItemFields item={item} onChange={onUpdate}/>
      {item.producto&&!esStock&&<PriceFields item={item} onChange={onUpdate} isG={isG}/>}
    </div>
  );
}

function validarItem(it){
  if(!it.producto) return "Selecciona el tipo de producto";
  if(it.producto==="eslabonada"||it.producto==="pvc"){
    if(!it.ancho||!it.alto) return `Ingresa las dimensiones en ${labelProducto(it.producto)}`;
    if(!it.abertura) return `Selecciona la abertura en ${labelProducto(it.producto)}`;
    if(!it.calibre) return `Ingresa el calibre en ${labelProducto(it.producto)}`;
    if(it.producto==="pvc"&&(!it.calibreInterno||!it.color)) return "Ingresa calibre interno y color en Malla PVC";
  }
  if(it.producto==="postes"){
    if(!it.calibre||!it.grosor||!it.largo||!it.cantidad) return `Completa todos los campos en ${labelProducto(it.producto)}`;
  }
  return null;
}
function enrichItem(it){
  const {_key:_,...rest}=it;
  // Normaliza precio de venta y costo: número si viene, "" si no
  const precioVenta = rest.precioVenta===""||rest.precioVenta==null ? "" : Number(rest.precioVenta);
  const costo       = rest.costo===""||rest.costo==null ? "" : Number(rest.costo);
  const base={...rest,precioVenta,costo,status:"queue",machineId:null,machineLabel:null,assignedAt:null,completedAt:null};
  if(rest.producto==="eslabonada"||rest.producto==="pvc") return {...base,metros:calcM2(rest.ancho,rest.alto)};
  return base;
}
const newEmptyItem=()=>({_key:Date.now()+Math.random(),producto:"",calibre:"",calibreInterno:"",color:"",ancho:"",alto:"",abertura:"",grosor:"",largo:"",cantidad:"",precioVenta:"",costo:""});

// ═══ NUEVA ORDEN ═══════════════════════════════════════════
function NewOrderModal({user,orders,clientes=[],onClose,onCreate}){
  const isG=user.role==="gerencia";
  const [orden,setOrden]=useState("");const [cliente,setCliente]=useState("");
  const [remision,setRemision]=useState("");
  const esStock=esStockCliente(cliente);
  const canSelectSede=true; // todas las vendedoras y gerencia pueden elegir sede destino
  const [sedeTarget,setSedeTarget]=useState(canSelectSede?"Centro":user.sede);
  const [items,setItems]=useState([newEmptyItem()]);
  const [err,setErr]=useState("");const [loading,setLoading]=useState(false);
  const updateItem=(i,v)=>setItems(prev=>prev.map((x,idx)=>idx===i?v:x));
  const itemsEndRef=useRef(null);
  const addItem=()=>{setItems(prev=>[...prev,newEmptyItem()]);setTimeout(()=>itemsEndRef.current?.scrollIntoView({behavior:"smooth"}),50);};
  const removeItem=i=>setItems(prev=>prev.filter((_,idx)=>idx!==i));

  // Calcula el siguiente # de orden para Stock revisando el historial
  const nextStockOrder=()=>{
    const stockOrders=(orders||[]).filter(o=>
      String(o.cliente||"").toLowerCase().includes("stock")||
      String(o.cliente||"").toLowerCase().includes("inventario")
    );
    if(stockOrders.length===0) return "001";
    const nums=stockOrders
      .map(o=>parseInt(String(o.orden).replace(/\D/g,""),10))
      .filter(n=>!isNaN(n));
    if(nums.length===0) return "001";
    const next=Math.max(...nums)+1;
    return String(next).padStart(3,"0");
  };

  const selectStock=()=>{
    setCliente("Inventario (Stock)");
    const next=nextStockOrder();
    setOrden(next);
  };
  const submit=async()=>{
    if(!orden.trim()){setErr("Ingresa el número de orden");return;}
    if(!cliente.trim()){setErr("Ingresa el nombre del cliente");return;}
    if(items.length===0){setErr("Agrega al menos un producto");return;}
    for(let it of items){const e=validarItem(it);if(e){setErr(e);return;}}
    setLoading(true);
    const cleanItems=items.map(it=>enrichItem(it));
    const r=await onCreate({orden:orden.trim(),cliente:cliente.trim(),remision:remision.trim(),sede:sedeTarget,items:cleanItems});
    setLoading(false);
    if(r)setErr(r); else onClose();
  };
  return(
    <Modal title="Crear Nueva Orden" onClose={onClose} maxWidth={580}>
      {canSelectSede?(
        <div style={{marginBottom:14}}>
          <label style={{fontSize:14,fontWeight:600,color:"#64748b",display:"block",marginBottom:6}}>Sede destino *</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {["Centro","Santa Lucia"].map(s=>(
              <div key={s} onClick={()=>setSedeTarget(s)} style={{border:`2px solid ${sedeTarget===s?RED:"#e2e8f0"}`,background:sedeTarget===s?"#fef2f2":"#fff",borderRadius:10,padding:"10px",textAlign:"center",cursor:"pointer"}}>
                <div style={{fontWeight:700,color:sedeTarget===s?RED:"#334155",fontSize:14}}>{s}</div>
              </div>
            ))}
          </div>
        </div>
      ):(
        <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"10px 14px",fontSize:14,color:"#991b1b",fontWeight:600,marginBottom:14}}>{user.sede}</div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div><label style={{fontSize:14,fontWeight:600,color:"#64748b",display:"block",marginBottom:5}}>No. Orden *</label><input style={inp} value={orden} onChange={e=>setOrden(e.target.value)}/></div>
        <div>
          <label style={{fontSize:14,fontWeight:600,color:"#64748b",display:"block",marginBottom:5}}>Cliente *</label>
          <input style={inp} value={cliente} onChange={e=>setCliente(e.target.value)} placeholder="Nombre del cliente" list="new-order-clientes"/>
          <datalist id="new-order-clientes">{clientes.map(c=><option key={c.id} value={c.nombre}/>)}</datalist>
          <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
            <button type="button" onClick={selectStock} style={{background:cliente==="Inventario (Stock)"?"#7c3aed":"#f5f3ff",border:"1.5px solid #7c3aed",borderRadius:8,padding:"4px 10px",cursor:"pointer",color:cliente==="Inventario (Stock)"?"#fff":"#7c3aed",fontSize:14,fontWeight:700}}>📦 Inventario (Stock)</button>
          </div>
        </div>
      </div>
      <div style={{marginBottom:14}}>
        <label style={{fontSize:14,fontWeight:600,color:"#64748b",display:"block",marginBottom:5}}>Remisión</label>
        <input style={inp} value={remision} onChange={e=>setRemision(e.target.value)} placeholder="No. de remisión (opcional)"/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <label style={{fontSize:14,fontWeight:700,color:"#334155"}}>Productos ({items.length})</label>
        <button onClick={addItem} style={{background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:10,padding:"6px 14px",cursor:"pointer",color:GREEN,fontSize:14,fontWeight:700}}>+ Agregar producto</button>
      </div>
      {esStock&&<div style={{background:"#f5f3ff",border:"1px solid #ddd6fe",borderRadius:10,padding:"8px 12px",fontSize:13,color:"#6d28d9",marginBottom:10}}>📦 Orden de inventario: no se piden precio de venta ni costo.</div>}
      {items.map((it,i)=><ItemCard key={it._key} item={it} index={i} onUpdate={v=>updateItem(i,v)} onRemove={()=>removeItem(i)} canRemove={items.length>1} isG={isG} esStock={esStock}/>)}
      <div ref={itemsEndRef}/>
      <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"9px 14px",fontSize:14,color:"#991b1b",marginBottom:12}}>
        Creado por: <strong>{user.name}</strong> · Sede: <strong>{sedeTarget}</strong>
      </div>
      {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 12px",color:"#dc2626",fontSize:14,marginBottom:12}}>⚠ {err}</div>}
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{...btnS,flex:1}}>Cancelar</button>
        <button onClick={submit} disabled={loading} style={{...btnR,flex:2}}>{loading?"Guardando...":"Crear orden"}</button>
      </div>
    </Modal>
  );
}

// ═══ EDICIÓN RÁPIDA (nombre + remisión) — todos los usuarios ═
function QuickEditModal({order,onClose,onSave}){
  const [cliente,setCliente]=useState(order.cliente||"");
  const [remision,setRemision]=useState(order.remision||"");
  const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  const submit=async()=>{
    if(!cliente.trim()){setErr("El cliente no puede quedar vacío");return;}
    setLoading(true);
    await onSave(order.orden,{cliente:cliente.trim(),remision:remision.trim()});
    setLoading(false);onClose();
  };
  return(
    <Modal title={`Editar datos — Orden #${order.orden}`} onClose={onClose} maxWidth={480}>
      <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"9px 14px",fontSize:13,color:"#1d4ed8",marginBottom:14}}>
        Cambia el nombre del cliente y la remisión. Cada cambio queda registrado en el historial de la orden.
      </div>
      <div style={{marginBottom:12}}>
        <label style={{fontSize:14,fontWeight:600,color:"#64748b",display:"block",marginBottom:5}}>Cliente</label>
        <input style={inp} value={cliente} onChange={e=>{setCliente(e.target.value);setErr("");}} autoFocus/>
      </div>
      <div style={{marginBottom:14}}>
        <label style={{fontSize:14,fontWeight:600,color:"#64748b",display:"block",marginBottom:5}}>Remisión</label>
        <input style={inp} value={remision} onChange={e=>setRemision(e.target.value)} placeholder="No. de remisión"/>
      </div>
      {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 12px",color:"#dc2626",fontSize:14,marginBottom:12}}>⚠ {err}</div>}
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{...btnS,flex:1}}>Cancelar</button>
        <button onClick={submit} disabled={loading} style={{...btnR,flex:2}}>{loading?"Guardando...":"Guardar cambios"}</button>
      </div>
    </Modal>
  );
}

// ═══ EDITAR ORDEN ══════════════════════════════════════════
function EditOrderModal({order,isG,onClose,onSave}){
  const [cliente,setCliente]=useState(order.cliente);
  const [remision,setRemision]=useState(order.remision||"");
  const existing=normalizeItems(order).map(it=>({...it,_key:Date.now()+Math.random()}));
  const [items,setItems]=useState(existing.length>0?existing:[newEmptyItem()]);
  const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  const esStock=esStockCliente(cliente);
  const updateItem=(i,v)=>setItems(prev=>prev.map((x,idx)=>idx===i?v:x));
  const addItem=()=>setItems(prev=>[...prev,newEmptyItem()]);
  const removeItem=i=>setItems(prev=>prev.filter((_,idx)=>idx!==i));
  const submit=async()=>{
    if(!cliente.trim()){setErr("Ingresa el nombre del cliente");return;}
    for(let it of items){const e=validarItem(it);if(e){setErr(e);return;}}
    const cleanItems=items.map(it=>enrichItem(it));
    setLoading(true);
    await onSave(order.orden,{cliente:cliente.trim(),remision:remision.trim(),items:cleanItems});
    setLoading(false);onClose();
  };
  return(
    <Modal title={`Editar Orden #${order.orden}`} onClose={onClose} maxWidth={580}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div><label style={{fontSize:14,fontWeight:600,color:"#64748b",display:"block",marginBottom:5}}>Cliente</label><input style={inp} value={cliente} onChange={e=>setCliente(e.target.value)}/></div>
        <div><label style={{fontSize:14,fontWeight:600,color:"#64748b",display:"block",marginBottom:5}}>Remisión</label><input style={inp} value={remision} onChange={e=>setRemision(e.target.value)} placeholder="No. de remisión"/></div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <label style={{fontSize:14,fontWeight:700,color:"#334155"}}>Productos ({items.length})</label>
        <button onClick={addItem} style={{background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:10,padding:"6px 14px",cursor:"pointer",color:GREEN,fontSize:14,fontWeight:700}}>+ Agregar producto</button>
      </div>
      {esStock&&<div style={{background:"#f5f3ff",border:"1px solid #ddd6fe",borderRadius:10,padding:"8px 12px",fontSize:13,color:"#6d28d9",marginBottom:10}}>📦 Orden de inventario: no se piden precio de venta ni costo.</div>}
      {items.map((it,i)=><ItemCard key={it._key||i} item={it} index={i} onUpdate={v=>updateItem(i,v)} onRemove={()=>removeItem(i)} canRemove={items.length>1} isG={isG} esStock={esStock}/>)}
      {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 12px",color:"#dc2626",fontSize:14,marginBottom:12}}>⚠ {err}</div>}
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{...btnS,flex:1}}>Cancelar</button>
        <button onClick={submit} disabled={loading} style={{...btnR,flex:2}}>{loading?"Guardando...":"Guardar cambios"}</button>
      </div>
    </Modal>
  );
}

// ═══ ASIGNAR PRODUCTOS DE UNA ORDEN A MÁQUINAS ═════════════
// Modal principal: muestra todos los items de la orden y permite asignar cada uno
function AssignOrderModal({order,allOrders,machines,user,isG,onClose,onAssign,onAssignMultiple}){
  const items=normalizeItems(order);
  const [sel,setSel]=useState({}); // { itemIndex: machineId }
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");

  // Con multi-producto una máquina puede tener varios items activos a la vez.
  // Se permite asignar varios productos de la MISMA orden a la MISMA máquina
  // y también repartirlos en máquinas distintas — sin restricciones de duplicado.
  const availableMachines=(itemIdx)=>{
    const sedesPermitidas=["Centro","Santa Lucia"]; // vendedoras y gerencia: ambas sedes
    return machines.filter(m=>sedesPermitidas.includes(m.sede));
  };

  const pendingItems=items.map((it,i)=>({...it,_idx:i})).filter(it=>it.status==="queue");

  const submit=async()=>{
    const realSel=Object.fromEntries(Object.entries(sel).filter(([,v])=>v));
    if(Object.keys(realSel).length===0){setErr("Selecciona al menos una máquina");return;}
    setLoading(true);
    // Asignar todos en un solo write para evitar race conditions
    const selByIndex={};
    for(const [idxStr,machineId] of Object.entries(realSel)) selByIndex[parseInt(idxStr)]=machineId;
    if(onAssignMultiple){
      await onAssignMultiple(order.orden, selByIndex);
    } else {
      for(const [idxStr,machineId] of Object.entries(selByIndex)){
        await onAssign(order.orden,parseInt(idxStr),machineId);
      }
    }
    setLoading(false);
    onClose();
  };

  return(
    <Modal title={`Asignar productos — Orden #${order.orden}`} onClose={onClose} maxWidth={600}>
      <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px 14px",marginBottom:16}}>
        <span style={{fontWeight:800,fontSize:15,color:"#1e293b"}}>#{order.orden}</span>
        <span style={{color:"#64748b",fontSize:14}}> · {order.cliente} · {order.sede}</span>
      </div>

      {!isG&&(
        <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"9px 14px",fontSize:14,color:"#1d4ed8",marginBottom:14}}>
          Puedes asignar a máquinas de <strong>ambas sedes</strong>.
        </div>
      )}

      <div style={{marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:700,color:"#334155",marginBottom:10}}>
          Productos en cola ({pendingItems.length}) — selecciona una máquina para cada uno:
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {pendingItems.map(it=>{
            const info=infoProducto(it.producto);
            const available=availableMachines(it._idx);
            return(
              <div key={it._idx} style={{border:`1.5px solid ${info.color}44`,borderRadius:12,overflow:"hidden"}}>
                {/* Header del item */}
                <div style={{background:info.color,padding:"8px 14px"}}>
                  <span style={{color:"#fff",fontWeight:800,fontSize:14}}>{labelProducto(it.producto)}</span>
                  <span style={{color:"rgba(255,255,255,.8)",fontSize:14,marginLeft:8}}>{resumenItem(it)}</span>
                </div>
                {/* Selector de máquina */}
                <div style={{padding:12,background:info.bg+"88"}}>
                  <div style={{fontSize:14,fontWeight:600,color:info.color,marginBottom:8}}>Asignar a máquina:</div>
                  {available.length===0?(
                    <div style={{fontSize:14,color:"#94a3b8",fontStyle:"italic"}}>No hay máquinas disponibles</div>
                  ):(
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))",gap:6}}>
                      {/* Opción: no asignar todavía */}
                      <div onClick={()=>setSel(p=>({...p,[it._idx]:""}))}
                        style={{border:`2px solid ${!sel[it._idx]?"#64748b":"#e2e8f0"}`,background:!sel[it._idx]?"#f1f5f9":"#fff",borderRadius:8,padding:"8px 4px",textAlign:"center",cursor:"pointer"}}>
                        <div style={{fontSize:14,fontWeight:700,color:!sel[it._idx]?"#64748b":"#94a3b8"}}>Sin asignar</div>
                      </div>
                      {available.map(m=>(
                        <div key={m.id} onClick={()=>setSel(p=>({...p,[it._idx]:m.id}))}
                          style={{border:`2px solid ${sel[it._idx]===m.id?info.color:"#e2e8f0"}`,background:sel[it._idx]===m.id?info.bg:"#fff",borderRadius:8,padding:"8px 4px",textAlign:"center",cursor:"pointer"}}>
                          <div style={{fontWeight:700,color:sel[it._idx]===m.id?info.color:"#334155",fontSize:14}}>{m.label}</div>
                          <div style={{fontSize:9,color:"#94a3b8"}}>{m.sede}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Items ya asignados o completados */}
      {items.filter(it=>it.status!=="queue").length>0&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:600,color:"#94a3b8",marginBottom:8}}>Ya asignados / completados:</div>
          {items.map((it,i)=>{
            if(it.status==="queue") return null;
            const info=infoProducto(it.producto);
            return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{background:info.bg,color:info.color,borderRadius:999,padding:"1px 8px",fontSize:14,fontWeight:700}}>{labelProducto(it.producto)}</span>
                <ItemStatusBadge item={it}/>
                <span style={{fontSize:14,color:"#64748b"}}>{resumenItem(it)}</span>
              </div>
            );
          })}
        </div>
      )}

      {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 12px",color:"#dc2626",fontSize:14,marginBottom:12}}>⚠ {err}</div>}
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{...btnS,flex:1}}>Cancelar</button>
        <button onClick={submit} disabled={loading||Object.values(sel).filter(Boolean).length===0}
          style={{...btnR,flex:2,opacity:Object.values(sel).filter(Boolean).length===0?.6:1}}>
          {loading?"Asignando...":"Confirmar asignaciones"}
        </button>
      </div>
    </Modal>
  );
}

// ═══ PICK ITEM PARA UNA MÁQUINA LIBRE ══════════════════════
function PickItemModal({machineId,orders,allOrders,user,isG,machines,onClose,onAssign}){
  const machine=machines.find(m=>m.id===machineId);
  if(!isG&&user.role!=="vendedora"&&machine.sede!==user.sede){
    return(
      <Modal title="Asignación restringida" onClose={onClose}>
        <div style={{background:"#fffbeb",border:"2px solid #f59e0b",borderRadius:14,padding:16,textAlign:"center"}}>
          <p style={{fontSize:14,color:"#92400e",fontWeight:600}}>No tienes permiso para asignar a máquinas de la sede <strong>{machine.sede}</strong>.</p>
        </div>
        <button onClick={onClose} style={{...btnR,width:"100%",marginTop:16}}>Entendido</button>
      </Modal>
    );
  }

  const [q,setQ]=useState("");const [loading,setLoading]=useState(false);
  // Recopilar todos los items en cola de todas las órdenes
  const allQueueItems=[];
  orders.forEach(o=>{
    normalizeItems(o).forEach((it,i)=>{
      if(it.status==="queue") allQueueItems.push({order:o,item:it,itemIndex:i});
    });
  });
  const [selKey,setSelKey]=useState(null); // "orden-itemIndex"

  const filtered=allQueueItems.filter(({order,item})=>
    String(order.orden).toLowerCase().includes(q.toLowerCase())||
    order.cliente.toLowerCase().includes(q.toLowerCase())||
    labelProducto(item.producto).toLowerCase().includes(q.toLowerCase())
  );

  const go=async()=>{
    if(!selKey) return;
    const [ord,idx]=selKey.split("-");
    setLoading(true);
    await onAssign(ord,parseInt(idx),machineId);
    setLoading(false);
    onClose();
  };

  return(
    <Modal title={`Asignar a ${machine.label} — Sede ${machine.sede}`} onClose={onClose}>
      <div style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:14,color:"#15803d"}}>
        {machine.name} disponible — elige el producto a producir
      </div>
      <input style={{...inp,marginBottom:10}} placeholder="Buscar por orden, cliente o producto..." value={q} onChange={e=>setQ(e.target.value)}/>
      <div style={{maxHeight:300,overflowY:"auto",display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
        {filtered.map(({order,item,itemIndex})=>{
          const key=`${order.orden}-${itemIndex}`;
          const info=infoProducto(item.producto);
          return(
            <div key={key} onClick={()=>setSelKey(key)}
              style={{border:`2px solid ${selKey===key?RED:"#e2e8f0"}`,background:selKey===key?"#fef2f2":"#fff",borderRadius:12,padding:"10px 14px",cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontWeight:800,color:"#1e293b",fontSize:14}}>#{order.orden} — {order.cliente}</span>
                {selKey===key&&<span style={{color:RED,fontWeight:700,fontSize:14}}>✓ Seleccionado</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <span style={{background:info.bg,color:info.color,borderRadius:999,padding:"1px 8px",fontSize:14,fontWeight:700}}>{labelProducto(item.producto)}</span>
                <span style={{fontSize:14,color:"#64748b"}}>{resumenItem(item)}</span>
              </div>
              <div style={{fontSize:14,color:"#94a3b8"}}>{order.sede} · {order.vendedoraName}</div>
            </div>
          );
        })}
        {filtered.length===0&&<p style={{textAlign:"center",color:"#94a3b8",padding:"24px 0"}}>Sin productos en cola</p>}
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{...btnS,flex:1}}>Cancelar</button>
        <button onClick={go} disabled={!selKey||loading}
          style={{flex:2,background:selKey?RED:"#e2e8f0",border:"none",borderRadius:10,padding:"11px",fontSize:14,fontWeight:700,color:selKey?"#fff":"#94a3b8",cursor:selKey?"pointer":"not-allowed"}}>
          {loading?"Asignando...":"Asignar producto"}
        </button>
      </div>
    </Modal>
  );
}

// ═══ COMPLETAR ITEM (2 pasos) ══════════════════════════════
function CompleteItemModal({order,item,itemIndex,onClose,onComplete,onReturn}){
  const [paso,setPaso]=useState("review");
  const [loading,setLoading]=useState(false);const [returning,setReturning]=useState(false);
  const allItems=normalizeItems(order);
  const info=infoProducto(item.producto);

  const goComplete=async()=>{setLoading(true);await onComplete(order.orden,itemIndex);setLoading(false);onClose();};
  const goReturn=async()=>{setReturning(true);await onReturn(order.orden,itemIndex);setReturning(false);onClose();};

  // Atributos del item para mostrar
  const attrs=item.producto==="eslabonada"?[
    {l:"Metros cuadrados",v:`${item.metros} m²`},{l:"Ancho",v:`${item.ancho}m`},{l:"Alto",v:`${item.alto}m`},{l:"Abertura",v:item.abertura},{l:"Calibre",v:item.calibre},
  ]:item.producto==="pvc"?[
    {l:"Metros cuadrados",v:`${item.metros} m²`},{l:"Ancho",v:`${item.ancho}m`},{l:"Alto",v:`${item.alto}m`},{l:"Abertura",v:item.abertura},{l:"Calibre",v:item.calibre},{l:"Cal.Interno",v:item.calibreInterno},{l:"Color",v:item.color},
  ]:(item.producto==="postes")?[
    {l:"Calibre",v:item.calibre},{l:"Grosor",v:`${item.grosor}"`},{l:"Largo",v:`${item.largo}m`},{l:"Cantidad",v:`${item.cantidad} unidades`},
  ]:[];

  const otherItems=allItems.filter((_,i)=>i!==itemIndex);
  const allDoneAfter=otherItems.every(it=>it.status==="completed");

  const Header=()=>(
    <div style={{background:`linear-gradient(135deg,${info.bg},${info.bg}cc)`,border:`2px solid ${info.color}`,borderRadius:14,padding:14,marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div>
          <span style={{background:info.color,color:"#fff",borderRadius:999,padding:"2px 10px",fontSize:14,fontWeight:700}}>{labelProducto(item.producto)}</span>
          <div style={{fontSize:22,fontWeight:900,color:"#1e293b",lineHeight:1,marginTop:4}}>Orden #{order.orden}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:14,fontWeight:700,color:info.color}}>{item.machineLabel}</div>
          <div style={{fontSize:14,color:"#64748b"}}>Hace {timeAgo(item.assignedAt||order.timestamp)}</div>
        </div>
      </div>
      <div style={{fontSize:14,color:info.color,fontWeight:600,marginBottom:4}}>Cliente: <span style={{color:"#1e293b",fontWeight:700,fontSize:14}}>{order.cliente}</span></div>
      <div style={{fontSize:14,color:"#64748b"}}>Por: {order.vendedoraName} · Sede: {order.sede}</div>
    </div>
  );

  // ── Paso 1: revisar item ────────────────────────────────
  if(paso==="review") return(
    <Modal title="Revisar producto antes de finalizar" onClose={onClose} maxWidth={540}>
      <Header/>
      {/* Indicador de pasos */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <div style={{width:24,height:24,borderRadius:"50%",background:info.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#fff",flexShrink:0}}>1</div>
        <span style={{fontSize:14,fontWeight:600,color:"#334155"}}>Verificar el producto</span>
        <div style={{flex:1,height:2,background:"#e2e8f0",borderRadius:2}}/>
        <div style={{width:24,height:24,borderRadius:"50%",background:"#e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#94a3b8",flexShrink:0}}>2</div>
        <span style={{fontSize:14,color:"#94a3b8"}}>Confirmar</span>
      </div>

      {/* Detalle del item */}
      <div style={{border:`2px solid ${info.color}55`,borderRadius:14,overflow:"hidden",marginBottom:14}}>
        <div style={{background:info.color,padding:"8px 14px"}}>
          <span style={{color:"#fff",fontWeight:800,fontSize:14}}>{labelProducto(item.producto)}</span>
        </div>
        <div style={{padding:12,background:info.bg+"99",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:8}}>
          {attrs.map(({l,v})=>(
            <div key={l} style={{background:"rgba(255,255,255,.8)",borderRadius:8,padding:"8px 10px"}}>
              <div style={{fontSize:9,color:info.color,textTransform:"uppercase",letterSpacing:.4,fontWeight:700,marginBottom:2}}>{l}</div>
              <div style={{fontSize:14,fontWeight:800,color:"#1e293b"}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Estado del resto de la orden */}
      {otherItems.length>0&&(
        <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:12,padding:12,marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:700,color:"#64748b",marginBottom:8}}>Otros productos de esta orden:</div>
          {otherItems.map((it,i)=>{
            const oi=infoProducto(it.producto);
            return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <span style={{background:oi.bg,color:oi.color,borderRadius:999,padding:"1px 8px",fontSize:14,fontWeight:700}}>{labelProducto(it.producto)}</span>
                <ItemStatusBadge item={it}/>
              </div>
            );
          })}
          {allDoneAfter&&<div style={{marginTop:8,background:"#f0fdf4",border:"1px solid #86efac",borderRadius:8,padding:"6px 10px",fontSize:14,color:"#15803d",fontWeight:600}}>✓ Al terminar este producto, la orden quedará 100% terminada</div>}
        </div>
      )}

      <div style={{display:"flex",gap:10,marginBottom:8}}>
        <button onClick={onClose} style={{...btnS,flex:1}}>Cancelar</button>
        <button onClick={()=>setPaso("confirm")} style={{...btnG,flex:2}}>Todo correcto → Continuar</button>
      </div>
      <button onClick={()=>setPaso("liberar")} style={{width:"100%",background:"none",border:"1.5px solid #e2e8f0",borderRadius:10,padding:"10px",fontSize:14,color:"#64748b",cursor:"pointer",fontWeight:600}}>
        Liberar máquina sin completar este producto
      </button>
    </Modal>
  );

  // ── Paso 2: confirmación ────────────────────────────────
  if(paso==="confirm") return(
    <Modal title="Confirmar finalización" onClose={onClose}>
      <Header/>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <div style={{width:24,height:24,borderRadius:"50%",background:GREEN,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#fff",flexShrink:0}}>✓</div>
        <span style={{fontSize:14,color:"#64748b"}}>Producto revisado</span>
        <div style={{flex:1,height:2,background:GREEN,borderRadius:2}}/>
        <div style={{width:24,height:24,borderRadius:"50%",background:RED,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#fff",flexShrink:0}}>2</div>
        <span style={{fontSize:14,fontWeight:600,color:"#334155"}}>Confirmar</span>
      </div>
      <div style={{background:"#f0fdf4",border:"2px solid #86efac",borderRadius:12,padding:12,marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:700,color:GREEN,marginBottom:6}}>Resumen del producto finalizado:</div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{background:info.color,color:"#fff",borderRadius:999,padding:"2px 10px",fontSize:14,fontWeight:700}}>{labelProducto(item.producto)}</span>
          <span style={{fontSize:14,color:"#475569"}}>{resumenItem(item)}</span>
        </div>
        {allDoneAfter&&<div style={{marginTop:8,fontSize:14,color:GREEN,fontWeight:600}}>✓ Esta acción completará la orden #{order.orden} al 100%</div>}
      </div>
      <div style={{background:"#fef9c3",border:"1.5px solid #fde047",borderRadius:10,padding:"10px 14px",fontSize:14,color:"#713f12",marginBottom:16}}>
        ⚠ La máquina <strong>{item.machineLabel}</strong> quedará libre para el siguiente producto.
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>setPaso("review")} style={{...btnS,flex:1}}>← Volver</button>
        <button onClick={goComplete} disabled={loading} style={{...btnG,flex:2}}>{loading?"Procesando...":"Sí, producto terminado ✓"}</button>
      </div>
    </Modal>
  );

  // ── Warning: liberar sin completar ──────────────────────
  return(
    <Modal title="Liberar máquina" onClose={onClose}>
      <Header/>
      <div style={{background:"#fffbeb",border:"2px solid #f59e0b",borderRadius:14,padding:16,marginBottom:16}}>
        <div style={{fontSize:15,fontWeight:700,color:"#92400e",marginBottom:8}}>⚠ Advertencia importante</div>
        <p style={{fontSize:14,color:"#78350f",margin:"0 0 10px"}}>
          Si liberas la máquina <strong>{item.machineLabel}</strong> el producto <strong>{labelProducto(item.producto)}</strong> de la orden <strong>#{order.orden}</strong> volverá a la cola pero <strong>NO quedará registrado como completado</strong>.
        </p>
        <p style={{fontSize:14,color:"#78350f",margin:0}}>Asegúrate de volver a asignarlo y completarlo.</p>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>setPaso("review")} style={{...btnS,flex:1}}>← Cancelar</button>
        <button onClick={goReturn} disabled={returning} style={{flex:2,background:"#f59e0b",border:"none",borderRadius:10,padding:"11px",fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer"}}>{returning?"Procesando...":"Entendido, liberar máquina"}</button>
      </div>
    </Modal>
  );
}

// ═══ DETALLE ═══════════════════════════════════════════════
function DetailModal({order,isG,onClose,onQuickEdit,onSetEntrega}){
  const ss={queue:{bg:"#eff6ff",col:"#1d4ed8",txt:"En Cola"},active:{bg:"#fef2f2",col:"#991b1b",txt:"En Producción"},completed:{bg:"#f0fdf4",col:"#15803d",txt:"Terminado"}};
  const st=orderStInfo(order);
  const items=normalizeItems(order);
  const esStock=esStockCliente(order.cliente);
  const ei=entregaInfo(order);
  const entregado=order.estadoEntrega==="entregado";
  const logs=Array.isArray(order.logs)?[...order.logs].sort((a,b)=>b.ts-a.ts):[];
  const meta=[
    ["Cliente",order.cliente],["Remisión",order.remision||"—"],["Sede",order.sede],
    ["Creado por",order.vendedoraName],["Fecha creación",fmtDate(order.timestamp)],
    ...(order.completedAt?[["Terminada el",fmtDate(order.completedAt)]]:[]),
    ...(entregado&&order.fechaEntrega?[["Entregado el",fmtDate(order.fechaEntrega)]]:[]),
  ];
  return(
    <Modal title="Detalle de la Orden" onClose={onClose}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:8,flexWrap:"wrap"}}>
        <span style={{fontSize:26,fontWeight:900,color:"#1e293b"}}>#{order.orden}</span>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{background:st.bg,color:st.col,borderRadius:999,padding:"4px 14px",fontSize:14,fontWeight:700}}>{st.txt}</span>
          {order.estadoEntrega==="entregado"&&<span style={{background:ei.bg,color:ei.color,border:`1px solid ${ei.border}`,borderRadius:999,padding:"4px 14px",fontSize:14,fontWeight:700}}>{ei.label}</span>}
        </div>
      </div>

      {/* Acciones rápidas */}
      {(onQuickEdit||onSetEntrega)&&(
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          {onQuickEdit&&<button onClick={()=>{onClose();onQuickEdit(order);}} style={{background:"#eef2ff",border:"1px solid #c7d2fe",borderRadius:10,padding:"8px 14px",cursor:"pointer",color:"#4338ca",fontSize:14,fontWeight:700}}>✏ Editar datos</button>}
          {onSetEntrega&&(entregado
            ?<button onClick={()=>onSetEntrega(order.orden,"pendiente")} style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"8px 14px",cursor:"pointer",color:"#b45309",fontSize:14,fontWeight:700}}>Revertir entrega</button>
            :<button onClick={()=>onSetEntrega(order.orden,"entregado")} style={{...btnG,padding:"8px 14px"}}>✓ Marcar entregado</button>)}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
        {meta.map(([l,v])=>(
          <div key={l} style={{background:"#f8fafc",border:"1px solid #f1f5f9",borderRadius:10,padding:"10px 12px"}}>
            <div style={{fontSize:14,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.4,marginBottom:2}}>{l}</div>
            <div style={{fontWeight:600,color:"#334155",fontSize:14}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{fontWeight:700,fontSize:14,color:"#334155",marginBottom:10}}>Productos ({items.length})</div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        {items.map((it,i)=>{
          const info=infoProducto(it.producto);
          const itemS=ss[it.status]||{bg:"#f1f5f9",col:"#64748b",txt:it.status};
          const campos=[
            ...(it.producto==="eslabonada"||it.producto==="pvc"?[["M²",`${it.metros} m²`],["Ancho",`${it.ancho}m`],["Alto",`${it.alto}m`],["Abertura",it.abertura],["Calibre",it.calibre]]:[]),
            ...(it.producto==="pvc"?[["Cal.Int",it.calibreInterno],["Color",it.color]]:[]),
            ...(it.producto==="postes"?[["Calibre",it.calibre],["Grosor",`${it.grosor}"`],["Largo",`${it.largo}m`],["Cantidad",`${it.cantidad} un`]]:[]),
            ...(!esStock?[["Precio venta",fmtMoney(it.precioVenta)]]:[]),
            ...(!esStock&&isG?[["Costo",fmtMoney(it.costo)]]:[]),
          ];
          return(
            <div key={i} style={{border:`1.5px solid ${info.color}44`,borderRadius:12,overflow:"hidden"}}>
              <div style={{background:info.color,padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{color:"#fff",fontWeight:800,fontSize:14}}>{i+1}. {labelProducto(it.producto)}</span>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  {it.machineLabel&&<span style={{background:"rgba(255,255,255,.25)",color:"#fff",borderRadius:999,padding:"1px 8px",fontSize:14,fontWeight:700}}>{it.machineLabel}</span>}
                  <span style={{background:itemS.bg,color:itemS.col,borderRadius:999,padding:"1px 8px",fontSize:14,fontWeight:700}}>{itemS.txt}</span>
                </div>
              </div>
              <div style={{padding:12,background:info.bg+"88",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))",gap:6}}>
                {campos.map(([l,v])=>(
                  <div key={l} style={{background:"rgba(255,255,255,.7)",borderRadius:8,padding:"6px 8px"}}>
                    <div style={{fontSize:9,color:info.color,textTransform:"uppercase",letterSpacing:.3,marginBottom:1}}>{l}</div>
                    <div style={{fontWeight:700,color:"#334155",fontSize:14}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Registro de cambios */}
      <div style={{fontWeight:700,fontSize:14,color:"#334155",marginBottom:8}}>Registro de cambios ({logs.length})</div>
      {logs.length===0?(
        <div style={{fontSize:13,color:"#94a3b8",marginBottom:16}}>Sin cambios registrados.</div>
      ):(
        <div style={{maxHeight:180,overflowY:"auto",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"8px 12px",marginBottom:16}}>
          {logs.map((l,i)=>(
            <div key={i} style={{padding:"6px 0",borderBottom:i<logs.length-1?"1px solid #e2e8f0":"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
                <span style={{fontSize:13,fontWeight:700,color:"#334155"}}>{l.accion}</span>
                <span style={{fontSize:12,color:"#94a3b8",whiteSpace:"nowrap"}}>{fmtDate(l.ts)}</span>
              </div>
              {l.detalle&&<div style={{fontSize:12,color:"#64748b",marginTop:2}}>{l.detalle}</div>}
              <div style={{fontSize:12,color:"#94a3b8",marginTop:1}}>por {l.usuario}</div>
            </div>
          ))}
        </div>
      )}

      <button onClick={onClose} style={{width:"100%",background:DARK,border:"none",borderRadius:10,padding:"11px",fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer"}}>Cerrar</button>
    </Modal>
  );
}

// ═══ INVENTARIO ════════════════════════════════════════════
const UNIDADES = ["rollos","m²","unidades","kg","metros","cajas"];
const INV_CATEGORIAS = ["Malla Eslabonada","Malla PVC","Postes","Alambre de Púas","Gaviones","Concertina","Tubos","Otro"];
const CAT_UNIDAD = {"Malla Eslabonada":"m²","Malla PVC":"m²","Postes":"unidades","Alambre de Púas":"metros","Gaviones":"unidades","Concertina":"rollos","Tubos":"unidades","Otro":"unidades"};
// Etiqueta rica del producto (categoría + calibre + medida + color); usa nombre como respaldo
const invLabel = p => {
  const parts=[p.categoria,p.calibre&&("Cal "+p.calibre),p.medida,p.color].filter(Boolean);
  return parts.length?parts.join(" · "):(p.nombre||"Producto");
};
const ORIGEN_INFO = {
  producido: { label:"Producido", bg:"#eff6ff", col:"#1d4ed8" },
  importado: { label:"Importado", bg:"#f5f3ff", col:"#7c3aed" },
};

function InventarioTab({inventario,orders=[],lowStock,user,isG,canStock,onNuevo,onEditar,onEliminar,onEntrada,onSalida,onKardex}){
  const [q,setQ]=useState("");
  const [cat,setCat]=useState("Todas");
  const [estado,setEstado]=useState("todos"); // todos | bajo | agotado

  const estadoDe=p=>{ const t=SEDES.reduce((a,s)=>a+(Number(p.stock?.[s])||0),0); if(t<=0) return "agotado"; if((p.minimo||0)>0&&t<=p.minimo) return "bajo"; return "ok"; };
  const ST={ ok:{txt:"En stock",col:"#15803d",bg:"#f0fdf4",bd:"#86efac"}, bajo:{txt:"Bajo",col:"#b45309",bg:"#fffbeb",bd:"#fde68a"}, agotado:{txt:"Agotado",col:"#dc2626",bg:"#fef2f2",bd:"#fecaca"} };

  const withTotal=inventario.map(p=>({p,total:SEDES.reduce((a,s)=>a+(Number(p.stock?.[s])||0),0),est:estadoDe(p)}));
  const kpi={ total:inventario.length, ok:withTotal.filter(x=>x.est==="ok").length, bajo:withTotal.filter(x=>x.est==="bajo").length, agotado:withTotal.filter(x=>x.est==="agotado").length };
  const cats=["Todas",...INV_CATEGORIAS.filter(c=>inventario.some(p=>(p.categoria||"Otro")===c))];

  const fil=withTotal
    .filter(x=>cat==="Todas"||(x.p.categoria||"Otro")===cat)
    .filter(x=>estado==="todos"||x.est===estado)
    .filter(x=>{ const s=(invLabel(x.p)+" "+(x.p.nombre||"")).toLowerCase(); return s.includes(q.toLowerCase()); })
    .sort((a,b)=>invLabel(a.p).localeCompare(invLabel(b.p)));
  // Agrupar por categoría
  const grupos={};
  fil.forEach(x=>{ const c=x.p.categoria||"Otro"; (grupos[c]=grupos[c]||[]).push(x); });

  // Producción física en bodega (derivada de las órdenes)
  const bodega={};
  PRODUCTOS.forEach(p=>{ bodega[p.id]={unidad:p.id==="postes"?"un":"m²",sinEntregar:0,stock:0,sedes:{}}; });
  (orders||[]).forEach(o=>{
    const isStock=esStockCliente(o.cliente);
    const entregado=o.estadoEntrega==="entregado";
    if(entregado&&!isStock) return;
    const sede=SEDES.includes(o.sede)?o.sede:"Centro";
    normalizeItems(o).forEach(it=>{
      if(it.status!=="completed") return;
      if(!bodega[it.producto]) bodega[it.producto]={unidad:it.producto==="postes"?"un":"m²",sinEntregar:0,stock:0,sedes:{}};
      const qty=it.producto==="postes"?(Number(it.cantidad)||0):(Number(it.metros)||(Number(it.ancho)*Number(it.alto))||0);
      if(!qty) return;
      const b=isStock?"stock":"sinEntregar";
      bodega[it.producto][b]+=qty;
      if(!bodega[it.producto].sedes[sede]) bodega[it.producto].sedes[sede]={sinEntregar:0,stock:0};
      bodega[it.producto].sedes[sede][b]+=qty;
    });
  });
  const bodegaList=Object.entries(bodega);

  const Kpi=({label,value,color,bg,onClick,active})=>(
    <div onClick={onClick} style={{flex:1,minWidth:120,background:active?color:bg,border:`1.5px solid ${active?color:"#e2e8f0"}`,borderRadius:14,padding:"12px 14px",cursor:onClick?"pointer":"default"}}>
      <div style={{fontSize:26,fontWeight:900,color:active?"#fff":color,lineHeight:1}}>{value}</div>
      <div style={{fontSize:13,fontWeight:600,color:active?"rgba(255,255,255,.9)":"#64748b",marginTop:4}}>{label}</div>
    </div>
  );

  return(
    <div>
      {/* Indicadores */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <Kpi label="Productos" value={kpi.total} color="#1e293b" bg="#f8fafc" onClick={()=>{setEstado("todos");setCat("Todas");}} active={estado==="todos"&&cat==="Todas"}/>
        <Kpi label="En stock" value={kpi.ok} color="#15803d" bg="#f0fdf4" onClick={()=>setEstado(estado==="ok"?"todos":"ok")} active={estado==="ok"}/>
        <Kpi label="Bajo mínimo" value={kpi.bajo} color="#b45309" bg="#fffbeb" onClick={()=>setEstado(estado==="bajo"?"todos":"bajo")} active={estado==="bajo"}/>
        <Kpi label="Agotados" value={kpi.agotado} color="#dc2626" bg="#fef2f2" onClick={()=>setEstado(estado==="agotado"?"todos":"agotado")} active={estado==="agotado"}/>
      </div>

      {/* Buscador + nuevo */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <input style={{...inp,flex:1,minWidth:200}} placeholder="Buscar por nombre, calibre o medida..." value={q} onChange={e=>setQ(e.target.value)}/>
        {isG&&<button onClick={onNuevo} style={btnR}>+ Nuevo producto</button>}
      </div>
      {/* Chips de categoría */}
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {cats.map(c=>(
          <button key={c} onClick={()=>setCat(c)} style={{background:cat===c?"#1e293b":"#f8fafc",border:"1.5px solid",borderColor:cat===c?"#1e293b":"#e2e8f0",borderRadius:999,padding:"5px 14px",cursor:"pointer",fontSize:13,fontWeight:600,color:cat===c?"#fff":"#64748b"}}>{c}</button>
        ))}
      </div>

      {fil.length===0?(
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #e2e8f0",textAlign:"center",padding:"56px 0",color:"#94a3b8"}}>
          <div style={{fontSize:34,marginBottom:10}}>📦</div>
          <div style={{fontWeight:600,marginBottom:6}}>{inventario.length===0?"Aún no hay productos en el inventario":"Sin resultados con estos filtros"}</div>
          {inventario.length===0&&isG&&<button onClick={onNuevo} style={{background:"none",border:"none",color:RED,fontSize:14,cursor:"pointer",textDecoration:"underline"}}>+ Crear el primer producto</button>}
        </div>
      ):(
        Object.entries(grupos).map(([categoria,rows])=>(
          <div key={categoria} style={{marginBottom:18}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{width:4,height:16,background:RED,borderRadius:2}}/>
              <h3 style={{margin:0,fontSize:15,fontWeight:800,color:"#334155"}}>{categoria}</h3>
              <span style={{fontSize:13,color:"#94a3b8"}}>({rows.length})</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:10}}>
              {rows.map(({p,total,est})=>{
                const s=ST[est];const oi=ORIGEN_INFO[p.origen]||ORIGEN_INFO.producido;
                return(
                  <div key={p.id} style={{background:"#fff",border:`1.5px solid ${est==="ok"?"#e2e8f0":s.bd}`,borderRadius:14,overflow:"hidden"}}>
                    <div style={{padding:"12px 14px",borderBottom:"1px solid #f1f5f9"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                        <div style={{minWidth:0}}>
                          <div style={{fontWeight:800,color:"#1e293b",fontSize:15,lineHeight:1.25}}>{invLabel(p)}</div>
                          <div style={{display:"flex",gap:6,alignItems:"center",marginTop:5,flexWrap:"wrap"}}>
                            <span style={{background:oi.bg,color:oi.col,borderRadius:999,padding:"1px 8px",fontSize:11,fontWeight:700}}>{oi.label}</span>
                            {p.calibre&&<span style={{background:"#f1f5f9",color:"#475569",borderRadius:999,padding:"1px 8px",fontSize:11,fontWeight:600}}>Cal {p.calibre}</span>}
                            {p.medida&&<span style={{background:"#f1f5f9",color:"#475569",borderRadius:999,padding:"1px 8px",fontSize:11,fontWeight:600}}>{p.medida}</span>}
                          </div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontSize:22,fontWeight:900,color:s.col,lineHeight:1}}>{total}</div>
                          <div style={{fontSize:11,color:"#94a3b8"}}>{p.unidad}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
                        <span style={{background:s.bg,color:s.col,border:`1px solid ${s.bd}`,borderRadius:999,padding:"1px 10px",fontSize:12,fontWeight:700}}>{s.txt}</span>
                        {(p.minimo||0)>0&&<span style={{fontSize:12,color:"#94a3b8"}}>mínimo {p.minimo}</span>}
                      </div>
                    </div>
                    {/* Stock por sede */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,padding:"10px 14px"}}>
                      {SEDES.map(se=>{
                        const v=Number(p.stock?.[se])||0;
                        const e2=v<=0?"agotado":((p.minimo||0)>0&&v<=p.minimo?"bajo":"ok");const c2=ST[e2];
                        return(
                          <div key={se} style={{background:c2.bg,border:`1px solid ${c2.bd}`,borderRadius:10,padding:"6px 4px",textAlign:"center"}}>
                            <div style={{fontSize:16,fontWeight:900,color:c2.col}}>{v}</div>
                            <div style={{fontSize:10,color:"#94a3b8",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{se}</div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Acciones */}
                    <div style={{display:"flex",gap:6,padding:"0 14px 12px",flexWrap:"wrap"}}>
                      {canStock&&<button onClick={()=>onEntrada(p)} style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:"#15803d",fontSize:14,fontWeight:700}}>+ Entrada</button>}
                      {canStock&&<button onClick={()=>onSalida(p)} style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:"#c2410c",fontSize:14,fontWeight:700}}>− Salida</button>}
                      <button onClick={()=>onKardex(p)} style={{...btnS,padding:"6px 10px",fontSize:14}}>Movimientos</button>
                      {isG&&<button onClick={()=>onEditar(p)} style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:"#0369a1",fontSize:14}}>✏</button>}
                      {isG&&onEliminar&&<button onClick={()=>onEliminar(p)} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:"#dc2626",fontSize:14}}>🗑</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Producción en bodega (según órdenes) */}
      {bodegaList.some(([,d])=>d.sinEntregar||d.stock)&&(
        <div style={{marginTop:22,paddingTop:18,borderTop:"1px solid #e2e8f0"}}>
          <div style={{fontSize:15,fontWeight:800,color:"#334155",marginBottom:4}}>Producción en bodega (según órdenes)</div>
          <div style={{fontSize:12,color:"#94a3b8",marginBottom:10}}>Lo ya producido que sigue físicamente en bodega: pendiente de entregar + lo fabricado para stock. Se calcula solo de las órdenes.</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
            {bodegaList.map(([prod,d])=>{
              const info=infoProducto(prod);
              return(
                <div key={prod} style={{background:"#fff",border:`1.5px solid ${info.color}44`,borderRadius:12,padding:"12px 14px"}}>
                  <div style={{fontWeight:800,color:info.color,fontSize:15,marginBottom:8}}>{labelProducto(prod)}</div>
                  <div style={{display:"flex",gap:8,marginBottom:8}}>
                    <div style={{flex:1,background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"8px",textAlign:"center"}}>
                      <div style={{fontSize:17,fontWeight:900,color:"#b45309"}}>{d.sinEntregar} <span style={{fontSize:12}}>{d.unidad}</span></div>
                      <div style={{fontSize:11,color:"#92400e"}}>Sin entregar</div>
                    </div>
                    <div style={{flex:1,background:"#f5f3ff",border:"1px solid #ddd6fe",borderRadius:10,padding:"8px",textAlign:"center"}}>
                      <div style={{fontSize:17,fontWeight:900,color:"#7c3aed"}}>{d.stock} <span style={{fontSize:12}}>{d.unidad}</span></div>
                      <div style={{fontSize:11,color:"#6d28d9"}}>Para stock</div>
                    </div>
                  </div>
                  <div style={{fontSize:11,color:"#94a3b8"}}>
                    {SEDES.filter(se=>d.sedes[se]&&(d.sedes[se].sinEntregar||d.sedes[se].stock)).map(se=>`${se}: ${(d.sedes[se].sinEntregar+d.sedes[se].stock)} ${d.unidad}`).join(" · ")||"—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductoModal({prod,onClose,onSave}){
  const editing=!!prod;
  const [categoria,setCategoria]=useState(prod?.categoria||"Malla Eslabonada");
  const [calibre,setCalibre]=useState(prod?.calibre||"");
  const [medida,setMedida]=useState(prod?.medida||"");
  const [color,setColor]=useState(prod?.color||"");
  const [unidad,setUnidad]=useState(prod?.unidad||CAT_UNIDAD["Malla Eslabonada"]||"m²");
  const [origen,setOrigen]=useState(prod?.origen||"importado");
  const [minimo,setMinimo]=useState(prod?.minimo!=null?String(prod.minimo):"");
  // Nombre/referencia opcional: si el producto viejo solo tenía nombre, lo conservamos
  const legacyNombre = editing && !prod?.categoria ? (prod?.nombre||"") : "";
  const [ref,setRef]=useState(legacyNombre);
  const [err,setErr]=useState("");const [loading,setLoading]=useState(false);

  const auto=invLabel({categoria,calibre,medida,color});
  const nombreFinal=(ref.trim()||auto).trim();
  const cambioCat=v=>{ setCategoria(v); if(CAT_UNIDAD[v]) setUnidad(CAT_UNIDAD[v]); };

  const submit=async()=>{
    if(!nombreFinal){setErr("Escribe al menos la categoría y una medida, o un nombre");return;}
    setLoading(true);
    const r=await onSave({nombre:nombreFinal,categoria,calibre:calibre.trim(),medida:medida.trim(),color:color.trim(),unidad,origen,minimo:Number(minimo)||0});
    setLoading(false);
    if(r){setErr(r);return;}
    onClose();
  };
  return(
    <Modal title={editing?"Editar producto":"Nuevo producto de inventario"} onClose={onClose} maxWidth={520}>
      <Field label="Categoría">
        <select style={inp} value={categoria} onChange={e=>cambioCat(e.target.value)}>
          {INV_CATEGORIAS.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Calibre"><input style={inp} value={calibre} onChange={e=>{setCalibre(e.target.value);setErr("");}} placeholder="Ej: 10.5"/></Field>
        <Field label="Tamaño / medida"><input style={inp} value={medida} onChange={e=>{setMedida(e.target.value);setErr("");}} placeholder='Ej: 2.00×10m · 2½"'/></Field>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Color (opcional)"><input style={inp} value={color} onChange={e=>setColor(e.target.value)} placeholder="Verde, Negro..."/></Field>
        <Field label="Unidad">
          <select style={inp} value={unidad} onChange={e=>setUnidad(e.target.value)}>{UNIDADES.map(u=><option key={u} value={u}>{u}</option>)}</select>
        </Field>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Origen">
          <select style={inp} value={origen} onChange={e=>setOrigen(e.target.value)}><option value="importado">Importado</option><option value="producido">Producido</option></select>
        </Field>
        <Field label="Stock mínimo (alerta)"><NumInp value={minimo} onChange={setMinimo} placeholder="0"/></Field>
      </div>
      <Field label="Nombre / referencia (opcional — si lo dejas vacío se arma solo)">
        <input style={inp} value={ref} onChange={e=>{setRef(e.target.value);setErr("");}} placeholder={auto||"Nombre del producto"}/>
      </Field>
      <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px 12px",marginBottom:12}}>
        <div style={{fontSize:12,color:"#94a3b8",marginBottom:2}}>Se guardará como</div>
        <div style={{fontSize:15,fontWeight:800,color:"#1e293b"}}>{nombreFinal||"—"} <span style={{fontSize:12,fontWeight:600,color:"#94a3b8"}}>({unidad})</span></div>
      </div>
      {editing&&<div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"9px 12px",fontSize:13,color:"#1d4ed8",marginBottom:12}}>Las existencias por sede se ajustan con <strong>Entrada</strong> y <strong>Salida</strong>, no aquí.</div>}
      {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 12px",color:"#dc2626",fontSize:14,marginBottom:12}}>⚠ {err}</div>}
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{...btnS,flex:1}}>Cancelar</button>
        <button onClick={submit} disabled={loading} style={{...btnR,flex:2}}>{loading?"Guardando...":editing?"Guardar cambios":"Crear producto"}</button>
      </div>
    </Modal>
  );
}

function MovInventarioModal({prod,tipo,onClose,onSave}){
  const esEntrada=tipo==="entrada";
  const [sede,setSede]=useState("Centro");
  const [cant,setCant]=useState("");
  const [motivo,setMotivo]=useState(esEntrada?"Importación":"Venta");
  const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  const motivos=esEntrada?["Importación","Producción para stock","Devolución de cliente","Ajuste"]:["Venta","Remisión","Merma/daño","Ajuste"];
  const actual=Number(prod.stock?.[sede])||0;
  const q=Math.abs(Number(cant)||0);
  const resultante=esEntrada?actual+q:Math.max(0,actual-q);
  const submit=async()=>{
    if(q<=0){setErr("Ingresa una cantidad válida");return;}
    if(!esEntrada&&q>actual){setErr(`Solo hay ${actual} ${prod.unidad} en ${sede}. No puedes sacar más de lo que hay.`);return;}
    setLoading(true);
    await onSave(prod.id,{sede,cant:q,tipo,motivo});
    setLoading(false);onClose();
  };
  return(
    <Modal title={`${esEntrada?"Entrada":"Salida"} · ${prod.nombre}`} onClose={onClose} maxWidth={460}>
      <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:14,color:"#475569"}}>
        Existencias actuales en <strong>{sede}</strong>: <strong>{actual} {prod.unidad}</strong>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Sede *">
          <select style={inp} value={sede} onChange={e=>setSede(e.target.value)}>
            {SEDES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label={`Cantidad (${prod.unidad}) *`}>
          <NumInp value={cant} onChange={v=>{setCant(v);setErr("");}} placeholder="0"/>
        </Field>
      </div>
      <Field label="Motivo">
        <select style={inp} value={motivo} onChange={e=>setMotivo(e.target.value)}>
          {motivos.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
      </Field>
      <div style={{background:esEntrada?"#f0fdf4":"#fff7ed",border:`1px solid ${esEntrada?"#86efac":"#fed7aa"}`,borderRadius:10,padding:"9px 14px",marginBottom:14,fontSize:14,fontWeight:700,color:esEntrada?"#15803d":"#c2410c"}}>
        Quedará: {resultante} {prod.unidad} en {sede}
      </div>
      {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 12px",color:"#dc2626",fontSize:14,marginBottom:12}}>⚠ {err}</div>}
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{...btnS,flex:1}}>Cancelar</button>
        <button onClick={submit} disabled={loading} style={{...(esEntrada?btnG:btnR),flex:2}}>{loading?"Guardando...":esEntrada?"Registrar entrada":"Registrar salida"}</button>
      </div>
    </Modal>
  );
}

function KardexModal({prod,onClose}){
  const movs=Array.isArray(prod.mov)?[...prod.mov].sort((a,b)=>b.ts-a.ts):[];
  const tipoInfo={entrada:{txt:"Entrada",col:"#15803d",bg:"#f0fdf4"},salida:{txt:"Salida",col:"#c2410c",bg:"#fff7ed"},alta:{txt:"Alta",col:"#64748b",bg:"#f1f5f9"},ajuste:{txt:"Ajuste",col:"#1d4ed8",bg:"#eff6ff"}};
  return(
    <Modal title={`Movimientos · ${prod.nombre}`} onClose={onClose} maxWidth={520}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:14}}>
        {SEDES.map(s=>(
          <div key={s} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
            <div style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>{s}</div>
            <div style={{fontSize:18,fontWeight:900,color:"#1e293b"}}>{Number(prod.stock?.[s])||0}</div>
          </div>
        ))}
      </div>
      {movs.length===0?(
        <div style={{textAlign:"center",color:"#94a3b8",padding:"24px 0"}}>Sin movimientos registrados</div>
      ):(
        <div style={{maxHeight:340,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
          {movs.map((m,i)=>{
            const ti=tipoInfo[m.tipo]||tipoInfo.ajuste;
            return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,border:"1px solid #e2e8f0",borderRadius:10,padding:"8px 12px"}}>
                <span style={{background:ti.bg,color:ti.col,borderRadius:999,padding:"2px 10px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>{ti.txt}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#334155"}}>{m.tipo==="alta"?"—":`${m.tipo==="salida"?"−":"+"}${m.cant} ${prod.unidad}`} <span style={{fontWeight:500,color:"#64748b"}}>{m.sede!=="—"?`· ${m.sede}`:""}</span></div>
                  <div style={{fontSize:12,color:"#94a3b8"}}>{m.motivo} · {m.usuario} · {fmtDate(m.ts)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <button onClick={onClose} style={{width:"100%",background:DARK,border:"none",borderRadius:10,padding:"11px",fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",marginTop:14}}>Cerrar</button>
    </Modal>
  );
}

// ═══ VENTAS / REMISIONES / COTIZACIONES ════════════════════
const docFecha = ts => { const d=new Date(ts||Date.now()); const p=n=>String(n).padStart(2,"0"); return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()}`; };
const cop = n => "$ "+(Number(n)||0).toLocaleString("es-CO");
const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

function buildDocHtml(doc){
  const esRem=doc.tipo==="remision";
  const titulo=esRem?"REMISIÓN":"COTIZACIÓN";
  const c=doc.cliente||{};
  const rows=(doc.items||[]).map(it=>{
    const vt=it.valorTotal!=null?it.valorTotal:(Number(it.cantidad)||0)*(Number(it.valorUnit)||0);
    return `<tr><td class="c">${esc(it.cantidad)} ${esc(it.unidad)}</td><td>${esc(it.descripcion)}</td><td class="r">${cop(it.valorUnit)}</td><td class="r">${cop(vt)}</td></tr>`;
  }).join("");
  const iva=doc.iva||{}, rete=doc.retefuente||{};
  const totLines=[
    `<tr><td class="tl">Subtotal</td><td class="r">${cop(doc.subtotal)}</td></tr>`,
    iva.aplica?`<tr><td class="tl">IVA (${iva.porc}%)</td><td class="r">${cop(iva.valor)}</td></tr>`:"",
    rete.aplica?`<tr><td class="tl">Retefuente (${rete.porc}%)</td><td class="r">- ${cop(rete.valor)}</td></tr>`:"",
    `<tr class="big"><td class="tl">TOTAL</td><td class="r">${cop(doc.total)}</td></tr>`,
    esRem?`<tr><td class="tl">Abono</td><td class="r">${cop(doc.abono)}</td></tr>`:"",
    esRem?`<tr><td class="tl">Saldo</td><td class="r">${cop(doc.saldo)}</td></tr>`:"",
  ].join("");
  const sedes=EMPRESA.sedes.map(s=>`<div style="font-size:10px"><b>${s.nombre}</b> · ${s.dir}<br>${s.tels}</div>`).join("");
  const footer=esRem
    ? `<div class="firmas"><div>Recibí conforme<br>_______________________<br>FIRMA C.C. / NIT</div><div>Entregado<br>_______________________<br>FIRMA C.C. / NIT</div></div>`
    : `<div class="blurb"><b>Somos ${EMPRESA.nombre}.</b> Fabricamos e importamos malla eslabonada, malla PVC, postes y más, con despacho a todo el país desde ${EMPRESA.ciudad}. Cotización válida por 15 días. ¡Contáctanos!<br>${EMPRESA.email}</div>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo} ${doc.numero||""}</title>
<style>
  @page{size:letter;margin:12mm}
  *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}
  body{margin:0;color:#111}
  .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111;padding-bottom:8px}
  .brand{font-size:22px;font-weight:900;letter-spacing:.5px}
  .doc{border:2px solid #111;border-radius:6px;padding:4px 10px;text-align:center}
  .doc .t{font-size:12px;font-weight:700}.doc .n{font-size:20px;font-weight:900;color:#E8262A}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  .cli td{padding:3px 6px;font-size:12px;border:1px solid #999}
  .items th{background:#f0d9d9;border:1px solid #999;padding:5px;font-size:11px;text-align:left}
  .items td{border:1px solid #999;padding:6px;font-size:12px;vertical-align:top}
  .items td.c{text-align:center;white-space:nowrap}.items td.r,.items th.r{text-align:right}
  .tot{width:auto;float:right;margin-top:8px}
  .tot td{padding:3px 10px;font-size:12px}.tot td.tl{text-align:right;font-weight:700}.tot td.r{text-align:right;border-bottom:1px solid #ccc;min-width:120px}
  .tot tr.big td{font-size:15px;font-weight:900;color:#E8262A}
  .nota{clear:both;font-size:9px;color:#444;margin-top:14px;border-top:1px solid #ccc;padding-top:6px}
  .firmas{display:flex;gap:40px;margin-top:30px;font-size:10px;text-align:center}
  .firmas>div{flex:1}
  .blurb{margin-top:20px;font-size:11px;background:#f7f7f7;border:1px solid #ddd;border-radius:6px;padding:10px}
</style></head>
<body onload="setTimeout(function(){window.print()},250)">
  <div class="hd">
    <div><div class="brand">${EMPRESA.nombre}</div>${sedes}<div style="font-size:10px">${EMPRESA.email}</div></div>
    <div><div class="doc"><div class="t">- ${titulo} -</div><div class="n">N° ${doc.numero||"—"}</div></div><div style="font-size:11px;text-align:right;margin-top:4px">Fecha: ${docFecha(doc.timestamp)}</div></div>
  </div>
  <table class="cli"><tr>
    <td style="width:60%"><b>Cliente:</b> ${esc(c.nombre)}</td>
    <td><b>${c.docTipo||"CC/NIT"}:</b> ${esc(c.docNumero)}</td></tr>
    <tr><td><b>Dirección:</b> ${esc(c.direccion)}</td><td><b>Teléfono:</b> ${esc(c.telefono)}</td></tr>
    <tr><td colspan="2"><b>E-mail:</b> ${esc(c.email)}</td></tr>
  </table>
  <table class="items"><thead><tr><th>Cantidad</th><th>Descripción del producto</th><th class="r">Valor unit.</th><th class="r">Valor total</th></tr></thead><tbody>${rows}</tbody></table>
  <table class="tot"><tbody>${totLines}</tbody></table>
  <div class="nota"><b>NOTA:</b> ${esc(EMPRESA.nota)}</div>
  ${footer}
</body></html>`;
}

// Formato tiquete 80mm para impresora térmica (Epson TM-T20III)
function buildTirillaHtml(doc){
  const esRem=doc.tipo==="remision";
  const titulo=esRem?"REMISIÓN":"COTIZACIÓN";
  const c=doc.cliente||{};
  const line="--------------------------------";
  const money=n=>cop(n);
  const items=(doc.items||[]).map(it=>{
    const vt=it.valorTotal!=null?it.valorTotal:(Number(it.cantidad)||0)*(Number(it.valorUnit)||0);
    return `<div class="it"><div class="d">${esc(it.descripcion)}</div><div class="q">${esc(it.cantidad)} ${esc(it.unidad)} x ${money(it.valorUnit)}<span class="v">${money(vt)}</span></div></div>`;
  }).join("");
  const iva=doc.iva||{}, rete=doc.retefuente||{};
  const tot=[
    `<div class="row"><span>Subtotal</span><span>${money(doc.subtotal)}</span></div>`,
    iva.aplica?`<div class="row"><span>IVA ${iva.porc}%</span><span>${money(iva.valor)}</span></div>`:"",
    rete.aplica?`<div class="row"><span>Retefuente ${rete.porc}%</span><span>-${money(rete.valor)}</span></div>`:"",
    `<div class="row big"><span>TOTAL</span><span>${money(doc.total)}</span></div>`,
    esRem?`<div class="row"><span>Abono</span><span>${money(doc.abono)}</span></div>`:"",
    esRem?`<div class="row"><span>Saldo</span><span>${money(doc.saldo)}</span></div>`:"",
  ].join("");
  const sedes=EMPRESA.sedes.map(s=>`<div class="sede">${s.nombre}<br>${s.dir}<br>${s.tels}</div>`).join("");
  const pie=esRem
    ? `<div class="nota">${esc(EMPRESA.nota)}</div><div class="firma">Recibido conforme:<br><br>____________________</div><div class="ty">¡Gracias por su compra!</div>`
    : `<div class="nota">Cotización válida por 15 días. Somos ${EMPRESA.nombre}: fabricamos e importamos malla, postes y más.</div><div class="ty">¡Gracias por preferirnos!</div>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo} ${doc.numero||""}</title>
<style>
  @page{size:80mm auto;margin:0}
  *{box-sizing:border-box}
  body{width:80mm;margin:0;padding:3mm 3mm 6mm;font-family:'Segoe UI',Arial,sans-serif;color:#000;font-size:12px;line-height:1.35}
  .center{text-align:center}
  .brand{font-weight:900;font-size:15px;text-align:center}
  .sede{text-align:center;font-size:10px;margin-top:2px}
  .email{text-align:center;font-size:10px;margin-top:2px}
  .sep{border-top:1px dashed #000;margin:6px 0}
  .doc{display:flex;justify-content:space-between;font-weight:800;font-size:13px}
  .cli{font-size:11px;margin-top:2px}
  .it{margin:4px 0}
  .it .d{font-size:11px}
  .it .q{display:flex;justify-content:space-between;font-size:11px;color:#000}
  .it .q .v{font-weight:700}
  .row{display:flex;justify-content:space-between;font-size:12px}
  .row.big{font-weight:900;font-size:14px;margin:2px 0}
  .nota{font-size:9px;margin-top:6px}
  .firma{font-size:10px;margin-top:14px}
  .ty{text-align:center;font-weight:700;margin-top:8px;font-size:12px}
</style></head>
<body onload="setTimeout(function(){window.print()},250)">
  <div class="brand">${EMPRESA.nombre}</div>
  ${sedes}
  <div class="email">${EMPRESA.email}</div>
  <div class="sep"></div>
  <div class="doc"><span>${titulo}</span><span>N° ${doc.numero||"—"}</span></div>
  <div class="cli">Fecha: ${docFecha(doc.timestamp)}</div>
  <div class="cli">Cliente: ${esc(c.nombre)}</div>
  <div class="cli">${c.docTipo||"Doc"}: ${esc(c.docNumero)}${c.telefono?` · Tel: ${esc(c.telefono)}`:""}</div>
  ${c.direccion?`<div class="cli">Dir: ${esc(c.direccion)}</div>`:""}
  <div class="sep"></div>
  ${items}
  <div class="sep"></div>
  ${tot}
  <div class="sep"></div>
  ${pie}
</body></html>`;
}

function imprimirDocumento(doc,formato){
  const w=window.open("","_blank");
  if(!w){ alert("Permite las ventanas emergentes para imprimir."); return; }
  const html=formato==="carta"?buildDocHtml(doc):buildTirillaHtml(doc);
  w.document.open(); w.document.write(html); w.document.close();
}
function waDocLink(doc){
  const c=doc.cliente||{};
  const digits=(c.telefono||"").replace(/\D/g,"");
  const phone=digits?(digits.startsWith("57")?digits:"57"+digits):"";
  const lineas=(doc.items||[]).map(it=>`• ${it.cantidad||""} ${it.unidad||""} ${it.descripcion||""} — ${cop((Number(it.cantidad)||0)*(Number(it.valorUnit)||0))}`).join("\n");
  const titulo=doc.tipo==="remision"?"REMISIÓN":"COTIZACIÓN";
  const txt=`*${EMPRESA.nombre}*\n${titulo} N° ${doc.numero||""}\n\n${lineas}\n\n*Total: ${cop(doc.total)}*\n\n${doc.tipo==="cotizacion"?"Cotización válida por 15 días. ":""}${EMPRESA.email}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(txt)}`;
}
function mailtoDoc(doc){
  const c=doc.cliente||{};
  const titulo=doc.tipo==="remision"?"Remisión":"Cotización";
  const body=`${titulo} N° ${doc.numero||""} - ${EMPRESA.nombre}\n\nTotal: ${cop(doc.total)}\n\n${EMPRESA.email}`;
  return `mailto:${c.email||""}?subject=${encodeURIComponent(titulo+" N° "+(doc.numero||"")+" - "+EMPRESA.nombre)}&body=${encodeURIComponent(body)}`;
}

function VentasTab({remisiones,user,canProd,onNueva,onImprimir}){
  const [q,setQ]=useState("");const [filtro,setFiltro]=useState("todas");
  const lista=[...remisiones]
    .filter(d=>filtro==="todas"||d.tipo===(filtro==="remisiones"?"remision":"cotizacion"))
    .filter(d=>String(d.numero).includes(q)||String(d.cliente?.nombre||"").toLowerCase().includes(q.toLowerCase()))
    .sort((a,b)=>b.timestamp-a.timestamp);
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:6}}>
          {[["todas","Todas"],["remisiones","Remisiones"],["cotizaciones","Cotizaciones"]].map(([v,l])=>(
            <button key={v} onClick={()=>setFiltro(v)} style={{background:filtro===v?"#1e293b":"#f8fafc",border:"1.5px solid",borderColor:filtro===v?"#1e293b":"#e2e8f0",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:13,fontWeight:600,color:filtro===v?"#fff":"#64748b"}}>{l}</button>
          ))}
        </div>
        <input style={{...inp,flex:1,minWidth:160}} placeholder="Buscar por N° o cliente..." value={q} onChange={e=>setQ(e.target.value)}/>
        {canProd&&<button onClick={()=>onNueva("cotizacion")} style={{...btnS,fontWeight:700}}>+ Cotización</button>}
        {canProd&&<button onClick={()=>onNueva("remision")} style={btnR}>+ Nueva Remisión</button>}
      </div>
      <div style={{fontSize:14,color:"#94a3b8",marginBottom:10}}>{lista.length} documento(s)</div>
      {lista.length===0?(
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #e2e8f0",textAlign:"center",padding:"56px 0",color:"#94a3b8"}}>
          <div style={{fontSize:34,marginBottom:10}}>🧾</div>
          <div style={{fontWeight:600}}>Aún no hay remisiones ni cotizaciones</div>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {lista.map(d=>{
            const esRem=d.tipo==="remision";
            return(
              <div key={d.id} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"12px 14px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                  <span style={{background:esRem?"#fef2f2":"#eff6ff",color:esRem?RED:"#1d4ed8",borderRadius:999,padding:"1px 10px",fontSize:12,fontWeight:800}}>{esRem?"REMISIÓN":"COTIZACIÓN"}</span>
                  <span style={{fontWeight:900,color:"#1e293b",fontSize:16}}>N° {d.numero}</span>
                  <span style={{fontWeight:600,color:"#334155",fontSize:15}}>{d.cliente?.nombre||"—"}</span>
                  {esRem&&d.origen&&<span style={{fontSize:12,color:"#94a3b8"}}>· {d.origen==="stock"?"desde stock":"desde producción"}</span>}
                  <span style={{marginLeft:"auto",fontWeight:800,color:"#1e293b"}}>{cop(d.total)}</span>
                </div>
                <div style={{fontSize:12,color:"#94a3b8",marginBottom:8}}>{d.creadoPorNombre} · {fmtDate(d.timestamp)}{esRem&&d.saldo>0?` · Saldo ${cop(d.saldo)}`:""}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <button onClick={()=>onImprimir(d)} style={{...btnS,padding:"5px 12px",fontSize:14,fontWeight:700}}>Ver / Imprimir</button>
                  <a href={waDocLink(d)} target="_blank" rel="noreferrer" style={{textDecoration:"none",background:"#f0fdf4",border:"1px solid #86efac",borderRadius:8,padding:"5px 12px",color:"#15803d",fontSize:14,fontWeight:700}}>WhatsApp</a>
                  {d.cliente?.email&&<a href={mailtoDoc(d)} style={{textDecoration:"none",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"5px 12px",color:"#1d4ed8",fontSize:14,fontWeight:700}}>Email</a>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NuevaVentaModal({tipo:tipoInit,user,inventario,orders,clientes,onClose,onCreate,onDone}){
  const [tipo,setTipo]=useState(tipoInit||"remision");
  const esRem=tipo==="remision";
  const [origen,setOrigen]=useState("stock");
  const [ordenRef,setOrdenRef]=useState(null);
  const [sede,setSede]=useState(user.sede==="Ambas Sedes"||!SEDES.includes(user.sede)?"Centro":user.sede);
  const [cli,setCli]=useState({docTipo:"NIT",docNumero:"",nombre:"",telefono:"",email:"",direccion:""});
  const [items,setItems]=useState([{productoId:null,descripcion:"",cantidad:"",unidad:"",valorUnit:""}]);
  const [ivaOn,setIvaOn]=useState(false);const [ivaPorc,setIvaPorc]=useState(String(IVA_DEFAULT));
  const [reteOn,setReteOn]=useState(false);const [retePorc,setRetePorc]=useState(String(RETE_DEFAULT));
  const [abono,setAbono]=useState("");
  const [qOrden,setQOrden]=useState("");
  const [loading,setLoading]=useState(false);const [err,setErr]=useState("");

  const setItem=(i,k,v)=>setItems(p=>p.map((x,idx)=>idx===i?{...x,[k]:v}:x));
  const addItem=()=>setItems(p=>[...p,{productoId:null,descripcion:"",cantidad:"",unidad:"",valorUnit:""}]);
  const rmItem=i=>setItems(p=>p.filter((_,idx)=>idx!==i));

  // Buscar cliente por documento
  const buscarCli=num=>{
    setCli(c=>({...c,docNumero:num}));
    const found=clientes.find(x=>String(x.docNumero||"")===String(num));
    if(found) setCli({docTipo:found.docTipo||"NIT",docNumero:found.docNumero||"",nombre:found.nombre||"",telefono:found.telefono||"",email:found.email||"",direccion:found.direccion||""});
  };
  // Elegir orden de producción -> prefill
  const ordersFil=orders.filter(o=>String(o.orden).includes(qOrden)||String(o.cliente||"").toLowerCase().includes(qOrden.toLowerCase())).slice(0,6);
  const pickOrden=o=>{
    setOrdenRef(o.orden);
    setCli(c=>({...c,nombre:o.cliente||c.nombre}));
    const its=normalizeItems(o).map(it=>({productoId:null,descripcion:`${labelProducto(it.producto)} — ${resumenItem(it)}`,cantidad:it.metros||it.cantidad||"",unidad:it.producto==="postes"?"unidades":"m²",valorUnit:it.precioVenta||""}));
    setItems(its.length?its:[{productoId:null,descripcion:"",cantidad:"",unidad:"",valorUnit:""}]);
    setQOrden("");
  };
  const pickProducto=(i,pid)=>{
    const p=inventario.find(x=>x.id===pid);
    setItems(prev=>prev.map((x,idx)=>idx===i?{...x,productoId:pid||null,descripcion:p?p.nombre:x.descripcion,unidad:p?p.unidad:x.unidad}:x));
  };

  const subtotal=items.reduce((a,it)=>a+(Number(it.cantidad)||0)*(Number(it.valorUnit)||0),0);
  const ivaVal=ivaOn?Math.round(subtotal*(Number(ivaPorc)||0)/100):0;
  const reteVal=reteOn?Math.round(subtotal*(Number(retePorc)||0)/100):0;
  const total=subtotal+ivaVal-reteVal;
  const saldo=Math.max(0,total-(Number(abono)||0));

  const submit=async()=>{
    if(!cli.nombre.trim()){setErr("Ingresa el nombre del cliente");return;}
    const its=items.filter(it=>it.descripcion&&Number(it.cantidad)>0);
    if(its.length===0){setErr("Agrega al menos un producto con cantidad");return;}
    if(esRem&&origen==="stock"){
      for(const it of its){
        if(it.productoId){
          const p=inventario.find(x=>x.id===it.productoId);
          const disp=Number(p?.stock?.[sede])||0;
          if(Number(it.cantidad)>disp){setErr(`Stock insuficiente de "${p?.nombre}" en ${sede} (hay ${disp} ${p?.unidad})`);return;}
        }
      }
    }
    const data={
      tipo, origen:esRem?origen:null, ordenRef:esRem&&origen==="produccion"?ordenRef:null,
      sede, cliente:{...cli,nombre:cli.nombre.trim()},
      items:its.map(it=>({productoId:it.productoId||null,descripcion:it.descripcion,cantidad:Number(it.cantidad)||0,unidad:it.unidad||"",valorUnit:Number(it.valorUnit)||0,valorTotal:(Number(it.cantidad)||0)*(Number(it.valorUnit)||0)})),
      subtotal, iva:{aplica:ivaOn,porc:Number(ivaPorc)||0,valor:ivaVal}, retefuente:{aplica:reteOn,porc:Number(retePorc)||0,valor:reteVal},
      total, abono:esRem?Number(abono)||0:0, saldo:esRem?saldo:0,
    };
    setLoading(true);
    const r=await onCreate(data);
    setLoading(false);
    onDone({...data,numero:r?.numero,timestamp:Date.now(),creadoPorNombre:user.name});
  };

  return(
    <Modal title={esRem?"Nueva Remisión (venta)":"Nueva Cotización"} onClose={onClose} maxWidth={680}>
      {/* Tipo + origen */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        {[["remision","Remisión (venta)"],["cotizacion","Cotización"]].map(([v,l])=>(
          <button key={v} onClick={()=>setTipo(v)} style={{flex:1,minWidth:130,border:`2px solid ${tipo===v?RED:"#e2e8f0"}`,background:tipo===v?"#fef2f2":"#fff",borderRadius:10,padding:"8px",cursor:"pointer",fontWeight:700,color:tipo===v?RED:"#334155"}}>{l}</button>
        ))}
      </div>
      {esRem&&(
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          {[["stock","Vender desde stock"],["produccion","Desde orden de producción"]].map(([v,l])=>(
            <button key={v} onClick={()=>{setOrigen(v);setOrdenRef(null);}} style={{flex:1,border:`2px solid ${origen===v?"#7c3aed":"#e2e8f0"}`,background:origen===v?"#f5f3ff":"#fff",borderRadius:10,padding:"7px",cursor:"pointer",fontWeight:700,fontSize:13,color:origen===v?"#7c3aed":"#334155"}}>{l}</button>
          ))}
        </div>
      )}

      {/* Orden de producción */}
      {esRem&&origen==="produccion"&&(
        <div style={{marginBottom:12,background:"#f5f3ff",border:"1px solid #ddd6fe",borderRadius:10,padding:10}}>
          {ordenRef?(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:14,fontWeight:700,color:"#6d28d9"}}>Orden #{ordenRef} seleccionada</span>
              <button onClick={()=>{setOrdenRef(null);}} style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:13}}>Cambiar</button>
            </div>
          ):(
            <>
              <input style={{...inp,fontSize:13,marginBottom:6}} placeholder="Buscar orden por N° o cliente..." value={qOrden} onChange={e=>setQOrden(e.target.value)}/>
              {qOrden&&ordersFil.map(o=>(
                <div key={o.orden} onClick={()=>pickOrden(o)} style={{padding:"6px 8px",borderRadius:8,cursor:"pointer",fontSize:13,color:"#334155",background:"#fff",border:"1px solid #e2e8f0",marginBottom:4}}>#{o.orden} · {o.cliente}</div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Sede */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
        <div>
          <label style={{fontSize:13,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>Sede</label>
          <select style={{...inp,fontSize:13}} value={sede} onChange={e=>setSede(e.target.value)}>{SEDES.map(s=><option key={s} value={s}>{s}</option>)}</select>
        </div>
        <div>
          <label style={{fontSize:13,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>Documento</label>
          <select style={{...inp,fontSize:13}} value={cli.docTipo} onChange={e=>setCli(c=>({...c,docTipo:e.target.value}))}><option value="NIT">NIT</option><option value="CC">CC</option></select>
        </div>
        <div>
          <label style={{fontSize:13,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>N° documento</label>
          <input style={{...inp,fontSize:13}} value={cli.docNumero} onChange={e=>buscarCli(e.target.value)} placeholder="830109420-1"/>
        </div>
      </div>

      {/* Datos del cliente (se actualizan al imprimir) */}
      <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"8px 12px",fontSize:12,color:"#1d4ed8",marginBottom:8}}>Al guardar, estos datos del cliente se actualizan/guardan automáticamente (nombre, teléfono, correo, dirección).</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:6}}>
        <div><label style={{fontSize:13,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>Cliente *</label><input style={inp} value={cli.nombre} onChange={e=>{setCli(c=>({...c,nombre:e.target.value}));setErr("");}} list="cli-list"/><datalist id="cli-list">{clientes.map(c=><option key={c.id} value={c.nombre}/>)}</datalist></div>
        <div><label style={{fontSize:13,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>Teléfono</label><input style={inp} value={cli.telefono} onChange={e=>setCli(c=>({...c,telefono:e.target.value}))}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <div><label style={{fontSize:13,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>E-mail</label><input style={inp} value={cli.email} onChange={e=>setCli(c=>({...c,email:e.target.value}))} placeholder="cliente@correo.com"/></div>
        <div><label style={{fontSize:13,fontWeight:600,color:"#64748b",display:"block",marginBottom:4}}>Dirección</label><input style={inp} value={cli.direccion} onChange={e=>setCli(c=>({...c,direccion:e.target.value}))}/></div>
      </div>

      {/* Items */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <label style={{fontSize:14,fontWeight:700,color:"#334155"}}>Productos ({items.length})</label>
        <button onClick={addItem} style={{background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:10,padding:"5px 12px",cursor:"pointer",color:GREEN,fontSize:13,fontWeight:700}}>+ Agregar</button>
      </div>
      {items.map((it,i)=>{
        const prod=it.productoId?inventario.find(x=>x.id===it.productoId):null;
        const disp=prod?Number(prod.stock?.[sede])||0:null;
        return(
          <div key={i} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:10,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:12,fontWeight:700,color:"#64748b"}}>Item {i+1}{disp!=null?` · disponible: ${disp} ${prod.unidad}`:""}</span>
              {items.length>1&&<button onClick={()=>rmItem(i)} style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:12}}>✕</button>}
            </div>
            {esRem&&origen==="stock"&&(
              <select style={{...inp,fontSize:13,marginBottom:6}} value={it.productoId||""} onChange={e=>pickProducto(i,e.target.value)}>
                <option value="">Elegir producto del inventario...</option>
                {inventario.map(p=><option key={p.id} value={p.id}>{p.nombre} ({Number(p.stock?.[sede])||0} {p.unidad})</option>)}
              </select>
            )}
            <input style={{...inp,fontSize:13,marginBottom:6}} placeholder="Descripción del producto" value={it.descripcion} onChange={e=>setItem(i,"descripcion",e.target.value)}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,alignItems:"end"}}>
              <div><label style={{fontSize:11,color:"#94a3b8"}}>Cantidad</label><input style={{...inp,fontSize:13}} type="number" value={it.cantidad} onChange={e=>{setItem(i,"cantidad",e.target.value);setErr("");}}/></div>
              <div><label style={{fontSize:11,color:"#94a3b8"}}>Unidad</label><input style={{...inp,fontSize:13}} value={it.unidad} onChange={e=>setItem(i,"unidad",e.target.value)} placeholder="m² / rollos"/></div>
              <div><label style={{fontSize:11,color:"#94a3b8"}}>Valor unit.</label><input style={{...inp,fontSize:13}} type="number" value={it.valorUnit} onChange={e=>setItem(i,"valorUnit",e.target.value)}/></div>
              <div style={{textAlign:"right",fontSize:13,fontWeight:700,color:"#1e293b",paddingBottom:8}}>{cop((Number(it.cantidad)||0)*(Number(it.valorUnit)||0))}</div>
            </div>
          </div>
        );
      })}

      {/* Impuestos */}
      <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:10,marginTop:4}}>
        <label style={{display:"flex",alignItems:"center",gap:6,fontSize:14,color:"#334155",cursor:"pointer"}}>
          <input type="checkbox" checked={ivaOn} onChange={e=>setIvaOn(e.target.checked)}/> IVA
          {ivaOn&&<input style={{...inp,width:60,padding:"4px 8px",fontSize:13}} type="number" value={ivaPorc} onChange={e=>setIvaPorc(e.target.value)}/>}{ivaOn&&"%"}
        </label>
        <label style={{display:"flex",alignItems:"center",gap:6,fontSize:14,color:"#334155",cursor:"pointer"}}>
          <input type="checkbox" checked={reteOn} onChange={e=>setReteOn(e.target.checked)}/> Retefuente
          {reteOn&&<input style={{...inp,width:60,padding:"4px 8px",fontSize:13}} type="number" value={retePorc} onChange={e=>setRetePorc(e.target.value)}/>}{reteOn&&"%"}
        </label>
      </div>

      {/* Totales */}
      <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:14,color:"#64748b"}}><span>Subtotal</span><span>{cop(subtotal)}</span></div>
        {ivaOn&&<div style={{display:"flex",justifyContent:"space-between",fontSize:14,color:"#64748b"}}><span>IVA ({ivaPorc}%)</span><span>{cop(ivaVal)}</span></div>}
        {reteOn&&<div style={{display:"flex",justifyContent:"space-between",fontSize:14,color:"#64748b"}}><span>Retefuente ({retePorc}%)</span><span>- {cop(reteVal)}</span></div>}
        <div style={{display:"flex",justifyContent:"space-between",fontSize:17,fontWeight:900,color:"#1e293b",marginTop:4}}><span>TOTAL</span><span>{cop(total)}</span></div>
        {esRem&&(
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,gap:8}}>
            <span style={{fontSize:14,color:"#64748b"}}>Abono</span>
            <input style={{...inp,width:140,fontSize:13,textAlign:"right"}} type="number" value={abono} onChange={e=>setAbono(e.target.value)} placeholder="0"/>
            <span style={{fontSize:14,color:"#64748b"}}>Saldo</span>
            <span style={{fontSize:15,fontWeight:800,color:saldo>0?RED:GREEN}}>{cop(saldo)}</span>
          </div>
        )}
      </div>

      {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 12px",color:"#dc2626",fontSize:14,marginBottom:12}}>⚠ {err}</div>}
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{...btnS,flex:1}}>Cancelar</button>
        <button onClick={submit} disabled={loading} style={{...btnR,flex:2}}>{loading?"Guardando...":esRem?"Guardar y ver remisión":"Guardar y ver cotización"}</button>
      </div>
    </Modal>
  );
}

function VerDocumentoModal({doc,onClose}){
  const esRem=doc.tipo==="remision";
  return(
    <Modal title={`${esRem?"Remisión":"Cotización"} N° ${doc.numero||""}`} onClose={onClose} maxWidth={520}>
      <div style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:14,color:"#15803d",fontWeight:700}}>
        ✓ Guardado{esRem&&doc.origen==="stock"?" — el stock ya fue descontado":""}
      </div>
      <div style={{border:"1px solid #e2e8f0",borderRadius:10,padding:14,marginBottom:14}}>
        <div style={{fontWeight:800,fontSize:16,color:"#1e293b"}}>{doc.cliente?.nombre||"—"}</div>
        <div style={{fontSize:13,color:"#94a3b8",marginBottom:8}}>{doc.cliente?.docTipo} {doc.cliente?.docNumero} · {docFecha(doc.timestamp)}</div>
        {(doc.items||[]).map((it,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#475569",padding:"3px 0",borderBottom:"1px solid #f1f5f9"}}>
            <span>{it.cantidad} {it.unidad} · {it.descripcion}</span>
            <span style={{fontWeight:600}}>{cop(it.valorTotal)}</span>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",fontWeight:900,fontSize:16,marginTop:8,color:"#1e293b"}}><span>TOTAL</span><span>{cop(doc.total)}</span></div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <button onClick={()=>imprimirDocumento(doc,"tirilla")} style={{...btnR,width:"100%"}}>🖨 Imprimir tiquete (Epson TM-T20)</button>
        <button onClick={()=>imprimirDocumento(doc,"carta")} style={{...btnS,width:"100%",fontWeight:700}}>📄 PDF tamaño carta (para email)</button>
        <div style={{display:"flex",gap:8}}>
          <a href={waDocLink(doc)} target="_blank" rel="noreferrer" style={{flex:1,textAlign:"center",textDecoration:"none",...btnG,padding:"11px"}}>Enviar por WhatsApp</a>
          <a href={mailtoDoc(doc)} style={{flex:1,textAlign:"center",textDecoration:"none",...btnS,padding:"11px",fontWeight:700}}>Enviar por Email</a>
        </div>
        <button onClick={onClose} style={{...btnS,width:"100%"}}>Cerrar</button>
      </div>
    </Modal>
  );
}

// ═══ CLIENTES (mini-CRM) ═══════════════════════════════════
function ClientesTab({clientes,remisiones,orders,isG,canProd,onVer,onEditar,onFusionar,onSync}){
  const [q,setQ]=useState("");
  // Mapa: cualquier id (nombre o alias) -> id del cliente canónico
  const idToOwner={};
  clientes.forEach(c=>clienteMatchIds(c).forEach(id=>{ idToOwner[id]=c.id; }));
  const owner=nombre=>{ const k=clienteId(nombre); return idToOwner[k]||k; };
  const remStats={},ordStats={};
  (remisiones||[]).forEach(d=>{ const k=owner(d.cliente?.nombre); if(!k) return; (remStats[k]=remStats[k]||{docs:0,total:0}); remStats[k].docs++; remStats[k].total+=Number(d.total)||0; });
  (orders||[]).forEach(o=>{ if(esStockCliente(o.cliente)) return; const k=owner(o.cliente); if(!k) return; ordStats[k]=(ordStats[k]||0)+1; });
  const lista=[...clientes]
    .filter(c=>String(c.nombre||"").toLowerCase().includes(q.toLowerCase())||String(c.docNumero||"").includes(q))
    .sort((a,b)=>String(a.nombre||"").localeCompare(String(b.nombre||"")));
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <input style={{...inp,flex:1,minWidth:200}} placeholder="Buscar cliente por nombre o documento..." value={q} onChange={e=>setQ(e.target.value)}/>
        {onFusionar&&<button onClick={onFusionar} style={{...btnS,fontWeight:700}}>🔗 Fusionar duplicados</button>}
        {onSync&&<button onClick={onSync} style={{...btnS,fontWeight:700}}>🔄 Sincronizar desde órdenes</button>}
      </div>
      <div style={{fontSize:14,color:"#94a3b8",marginBottom:10}}>{lista.length} cliente(s)</div>
      {lista.length===0?(
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #e2e8f0",textAlign:"center",padding:"56px 0",color:"#94a3b8"}}>
          <div style={{fontSize:34,marginBottom:10}}>👤</div>
          <div style={{fontWeight:600}}>Aún no hay clientes</div>
          <div style={{fontSize:13,marginTop:4}}>Se crean solos con cada orden y venta. Usa "Sincronizar desde órdenes" para traer los existentes.</div>
        </div>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
          {lista.map(c=>{
            const rs=remStats[c.id]||{docs:0,total:0};
            const oc=ordStats[c.id]||0;
            return(
              <div key={c.id} onClick={()=>onVer&&onVer(c)} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:"14px 16px",cursor:onVer?"pointer":"default"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:800,color:"#1e293b",fontSize:16}}>{c.nombre||"—"}</div>
                    <div style={{fontSize:13,color:"#94a3b8"}}>{c.docTipo||"Doc"}: {c.docNumero||"—"}</div>
                  </div>
                  {onEditar&&<button onClick={e=>{e.stopPropagation();onEditar(c);}} style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:8,padding:"4px 10px",cursor:"pointer",color:"#0369a1",fontSize:13,fontWeight:600}}>Editar</button>}
                </div>
                <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:2,fontSize:13,color:"#475569"}}>
                  <div>📞 {c.telefono||<span style={{color:"#cbd5e1"}}>sin teléfono</span>}</div>
                  <div>✉ {c.email||<span style={{color:"#cbd5e1"}}>sin correo</span>}</div>
                  <div>📍 {c.direccion||<span style={{color:"#cbd5e1"}}>sin dirección</span>}</div>
                </div>
                <div style={{marginTop:10,paddingTop:8,borderTop:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",fontSize:13}}>
                  <span style={{color:"#94a3b8"}}>{oc} orden(es) · {rs.docs} venta(s)</span>
                  <span style={{fontWeight:700,color:"#1e293b"}}>{cop(rs.total)}</span>
                </div>
                {onVer&&<div style={{marginTop:6,fontSize:12,color:"#4338ca",fontWeight:600}}>Ver historial →</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClienteModal({cli,onClose,onSave}){
  const [c,setC]=useState({docTipo:cli?.docTipo||"NIT",docNumero:cli?.docNumero||"",nombre:cli?.nombre||"",telefono:cli?.telefono||"",email:cli?.email||"",direccion:cli?.direccion||""});
  const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  const set=(k,v)=>setC(p=>({...p,[k]:v}));
  const submit=async()=>{
    if(!c.nombre.trim()){setErr("El nombre no puede quedar vacío");return;}
    setLoading(true);
    await onSave({...cli,...c,nombre:c.nombre.trim(),id:cli.id});
    setLoading(false);onClose();
  };
  return(
    <Modal title={`Editar cliente`} onClose={onClose} maxWidth={480}>
      <Field label="Nombre *"><input style={inp} value={c.nombre} onChange={e=>{set("nombre",e.target.value);setErr("");}}/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:10}}>
        <Field label="Tipo"><select style={inp} value={c.docTipo} onChange={e=>set("docTipo",e.target.value)}><option value="NIT">NIT</option><option value="CC">CC</option></select></Field>
        <Field label="N° documento"><input style={inp} value={c.docNumero} onChange={e=>set("docNumero",e.target.value)}/></Field>
      </div>
      <Field label="Teléfono"><input style={inp} value={c.telefono} onChange={e=>set("telefono",e.target.value)}/></Field>
      <Field label="E-mail"><input style={inp} value={c.email} onChange={e=>set("email",e.target.value)}/></Field>
      <Field label="Dirección"><input style={inp} value={c.direccion} onChange={e=>set("direccion",e.target.value)}/></Field>
      {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 12px",color:"#dc2626",fontSize:14,marginBottom:12}}>⚠ {err}</div>}
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{...btnS,flex:1}}>Cancelar</button>
        <button onClick={submit} disabled={loading} style={{...btnR,flex:2}}>{loading?"Guardando...":"Guardar cambios"}</button>
      </div>
    </Modal>
  );
}

// ═══ PASAR ORDEN (no comprada) A INVENTARIO ════════════════
function PasarInventarioModal({order,inventario,onClose,onSave}){
  const items=normalizeItems(order);
  const [asigns,setAsigns]=useState(items.map(it=>({
    productoId:"", sede:order.sede&&SEDES.includes(order.sede)?order.sede:"Centro",
    cant: it.producto==="postes"?(it.cantidad||""):(it.metros||it.cantidad||""),
    descripcion:`${labelProducto(it.producto)} — ${resumenItem(it)}`,
  })));
  const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  const setA=(i,k,v)=>setAsigns(p=>p.map((x,idx)=>idx===i?{...x,[k]:v}:x));
  const submit=async()=>{
    const validas=asigns.filter(a=>a.productoId&&Number(a.cant)>0);
    if(validas.length===0){setErr("Asigna al menos un producto del catálogo con cantidad");return;}
    setLoading(true);
    await onSave(order.orden,validas);
    setLoading(false);onClose();
  };
  return(
    <Modal title={`Pasar orden #${order.orden} a inventario`} onClose={onClose} maxWidth={620}>
      <div style={{background:"#f5f3ff",border:"1px solid #ddd6fe",borderRadius:10,padding:"9px 14px",fontSize:13,color:"#6d28d9",marginBottom:14}}>
        Úsalo cuando el cliente <strong>no compró</strong> la orden. Cada producto que asignes se <strong>suma al stock</strong> de la sede elegida. Los productos deben existir en el catálogo de Inventario.
      </div>
      {inventario.length===0&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 12px",color:"#dc2626",fontSize:13,marginBottom:12}}>No hay productos en el inventario todavía. Créalos primero en el tab 📦 Inventario.</div>}
      {asigns.map((a,i)=>(
        <div key={i} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:12,marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:700,color:"#334155",marginBottom:8}}>{a.descripcion}</div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:8}}>
            <div>
              <label style={{fontSize:11,color:"#94a3b8",display:"block",marginBottom:3}}>Producto del catálogo</label>
              <select style={{...inp,fontSize:13}} value={a.productoId} onChange={e=>setA(i,"productoId",e.target.value)}>
                <option value="">— No pasar —</option>
                {inventario.map(p=><option key={p.id} value={p.id}>{p.nombre} ({p.unidad})</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,color:"#94a3b8",display:"block",marginBottom:3}}>Sede</label>
              <select style={{...inp,fontSize:13}} value={a.sede} onChange={e=>setA(i,"sede",e.target.value)}>{SEDES.map(s=><option key={s} value={s}>{s}</option>)}</select>
            </div>
            <div>
              <label style={{fontSize:11,color:"#94a3b8",display:"block",marginBottom:3}}>Cantidad</label>
              <input style={{...inp,fontSize:13}} type="number" value={a.cant} onChange={e=>{setA(i,"cant",e.target.value);setErr("");}}/>
            </div>
          </div>
        </div>
      ))}
      {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 12px",color:"#dc2626",fontSize:14,marginBottom:12}}>⚠ {err}</div>}
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{...btnS,flex:1}}>Cancelar</button>
        <button onClick={submit} disabled={loading||inventario.length===0} style={{...btnR,flex:2}}>{loading?"Pasando...":"Pasar a inventario"}</button>
      </div>
    </Modal>
  );
}

// ═══ DETALLE DE CLIENTE (historial de órdenes y ventas) ════
function ClienteDetalleModal({cli,orders,remisiones,onClose,onEditar,onVerOrden}){
  const ids=clienteMatchIds(cli);
  const ordenesCli=(orders||[]).filter(o=>!esStockCliente(o.cliente)&&ids.has(clienteId(o.cliente))).sort((a,b)=>b.timestamp-a.timestamp);
  const ventasCli=(remisiones||[]).filter(d=>ids.has(clienteId(d.cliente?.nombre))).sort((a,b)=>b.timestamp-a.timestamp);
  const totalComprado=ventasCli.reduce((a,d)=>a+(Number(d.total)||0),0);
  return(
    <Modal title="Ficha del cliente" onClose={onClose} maxWidth={600}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:12}}>
        <div>
          <div style={{fontSize:20,fontWeight:900,color:"#1e293b"}}>{cli.nombre}</div>
          <div style={{fontSize:13,color:"#94a3b8"}}>{cli.docTipo||"Doc"}: {cli.docNumero||"—"}</div>
          {cli.aliases&&cli.aliases.length>0&&<div style={{fontSize:12,color:"#7c3aed",marginTop:2}}>También: {cli.aliases.join(" · ")}</div>}
        </div>
        {onEditar&&<button onClick={()=>onEditar(cli)} style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:"#0369a1",fontSize:13,fontWeight:700}}>Editar datos</button>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8,fontSize:13}}>
        <div style={{background:"#f8fafc",border:"1px solid #f1f5f9",borderRadius:10,padding:"8px 10px"}}>📞 {cli.telefono||"—"}</div>
        <div style={{background:"#f8fafc",border:"1px solid #f1f5f9",borderRadius:10,padding:"8px 10px",overflow:"hidden",textOverflow:"ellipsis"}}>✉ {cli.email||"—"}</div>
        <div style={{background:"#f8fafc",border:"1px solid #f1f5f9",borderRadius:10,padding:"8px 10px"}}>📍 {cli.direccion||"—"}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
        <div style={{background:"#eff6ff",borderRadius:10,padding:"8px",textAlign:"center"}}><div style={{fontSize:18,fontWeight:900,color:"#1d4ed8"}}>{ordenesCli.length}</div><div style={{fontSize:11,color:"#64748b"}}>Órdenes</div></div>
        <div style={{background:"#fef2f2",borderRadius:10,padding:"8px",textAlign:"center"}}><div style={{fontSize:18,fontWeight:900,color:RED}}>{ventasCli.length}</div><div style={{fontSize:11,color:"#64748b"}}>Ventas</div></div>
        <div style={{background:"#f0fdf4",borderRadius:10,padding:"8px",textAlign:"center"}}><div style={{fontSize:16,fontWeight:900,color:"#15803d"}}>{cop(totalComprado)}</div><div style={{fontSize:11,color:"#64748b"}}>Comprado</div></div>
      </div>

      <div style={{fontWeight:700,fontSize:14,color:"#334155",marginBottom:8}}>Órdenes de producción ({ordenesCli.length})</div>
      {ordenesCli.length===0?(
        <div style={{fontSize:13,color:"#94a3b8",marginBottom:16}}>Sin órdenes registradas.</div>
      ):(
        <div style={{maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
          {ordenesCli.map(o=>{
            const st=orderStInfo(o);const items=normalizeItems(o);
            return(
              <div key={o.orden} onClick={()=>onVerOrden&&onVerOrden(o)} style={{border:"1px solid #e2e8f0",borderRadius:10,padding:"8px 12px",cursor:onVerOrden?"pointer":"default"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontWeight:800,color:"#1e293b",fontSize:14}}>#{o.orden}</span>
                  <span style={{background:st.bg,color:st.col,borderRadius:999,padding:"1px 8px",fontSize:12,fontWeight:700}}>{st.txt}</span>
                  <span style={{marginLeft:"auto",fontSize:12,color:"#94a3b8"}}>{fmtDate(o.timestamp)}</span>
                </div>
                <div style={{marginTop:4}}><ProductoBadges items={items}/></div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{fontWeight:700,fontSize:14,color:"#334155",marginBottom:8}}>Ventas y cotizaciones ({ventasCli.length})</div>
      {ventasCli.length===0?(
        <div style={{fontSize:13,color:"#94a3b8",marginBottom:16}}>Sin ventas registradas.</div>
      ):(
        <div style={{maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
          {ventasCli.map(d=>{
            const esRem=d.tipo==="remision";
            return(
              <div key={d.id} style={{display:"flex",alignItems:"center",gap:8,border:"1px solid #e2e8f0",borderRadius:10,padding:"8px 12px"}}>
                <span style={{background:esRem?"#fef2f2":"#eff6ff",color:esRem?RED:"#1d4ed8",borderRadius:999,padding:"1px 8px",fontSize:11,fontWeight:800}}>{esRem?"REMISIÓN":"COTIZACIÓN"}</span>
                <span style={{fontWeight:700,color:"#1e293b",fontSize:14}}>N° {d.numero}</span>
                <span style={{fontSize:12,color:"#94a3b8"}}>{fmtDate(d.timestamp)}</span>
                <span style={{marginLeft:"auto",fontWeight:700,color:"#1e293b"}}>{cop(d.total)}</span>
              </div>
            );
          })}
        </div>
      )}

      <button onClick={onClose} style={{width:"100%",background:DARK,border:"none",borderRadius:10,padding:"11px",fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer"}}>Cerrar</button>
    </Modal>
  );
}

// ═══ FUSIONAR CLIENTES DUPLICADOS ══════════════════════════
function FusionarClientesModal({clientes,onClose,onMerge}){
  const [primaryId,setPrimaryId]=useState("");
  const [sel,setSel]=useState({});
  const [q,setQ]=useState("");
  const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  const orden=[...clientes].sort((a,b)=>String(a.nombre||"").localeCompare(String(b.nombre||"")));
  const primary=clientes.find(c=>c.id===primaryId);
  const toggle=id=>setSel(s=>({...s,[id]:!s[id]}));
  const dupeIds=Object.keys(sel).filter(id=>sel[id]&&id!==primaryId);
  const otros=orden.filter(c=>c.id!==primaryId&&String(c.nombre||"").toLowerCase().includes(q.toLowerCase()));
  const submit=async()=>{
    if(!primaryId){setErr("Elige el cliente principal");return;}
    if(dupeIds.length===0){setErr("Marca al menos un cliente duplicado");return;}
    setLoading(true);
    await onMerge(primaryId,dupeIds);
    setLoading(false);onClose();
  };
  return(
    <Modal title="Fusionar clientes duplicados" onClose={onClose} maxWidth={560}>
      <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"9px 14px",fontSize:13,color:"#1d4ed8",marginBottom:14}}>
        Elige el <strong>cliente principal</strong> y marca los que son el mismo con otro nombre. Sus órdenes y ventas quedarán todas bajo el principal, y los duplicados se eliminan.
      </div>
      <div style={{marginBottom:12}}>
        <label style={{fontSize:14,fontWeight:700,color:"#334155",display:"block",marginBottom:5}}>Cliente principal</label>
        <select style={inp} value={primaryId} onChange={e=>{setPrimaryId(e.target.value);setSel({});setErr("");}}>
          <option value="">Seleccionar...</option>
          {orden.map(c=><option key={c.id} value={c.id}>{c.nombre}{c.docNumero?` (${c.docNumero})`:""}</option>)}
        </select>
      </div>
      {primary&&(
        <>
          <label style={{fontSize:14,fontWeight:700,color:"#334155",display:"block",marginBottom:6}}>Duplicados de "{primary.nombre}" ({dupeIds.length})</label>
          <input style={{...inp,fontSize:13,marginBottom:8}} placeholder="Buscar..." value={q} onChange={e=>setQ(e.target.value)}/>
          <div style={{maxHeight:260,overflowY:"auto",display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
            {otros.map(c=>(
              <div key={c.id} onClick={()=>toggle(c.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:10,cursor:"pointer",border:`1.5px solid ${sel[c.id]?"#7c3aed":"#e2e8f0"}`,background:sel[c.id]?"#f5f3ff":"#fff"}}>
                <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${sel[c.id]?"#7c3aed":"#cbd5e1"}`,background:sel[c.id]?"#7c3aed":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{sel[c.id]&&<span style={{color:"#fff",fontSize:12,fontWeight:900}}>✓</span>}</div>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600,color:"#334155"}}>{c.nombre}</div>
                  <div style={{fontSize:12,color:"#94a3b8"}}>{c.docNumero||"sin doc"}{c.telefono?` · ${c.telefono}`:""}</div>
                </div>
              </div>
            ))}
            {otros.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:"16px 0",fontSize:13}}>No hay otros clientes</div>}
          </div>
        </>
      )}
      {err&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 12px",color:"#dc2626",fontSize:14,marginBottom:12}}>⚠ {err}</div>}
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{...btnS,flex:1}}>Cancelar</button>
        <button onClick={submit} disabled={loading||!primaryId||dupeIds.length===0} style={{...btnR,flex:2}}>{loading?"Fusionando...":`Fusionar ${dupeIds.length} en el principal`}</button>
      </div>
    </Modal>
  );
}
