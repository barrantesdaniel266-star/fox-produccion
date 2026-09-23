# Fox Producción — Instrucciones para Claude

## Proyecto
- App de gestión de producción para Mallas y Alambres Fox (fabricante colombiano de mallas y alambres).
- Sedes: Centro, Santa Lucía y La Granja.
- Stack: React + Vite, Firestore, Vercel.
- Producción: https://fox-produccion.vercel.app (la usa el cliente; todo push a main se despliega ahí).
- Repo: barrantesdaniel266-star/fox-produccion
- Todo el contenido de la app, textos y mensajes de commit van en español.

## Regla crítica
- TODOS los componentes y hooks deben quedar dentro del scope de `App()`. Sacarlos causa una pantalla en blanco conocida. Nunca los muevas fuera de `App()` aunque parezca mejor práctica.

## Estado actual y pendientes
- Imágenes guardadas como base64 en Firestore (patrón heredado; no cambiar sin pedirlo).
- Reglas de Firestore abiertas (`allow read, write: if true`). Firebase Auth pendiente.
- Pendiente: sistema de inventario/POS con descuento de stock, etiquetado por sede y recibo imprimible.
- Si una tarea toca el POS, pagos o datos sensibles, avísame antes que las reglas de Firestore siguen abiertas.

## Cómo trabajar (ahorro de tokens)
- Antes de explorar el código, lee `graphify-out/GRAPH_REPORT.md` y usa `graphify query "..."` para ubicar funciones. No leas archivos completos si no hace falta; lee solo los fragmentos necesarios.
- Haz ediciones puntuales, nunca reescribas archivos enteros.
- Respuestas cortas y en español. No me expliques todo el código, solo qué cambiaste y dónde.
- Si la tarea es ambigua, hazme una sola pregunta antes de empezar.

## Flujo para cada cambio
1. Haz el cambio.
2. Corre `npm run build` y confirma que compila sin errores. Si falla, arréglalo antes de seguir.
3. Muéstrame un resumen corto del diff y espera mi aprobación antes de hacer push.
4. Para cambios grandes o riesgosos, trabaja en una rama nueva (no en main) para que Vercel genere un enlace de prueba.
5. Al aprobar: commit con mensaje descriptivo en español y push.
6. Después de cambios importantes en el código, corre `graphify update .` para actualizar el grafo.
