# Graph Report - fox-produccion  (2026-10-27)

## Corpus Check
- 16 files · ~26,015 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .rules 1)

## Summary
- 290 nodes · 511 edges · 22 communities (18 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `409da1ab`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- assets/App.jsx
- src/App.jsx
- package.json
- normalizeItems
- render(orders) function
- esStockCliente
- cop
- computeInventario
- EditOrderModal
- getMachineItems
- import-productos.mjs
- vercel.json
- Fox Brand Motif
- tick() — clock updater
- Mallas y Alambres Fox — Sistema de Gestión de Producción
- Fox Producción — Instrucciones para Claude
- Fox TV — Planta Santa Lucía Dashboard Page
- actualizar-catalogo.mjs
- Guía: dominio propio, login con Google (SSO) y restricción por IP
- fmtDate
- App

## God Nodes (most connected - your core abstractions)
1. `normalizeItems()` - 18 edges
2. `labelProducto()` - 13 edges
3. `NuevaVentaModal()` - 13 edges
4. `cop()` - 12 edges
5. `normalizeItems()` - 12 edges
6. `computeInventario()` - 11 edges
7. `fmtDate()` - 10 edges
8. `labelProducto()` - 10 edges
9. `esStockCliente()` - 9 edges
10. `DetailModal()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `6. Hallazgos que encontré pero no toqué (para que decidas)` --references--> `clienteMatchIds()`  [INFERRED]
  GUIA_DOMINIO_SSO_SEGURIDAD.md → src/App.jsx
- `6. Hallazgos que encontré pero no toqué (para que decidas)` --references--> `ClientesTab()`  [INFERRED]
  GUIA_DOMINIO_SSO_SEGURIDAD.md → src/App.jsx
- `index.html App Shell (mounts /src/main.jsx)` --semantically_similar_to--> `Fox TV — Planta Santa Lucía Dashboard Page`  [INFERRED] [semantically similar]
  index.html → public/fox-tv.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Real-time Machine Status Render Pipeline** — public_fox_tv_onsnapshot_listener, public_fox_tv_render, public_fox_tv_norm, public_fox_tv_derst, public_fox_tv_machines [INFERRED 0.85]

## Communities (22 total, 4 thin omitted)

### Community 0 - "assets/App.jsx"
Cohesion: 0.10
Nodes (37): ref_assets_logo_png, ref_firebase_js, ABERTURA_SIZES, AssignOrderModal(), btnG, btnR, btnS, calcM2() (+29 more)

### Community 1 - "src/App.jsx"
Cohesion: 0.05
Nodes (28): ABERTURA_SIZES, btnG, btnR, btnS, CAT_UNIDAD, EMAIL_USERS, EMPRESA, ENTREGA_ESTADOS (+20 more)

### Community 2 - "package.json"
Cohesion: 0.07
Nodes (26): config, middleware(), normalizeIp(), dependencies, firebase, react, react-dom, @vercel/functions (+18 more)

### Community 3 - "normalizeItems"
Cohesion: 0.31
Nodes (14): AssignOrderModal(), CompleteItemModal(), infoProducto(), ItemCard(), labelProducto(), MachCard(), normalizeItems(), NuevaVentaModal() (+6 more)

### Community 4 - "render(orders) function"
Cohesion: 0.22
Nodes (10): ago(ts) — relative time formatter, cls(id) — product class lookup helper, derSt(items) — derive order status, lp(id) — product label lookup helper, MACHINES config array (SL1-SL5), norm(o) — normalize order/items status, onSnapshot Firestore Listener on 'orders' collection, params(it) — format item production parameters (+2 more)

### Community 5 - "esStockCliente"
Cohesion: 0.42
Nodes (9): 6. Hallazgos que encontré pero no toqué (para que decidas), ClienteDetalleModal(), clienteId(), clienteMatchIds(), ClientesTab(), esStockCliente(), findClienteByNombre(), makeLog() (+1 more)

### Community 6 - "cop"
Cohesion: 0.26
Nodes (15): buildDocHtml(), buildTirillaHtml(), compartirWhatsApp(), cop(), docFecha(), esc(), imprimirDocumento(), mailtoDoc() (+7 more)

### Community 7 - "computeInventario"
Cohesion: 0.32
Nodes (8): computeInventario(), fracN(), InventarioTab(), invLabel(), normDisp(), normKey(), numN(), ProductoModal()

### Community 8 - "EditOrderModal"
Cohesion: 0.32
Nodes (8): calcM2(), EditOrderModal(), enrichItem(), ItemFields(), newEmptyItem(), NewOrderModal(), PriceFields(), validarItem()

### Community 9 - "getMachineItems"
Cohesion: 0.67
Nodes (3): getMachineItem(), getMachineItems(), MachinesTab()

### Community 10 - "import-productos.mjs"
Cohesion: 0.13
Nodes (22): app, CATALOGO_PREVIO, catalogoMap, categCounts, contarNombres(), conteoCable, conteoGeneral, db (+14 more)

### Community 15 - "Mallas y Alambres Fox — Sistema de Gestión de Producción"
Cohesion: 0.22
Nodes (8): Activar Firestore Database, Mallas y Alambres Fox — Sistema de Gestión de Producción, PASO 1 — Crear proyecto Firebase (5 min), PASO 2 — Subir el código a GitHub (5 min), PASO 3 — Crear el archivo .env, PASO 4 — Publicar en Vercel (5 min), RESULTADO, USUARIOS

### Community 16 - "Fox Producción — Instrucciones para Claude"
Cohesion: 0.29
Nodes (6): Cómo trabajar (ahorro de tokens), Estado actual y pendientes, Flujo para cada cambio, Fox Producción — Instrucciones para Claude, Proyecto, Regla crítica

### Community 17 - "Fox TV — Planta Santa Lucía Dashboard Page"
Cohesion: 0.50
Nodes (4): index.html App Shell (mounts /src/main.jsx), Fox TV — Planta Santa Lucía Dashboard Page, Hardcoded Firebase Config Object, Standalone Static TV/Kiosk Display Pattern

### Community 18 - "actualizar-catalogo.mjs"
Cohesion: 0.08
Nodes (23): firebase, cambios, crear, db, ESL, EXECUTE, faltantes, norm() (+15 more)

### Community 19 - "Guía: dominio propio, login con Google (SSO) y restricción por IP"
Cohesion: 0.18
Nodes (10): 1. Qué hice esta sesión (resumen), 2. Dominio propio, 3. Activar el login con Google (SSO), 4. Restricción de acceso solo por IP, 5. Paso futuro (NO hacer todavía): reglas de Firestore más estrictas, 7. Cómo revisar y publicar cuando despiertes, Guía: dominio propio, login con Google (SSO) y restricción por IP, Para activarla (+2 more)

### Community 20 - "fmtDate"
Cohesion: 0.25
Nodes (11): DetailModal(), entregaInfo(), exportExcel(), fmtDate(), fmtMoney(), HistoryTab(), KardexModal(), MovimientosTab() (+3 more)

### Community 21 - "App"
Cohesion: 0.50
Nodes (4): App(), calcImpuestos(), deriveOrderStatus(), normalizarDoc()

## Knowledge Gaps
- **107 isolated node(s):** `config`, `name`, `private`, `version`, `type` (+102 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 138 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `firebase` connect `actualizar-catalogo.mjs` to `assets/App.jsx`, `src/App.jsx`, `package.json`, `import-productos.mjs`?**
  _High betweenness centrality (0.350) - this node is a cross-community bridge._
- **Why does `react` connect `package.json` to `assets/App.jsx`, `src/App.jsx`?**
  _High betweenness centrality (0.126) - this node is a cross-community bridge._
- **Why does `6. Hallazgos que encontré pero no toqué (para que decidas)` connect `esStockCliente` to `Guía: dominio propio, login con Google (SSO) y restricción por IP`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **What connects `config`, `name`, `private` to the rest of the system?**
  _107 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `assets/App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09595959595959595 - nodes in this community are weakly interconnected._
- **Should `src/App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.0735632183908046 - nodes in this community are weakly interconnected._