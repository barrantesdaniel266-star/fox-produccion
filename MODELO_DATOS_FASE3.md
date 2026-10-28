# Modelo de datos — web, chat y agente (Fase 3, solo modelo)

Reglas en `firestore.rules.fase2-sso` (aún sin desplegar).

## `productos` (lectura pública, para mallasfox.com)
Doc por producto: `{nombre, categoria, medidas, unidad, precio, activo, actualizado}`.
Nada de costo, stock ni precioMin: las reglas rechazan cualquier otro campo. Es una copia
publicada desde `inventario` (por gerencia o función); `inventario` sigue privado.
⚠ Firestore no oculta campos dentro de un doc: hoy `inventario` mezcla `precioMin`/costo con
datos generales, así que "solo gerencia lee precioMin" requiere separar esos campos a una
colección aparte (cambio en la app, pendiente de tu aprobación).

## `conversaciones/{id}`
`{clienteNombre, clienteContacto, vendedoraAsignada(email), estado:"abierta"|"en_espera"|"cerrada", ultimoMensaje, ts}`

## `mensajes/{id}`
`{convId, de:"cliente"|"vendedora"|"agente", texto, ts}`. Inmutables (sin update/delete).
Consulta: `where("convId","==",id).orderBy("ts")`.

## `presencia/{correo}`
`{nombre, sede, enLinea:boolean, ts}` — cada usuario escribe solo la suya.

## Agente IA futuro
Lee `mensajes` de una conversación + `clientes` + `inventario` (con credenciales de servidor, p. ej. Admin SDK
en una función de Vercel) y escribe respuesta como `de:"agente"`. Acceso del cliente web al chat (sesión
anónima + reglas por `convId`) se define al construir la UI.
