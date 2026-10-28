# Alta, cambio y baja de usuarios

El sistema solo permite entrar con **Microsoft 365** (`@telefoxsas.com`). Para que alguien
entre se necesitan **dos cosas**; si falta una, ve "Tu cuenta no está autorizada".

1. Cuenta Microsoft 365 con licencia.
2. Documento en la colección `usuarios` de Firestore (ID = correo en minúsculas).

## Alta

1. **Microsoft 365** (admin.microsoft.com → Usuarios → Usuarios activos → Agregar usuario):
   - Correo `nombre@telefoxsas.com`, asignar licencia.
   - Contraseña temporal y marcar **"Requerir que cambie la contraseña al iniciar sesión"**.
2. **Rol y sede**: entrar al sistema como gerencia → pestaña **Usuarios** → agregar con
   correo, nombre, rol y sede. (Alternativa manual en Firestore: colección `usuarios`,
   ID = correo en minúsculas, campos `nombre`, `role`, `sede`.)
3. Enviar al usuario, **por mensaje directo** (no grupo): URL `sistema.telefoxsas.com`,
   su correo y la contraseña temporal. Debe pulsar "Iniciar sesión con Microsoft".

Valores válidos:

| Campo | Valores |
|---|---|
| `role` | `gerencia`, `vendedora`, `logistica`, `viewer` (solo lectura) |
| `sede` | `Centro`, `Santa Lucia`, `La Granja`, `Ambas Sedes` |

## Cambio de rol o sede

Pestaña **Usuarios** (o editar el documento en Firestore). Se aplica en el siguiente
inicio de sesión o recarga; no hay que tocar Microsoft 365.

## Baja (quien se va de la empresa)

Hacer **las dos**, en este orden:

1. **Microsoft 365**: bloquear inicio de sesión del usuario (o eliminarlo) y revocar sesiones.
2. **Sistema**: pestaña **Usuarios** → eliminar su documento (borra el acceso a Firestore
   de inmediato, aunque conserve una sesión abierta).

Con solo el paso 2 el usuario ya no puede leer ni escribir datos; con el paso 1 además
deja de poder iniciar sesión en cualquier otra aplicación de Microsoft 365.

## Contraseña olvidada

La gestiona Microsoft 365: el admin restablece la contraseña desde el centro de
administración (o el usuario usa "¿Olvidó su contraseña?" si está habilitado el
autoservicio). El sistema ya no guarda contraseñas.

## Si Microsoft no responde

No hay acceso alternativo por contraseña. Un administrador puede entrar a Firebase Console
para consultar o corregir datos mientras Microsoft 365 se restablece.
