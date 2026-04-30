import React, { useState, useEffect, useCallback, useRef } from "react";
import { db } from "./firebase.js";
import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy,
} from "firebase/firestore";
import logoUrl from "./assets/logo.png";

const RED="#E8262A", DARK="#1a1a1a", GREEN="#16a34a";

// ═══ USUARIOS ══════════════════════════════════════════════
const USERS = {
  "mireya.centro":   { password:"Foxcentrom2026", name:"Mireya",         role:"vendedora", sede:"Centro"      },
  "jhoana.centro":   { password:"Foxcentroj2026", name:"Jhoana",         role:"vendedora", sede:"Centro"      },
  "tatiana.santal":  { password:"Foxsantat2026",  name:"Tatiana",        role:"vendedora", sede:"Santa Lucia" },
  "carolina.santal": { password:"Foxsantac2026",  name:"Carolina",       role:"vendedora", sede:"Santa Lucia" },
  "rafael":          { password:"Fox2026*",        name:"Rafael",         role:"gerencia",  sede:"Ambas Sedes" },
  "natalia":         { password:"Fox2026*",        name:"Natalia",        role:"gerencia",  sede:"Ambas Sedes" },
  "jefe.planta":     { password:"Fox2026*",        name:"Jefe de Planta", role:"gerencia",  sede:"Ambas Sedes" },
  "tv.planta":       { password:"FoxTV2026",        name:"Pantalla Planta", role:"viewer",   sede:"Ambas Sedes" },
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

const exportExcel = rows => {
  const stat={queue:"En Cola",active:"En Produccion",completed:"Completada"};
  // Usar tabulacion como separador - Excel lo reconoce universalmente sin importar configuracion regional
  const TAB="\t";
  // Limpiar el valor: quitar tabs y saltos de linea que rompen el formato
  const clean=v=>String(v==null?"":v).replace(/\t/g," ").replace(/\r?\n/g," ").trim();

  const headers=[
    "No.Orden","Cliente","Sede","Creado por","Estado Orden",
    "Fecha Creacion","Fecha Completado",
    "Producto","Estado Producto","Maquina",
    "M2","Ancho(m)","Alto(m)","Abertura",
    "Calibre","Cal.Interno","Color","Grosor","Largo(m)","Cantidad"
  ];

  const data=[];
  rows.forEach(o=>{
    const items=normalizeItems(o);
    const est=stat[o.status]||o.status||"";
    const fc=fmtDate(o.timestamp)||"";
    const fcomp=o.completedAt?fmtDate(o.completedAt):fmtDate(normalizeItems(o).map(it=>it.completedAt).filter(Boolean).sort((a,b)=>b-a)[0])||"";
    if(items.length===0){
      data.push([o.orden,o.cliente,o.sede,o.vendedoraName,est,fc,fcomp,"","","","","","","","","","","","",""]);
    } else {
      // Repetir datos de la orden en CADA producto — sin gaps
      items.forEach(it=>{
        data.push([
          o.orden, o.cliente||"", o.sede||"", o.vendedoraName||"", est, fc, fcomp,
          labelProducto(it.producto)||"", stat[it.status]||it.status||"", it.machineLabel||"",
          it.metros||"", it.ancho||"", it.alto||"", it.abertura||"",
          it.calibre||"", it.calibreInterno||"", it.color||"",
          it.grosor||"", it.largo||"", it.cantidad||"",
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
  return <Shell user={user} onLogout={logout} orders={orders}/>;
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
function Shell({user,onLogout,orders}){
  const [tab,setTab]=useState("machines");
  const [modal,setModal]=useState(null);
  const [saving,setSaving]=useState(false);
  const isG=user.role==="gerencia";
  const isViewer=user.role==="viewer";

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
  // Número de items activos en total
  const activeItemCount=orders.reduce((acc,o)=>acc+normalizeItems(o).filter(it=>it.status==="active").length,0);

  const withSave=async fn=>{setSaving(true);try{await fn();}catch(e){alert("Error al guardar: "+e.message);}finally{setSaving(false);}};

  const createOrder=async d=>{
    if(orders.find(o=>o.orden===d.orden)) return "Ya existe una orden con este número";
    await withSave(()=>setDoc(doc(db,"orders",d.orden),{
      ...d,vendedora:user.username,vendedoraName:user.name,
      status:"queue",timestamp:Date.now(),completedAt:null,
    }));
    return null;
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
  const editOrder=async(orden,changes)=>{ await withSave(()=>updateDoc(doc(db,"orders",orden),changes)); };

  const tabs=[
    {id:"machines",label:"Máquinas",       count:activeItemCount},
    {id:"queue",   label:"Cola de Órdenes",count:queueOrders.length},
    {id:"history", label:"Historial",      count:doneOrders.length},
  ];

  return(
    <div style={{minHeight:"100vh",background:"#f1f5f9",fontFamily:"Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",WebkitFontSmoothing:"antialiased"}}>
      <div style={{background:DARK}}>
        <div style={{maxWidth:1280,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src={logoUrl} style={{width:38,height:38,borderRadius:9,flexShrink:0}} alt="Fox"/>
            <div>
              <div style={{fontSize:14,fontWeight:800,color:"#fff",lineHeight:1.2}}>Mallas y Alambres Fox</div>
              <div style={{fontSize:14,color:"#f87171"}}>Gestión de Producción · Bogotá</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {saving&&<span style={{color:RED,fontSize:14}}>● Guardando...</span>}
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{user.name}</div>
              <div style={{fontSize:14,color:isG?"#fbbf24":"#93c5fd"}}>{isG?"Gerencia — Acceso total":`Vendedora · ${user.sede}`}</div>
            </div>
            <button onClick={onLogout} style={{background:RED,border:"none",color:"#fff",borderRadius:7,padding:"5px 12px",fontSize:14,fontWeight:700,cursor:"pointer"}}>Salir</button>
          </div>
        </div>
        <div style={{borderTop:"1px solid #262626",padding:"5px 0"}}>
          <div style={{maxWidth:1280,margin:"0 auto",padding:"0 16px",display:"flex",gap:18,fontSize:14,flexWrap:"wrap"}}>
            <span style={{color:"#4ade80"}}>● {MACHINES.filter(m=>!getMachineItem(m.id,orders)).length} libres</span>
            <span style={{color:"#f87171"}}>● {activeItemCount} items en producción</span>
            <span style={{color:"#60a5fa"}}>● {queueOrders.length} órdenes en cola</span>
            <span style={{color:"#9ca3af"}}>● {doneOrders.length} completadas</span>
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
        {tab==="machines"&&<MachinesTab machines={MACHINES} orders={orders} user={user} isG={isG}
          onItemClick={(ord,it,idx)=>!isViewer&&setModal({t:"complete",order:ord,item:it,itemIndex:idx})}
          onCompleteItem={(orden,idx)=>!isViewer&&completeItem(orden,idx)}
          onAssignFree={mid=>!isViewer&&setModal({t:"pickItem",machineId:mid})}
          onNew={()=>!isViewer&&setModal({t:"new"})}/>}
        {tab==="queue"&&<QueueTab orders={queueOrders} allOrders={orders} isG={isG&&!isViewer}
          onNew={()=>!isViewer&&setModal({t:"new"})}
          onAssignOrder={o=>!isViewer&&setModal({t:"assignOrder",order:o})}
          onDel={isG&&!isViewer?(r=>{if(window.confirm(`¿Confirmas eliminar la orden #${r}?`))removeOrder(r);}):null}
          onDetail={o=>setModal({t:"detail",order:o})}
          onEdit={o=>!isViewer&&setModal({t:"edit",order:o})}/>}
        {tab==="history"&&<HistoryTab orders={doneOrders} allOrders={orders} isG={isG&&!isViewer}
          onDel={isG&&!isViewer?(r=>{if(window.confirm(`¿Confirmas eliminar el registro #${r}?`))removeOrder(r);}):null}
          onDetail={o=>setModal({t:"detail",order:o})}/>}
      </div>

      {modal?.t==="new"         &&<NewOrderModal    user={user} orders={orders} onClose={()=>setModal(null)} onCreate={createOrder}/>}
      {modal?.t==="edit"        &&<EditOrderModal   order={modal.order} onClose={()=>setModal(null)} onSave={editOrder}/>}
      {modal?.t==="assignOrder" &&<AssignOrderModal order={modal.order} allOrders={orders} machines={MACHINES} user={user} isG={isG} onClose={()=>setModal(null)} onAssign={assignItem} onAssignMultiple={assignMultipleItems}/>}
      {modal?.t==="pickItem"    &&<PickItemModal    machineId={modal.machineId} orders={queueOrders} allOrders={orders} user={user} isG={isG} machines={MACHINES} onClose={()=>setModal(null)} onAssign={assignItem}/>}
      {modal?.t==="complete"    &&<CompleteItemModal order={modal.order} item={modal.item} itemIndex={modal.itemIndex} onClose={()=>setModal(null)} onComplete={completeItem} onReturn={returnItemToQueue}/>}
      {modal?.t==="detail"      &&<DetailModal      order={modal.order} onClose={()=>setModal(null)}/>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}*{box-sizing:border-box}`}</style>
    </div>
  );
}

// ═══ BADGES ════════════════════════════════════════════════
function ItemStatusBadge({item}){
  if(item.status==="completed") return <span style={{background:"#f0fdf4",color:"#15803d",borderRadius:999,padding:"1px 8px",fontSize:14,fontWeight:700}}>✓ Completado</span>;
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
function MachinesTab({machines,orders,user,isG,onItemClick,onCompleteItem,onAssignFree,onNew}){
  const canRename=user.username==="natalia";
  const [names,setNames]=useState(()=>Object.fromEntries(machines.map(m=>[m.id,m.name])));
  const [editing,setEditing]=useState(null);

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"9px 14px",fontSize:14,color:"#991b1b",flex:1}}>
          Cada máquina puede tener <strong>múltiples productos activos</strong>. Clic en máquina <strong>ROJA</strong> para finalizar productos. Clic en <strong>VERDE</strong> para asignar.
          {!isG&&<span style={{display:"block",marginTop:4}}>Solo puedes asignar a las máquinas de tu sede.</span>}
        </div>
        <button onClick={onNew} style={btnR}>+ Nueva Orden</button>
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
              const puedeAsignar=isG||(user.sede===sede);
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
                      ✓ Completar {checkedCount>0?`(${checkedCount})`:""}
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
              <div style={{fontSize:14,color:"#94a3b8",background:"#f8fafc",borderRadius:8,padding:"8px"}}>Solo tu sede puede asignar a esta máquina</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ COLA DE ÓRDENES ═══════════════════════════════════════
function QueueTab({orders,allOrders,isG,onNew,onAssignOrder,onDel,onDetail,onEdit}){
  const [q,setQ]=useState("");
  const fil=orders.filter(o=>String(o.orden).toLowerCase().includes(q.toLowerCase())||o.cliente.toLowerCase().includes(q.toLowerCase()));
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <input style={{...inp,flex:1,minWidth:200}} placeholder="Buscar por No. Orden o cliente..." value={q} onChange={e=>setQ(e.target.value)}/>
        <button onClick={onNew} style={btnR}>+ Nueva Orden</button>
      </div>
      {fil.length===0?(
        <div style={{textAlign:"center",padding:"64px 0",color:"#94a3b8"}}>
          <div style={{fontSize:36,marginBottom:12,color:"#e2e8f0"}}>[ ]</div>
          <div style={{fontWeight:600,marginBottom:6}}>{q?"Sin resultados":"Cola vacía"}</div>
          {!q&&<button onClick={onNew} style={{background:"none",border:"none",color:RED,fontSize:14,cursor:"pointer",textDecoration:"underline"}}>+ Crear primera orden</button>}
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
                    </div>
                    <div style={{fontWeight:600,color:"#475569",fontSize:14,marginBottom:6}}>{o.cliente}</div>
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
                    {enCola>0&&<button onClick={()=>onAssignOrder(o)} style={{...btnR,padding:"7px 14px",fontSize:14,whiteSpace:"nowrap"}}>Asignar productos</button>}
                    <button onClick={()=>onDetail(o)} style={{...btnS,padding:"7px 10px",fontSize:14}}>Ver detalle</button>
                    <button onClick={()=>onEdit(o)} style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:10,padding:"7px 10px",cursor:"pointer",color:"#0369a1",fontSize:14,fontWeight:600}}>Editar</button>
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
function HistoryTab({orders,allOrders,isG,onDel,onDetail}){
  const [q,setQ]=useState("");const [view,setView]=useState("completed");
  const pool=view==="all"?allOrders:orders;
  const fil=pool.filter(o=>String(o.orden).toLowerCase().includes(q.toLowerCase())||o.cliente.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>(b.completedAt||b.timestamp)-(a.completedAt||a.timestamp));
  const ss={queue:{bg:"#eff6ff",col:"#1d4ed8",txt:"En Cola"},active:{bg:"#fef2f2",col:"#991b1b",txt:"En Producción"},completed:{bg:"#f0fdf4",col:"#15803d",txt:"Completada"}};
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <select value={view} onChange={e=>setView(e.target.value)} style={{...inp,flex:"0 0 auto",width:"auto"}}>
          <option value="completed">Solo completadas</option>
          <option value="all">Todas las órdenes</option>
        </select>
        <input style={{...inp,flex:1,minWidth:200}} placeholder="Buscar por No. Orden o cliente..." value={q} onChange={e=>setQ(e.target.value)}/>
        <button onClick={()=>exportExcel(fil)} style={btnG}>Exportar Excel</button>
      </div>
      <div style={{fontSize:14,color:"#94a3b8",marginBottom:10}}>{fil.length} registro(s)</div>
      <div style={{background:"#fff",borderRadius:14,border:"1px solid #e2e8f0",overflow:"hidden"}}>
        {fil.length===0?(
          <div style={{textAlign:"center",padding:"60px 0",color:"#94a3b8"}}><div style={{fontSize:36,marginBottom:10,color:"#e2e8f0"}}>[ ]</div><div>Sin registros</div></div>
        ):(
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
              <thead>
                <tr style={{background:"#f8fafc",borderBottom:"1px solid #e2e8f0"}}>
                  {["No.Orden","Cliente","Productos","Sede","Creado por","Estado","Creado","Completado","Acciones"].map(h=>(
                    <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:14,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:.4,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fil.map((o,i)=>{
                  const s=ss[deriveOrderStatus(normalizeItems(o))]||{bg:"#f1f5f9",col:"#64748b",txt:""};
                  const items=normalizeItems(o);
                  return(
                    <tr key={o.orden} style={{borderBottom:"1px solid #f1f5f9",background:i%2===0?"#fff":"#fafafa"}}>
                      <td style={{padding:"10px 14px",fontWeight:800,color:"#1e293b"}}>#{o.orden}</td>
                      <td style={{padding:"10px 14px",color:"#334155",maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.cliente}</td>
                      <td style={{padding:"10px 14px",minWidth:160}}><ProductoBadges items={items}/></td>
                      <td style={{padding:"10px 14px",color:"#475569"}}>{o.sede}</td>
                      <td style={{padding:"10px 14px",color:"#475569",whiteSpace:"nowrap"}}>{o.vendedoraName}</td>
                      <td style={{padding:"10px 14px"}}><span style={{background:s.bg,color:s.col,borderRadius:999,padding:"2px 9px",fontSize:14,fontWeight:700,whiteSpace:"nowrap"}}>{s.txt}</span></td>
                      <td style={{padding:"10px 14px",color:"#94a3b8",whiteSpace:"nowrap"}}>{fmtDate(o.timestamp)}</td>
                      <td style={{padding:"10px 14px",color:"#94a3b8",whiteSpace:"nowrap"}}>{o.completedAt?fmtDate(o.completedAt):fmtDate(normalizeItems(o).map(it=>it.completedAt).filter(Boolean).sort((a,b)=>b-a)[0])||"—"}</td>
                      <td style={{padding:"10px 14px"}}>
                        <div style={{display:"flex",gap:4}}>
                          <button onClick={()=>onDetail(o)} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:7,padding:"4px 8px",cursor:"pointer",color:"#64748b",fontSize:14}}>Ver</button>
                          {isG&&onDel&&<button onClick={()=>onDel(o.orden)} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:7,padding:"4px 8px",cursor:"pointer",color:"#dc2626",fontSize:14}}>Eliminar</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
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

function ItemCard({item,index,onUpdate,onRemove,canRemove}){
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
  if(rest.producto==="eslabonada"||rest.producto==="pvc") return {...rest,metros:calcM2(rest.ancho,rest.alto),status:"queue",machineId:null,machineLabel:null,assignedAt:null,completedAt:null};
  return {...rest,status:"queue",machineId:null,machineLabel:null,assignedAt:null,completedAt:null};
}
const newEmptyItem=()=>({_key:Date.now()+Math.random(),producto:"",calibre:"",calibreInterno:"",color:"",ancho:"",alto:"",abertura:"",grosor:"",largo:"",cantidad:""});

// ═══ NUEVA ORDEN ═══════════════════════════════════════════
function NewOrderModal({user,orders,onClose,onCreate}){
  const isG=user.role==="gerencia";
  const [orden,setOrden]=useState("");const [cliente,setCliente]=useState("");
  const canSelectSede=isG||user.sede==="Santa Lucia";
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
    const r=await onCreate({orden:orden.trim(),cliente:cliente.trim(),sede:sedeTarget,items:cleanItems});
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
          <input style={inp} value={cliente} onChange={e=>setCliente(e.target.value)} placeholder="Nombre del cliente"/>
          <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
            <button type="button" onClick={selectStock} style={{background:cliente==="Inventario (Stock)"?"#7c3aed":"#f5f3ff",border:"1.5px solid #7c3aed",borderRadius:8,padding:"4px 10px",cursor:"pointer",color:cliente==="Inventario (Stock)"?"#fff":"#7c3aed",fontSize:14,fontWeight:700}}>📦 Inventario (Stock)</button>
          </div>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <label style={{fontSize:14,fontWeight:700,color:"#334155"}}>Productos ({items.length})</label>
        <button onClick={addItem} style={{background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:10,padding:"6px 14px",cursor:"pointer",color:GREEN,fontSize:14,fontWeight:700}}>+ Agregar producto</button>
      </div>
      {items.map((it,i)=><ItemCard key={it._key} item={it} index={i} onUpdate={v=>updateItem(i,v)} onRemove={()=>removeItem(i)} canRemove={items.length>1}/>)}
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

// ═══ EDITAR ORDEN ══════════════════════════════════════════
function EditOrderModal({order,onClose,onSave}){
  const [cliente,setCliente]=useState(order.cliente);
  const existing=normalizeItems(order).map(it=>({...it,_key:Date.now()+Math.random()}));
  const [items,setItems]=useState(existing.length>0?existing:[newEmptyItem()]);
  const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  const updateItem=(i,v)=>setItems(prev=>prev.map((x,idx)=>idx===i?v:x));
  const addItem=()=>setItems(prev=>[...prev,newEmptyItem()]);
  const removeItem=i=>setItems(prev=>prev.filter((_,idx)=>idx!==i));
  const submit=async()=>{
    if(!cliente.trim()){setErr("Ingresa el nombre del cliente");return;}
    for(let it of items){const e=validarItem(it);if(e){setErr(e);return;}}
    const cleanItems=items.map(it=>enrichItem(it));
    setLoading(true);
    await onSave(order.orden,{cliente:cliente.trim(),items:cleanItems});
    setLoading(false);onClose();
  };
  return(
    <Modal title={`Editar Orden #${order.orden}`} onClose={onClose} maxWidth={580}>
      <div style={{marginBottom:14}}><label style={{fontSize:14,fontWeight:600,color:"#64748b",display:"block",marginBottom:5}}>Cliente</label><input style={inp} value={cliente} onChange={e=>setCliente(e.target.value)}/></div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <label style={{fontSize:14,fontWeight:700,color:"#334155"}}>Productos ({items.length})</label>
        <button onClick={addItem} style={{background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:10,padding:"6px 14px",cursor:"pointer",color:GREEN,fontSize:14,fontWeight:700}}>+ Agregar producto</button>
      </div>
      {items.map((it,i)=><ItemCard key={it._key||i} item={it} index={i} onUpdate={v=>updateItem(i,v)} onRemove={()=>removeItem(i)} canRemove={items.length>1}/>)}
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

  // Con multi-producto las maquinas pueden tener varios items activos
  // Solo excluir selecciones actuales del mismo modal (no duplicar en un solo envío)
  const selectedInModal=new Set(Object.values(sel).filter(Boolean));

  const availableMachines=(itemIdx)=>{
    const sedesPermitidas=(isG||user.sede==="Santa Lucia")?["Centro","Santa Lucia"]:[user.sede];
    return machines.filter(m=>
      sedesPermitidas.includes(m.sede) &&
      (!selectedInModal.has(m.id) || sel[itemIdx]===m.id)
    );
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
        <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"9px 14px",fontSize:14,color:"#92400e",marginBottom:14}}>
          Solo puedes asignar a máquinas de tu sede: <strong>{user.sede}</strong>
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
                    <div style={{fontSize:14,color:"#94a3b8",fontStyle:"italic"}}>No hay máquinas disponibles{!isG?" en tu sede":""}</div>
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
  if(!isG&&machine.sede!==user.sede){
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
          {allDoneAfter&&<div style={{marginTop:8,background:"#f0fdf4",border:"1px solid #86efac",borderRadius:8,padding:"6px 10px",fontSize:14,color:"#15803d",fontWeight:600}}>✓ Al completar este producto, la orden quedará 100% terminada</div>}
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
        <span style={{fontSize:14,fontWeight:600,color:"#334155"}}>Confirmar entrega</span>
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
        <button onClick={goComplete} disabled={loading} style={{...btnG,flex:2}}>{loading?"Procesando...":"Sí, producto completado ✓"}</button>
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
function DetailModal({order,onClose}){
  const ss={queue:{bg:"#eff6ff",col:"#1d4ed8",txt:"En Cola"},active:{bg:"#fef2f2",col:"#991b1b",txt:"En Producción"},completed:{bg:"#f0fdf4",col:"#15803d",txt:"Completada"}};
  const oStatus=deriveOrderStatus(normalizeItems(order));
  const s=ss[oStatus]||{bg:"#f1f5f9",col:"#64748b",txt:oStatus};
  const items=normalizeItems(order);
  const meta=[
    ["Cliente",order.cliente],["Sede",order.sede],
    ["Creado por",order.vendedoraName],["Fecha creación",fmtDate(order.timestamp)],
    ...(order.completedAt?[["Completada el",fmtDate(order.completedAt)]]:[]),
  ];
  return(
    <Modal title="Detalle de la Orden" onClose={onClose}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <span style={{fontSize:26,fontWeight:900,color:"#1e293b"}}>#{order.orden}</span>
        <span style={{background:s.bg,color:s.col,borderRadius:999,padding:"4px 14px",fontSize:14,fontWeight:700}}>{s.txt}</span>
      </div>
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
      <button onClick={onClose} style={{width:"100%",background:DARK,border:"none",borderRadius:10,padding:"11px",fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer"}}>Cerrar</button>
    </Modal>
  );
}
