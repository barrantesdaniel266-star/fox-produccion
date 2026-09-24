# Guía: dominio propio, login con Google (SSO) y restricción por IP

Todo lo de este documento quedó en la rama `feature/sso-ip-dominio-mejoras`,
**commiteado localmente, sin subir a GitHub ni a Vercel**. Nada de esto está
en producción todavía. Revisa, prueba, y cuando estés de acuerdo lo subimos.

Para ver exactamente qué cambió:
```
git log main..feature/sso-ip-dominio-mejoras --oneline
git diff main..feature/sso-ip-dominio-mejoras
```

---

## 1. Qué hice esta sesión (resumen)

- **Login con Google agregado** (no reemplaza el login actual con
  usuario/contraseña — conviven los dos). Ver sección 3.
- **2 bugs corregidos:**
  - `moverInventario` leía el stock desde el estado local de React antes de
    escribir; si dos personas movían el mismo producto casi al mismo tiempo
    (dos sedes despachando a la vez, por ejemplo), un movimiento podía
    "pisar" al otro y perderse. Ahora usa una transacción de Firestore
    (lee y escribe de forma atómica).
  - El campo "Abono" de una remisión no tenía límite inferior: si alguien
    metía un número negativo, el saldo quedaba **más alto** que el total en
    vez de rechazarse. Ya no se puede meter un abono negativo.
- **Middleware de restricción por IP creado, pero apagado** (no bloquea a
  nadie hasta que configures la variable de entorno). Ver sección 4.
- **Hallazgos sin tocar** (para que decidas qué hacer): ver sección 6.

---

## 2. Dominio propio

Ahora mismo la app vive en `fox-produccion.vercel.app`. Para tener algo como
`sistema.mallasyalambresfox.com`:

1. **Compra el dominio** en cualquier registrador (Namecheap, GoDaddy, o
   directamente en Vercel: Vercel Dashboard → Domains → Buy). Si ya tienen
   un dominio para la empresa (ej. el del correo), pueden usar un
   subdominio de ese (`sistema.mallasyalambresfox.com`) sin comprar nada
   nuevo.
2. **En Vercel**: abre el proyecto `fox-produccion` → Settings → Domains →
   "Add" → escribe el dominio.
3. Vercel te da 1–2 registros DNS para agregar donde compraste el dominio
   (normalmente un `CNAME` apuntando a `cname.vercel-dns.com`, o dos
   registros `A` si es el dominio raíz sin `www`). Los agregas en el panel
   DNS del registrador (cada uno tiene su propia pantalla para esto, busca
   "DNS" o "Nameservers").
4. Espera la propagación (minutos a un par de horas). Vercel emite el
   certificado HTTPS automáticamente en cuanto detecta el DNS correcto.
5. **Importante para el login con Google** (sección 3): cuando tengas el
   dominio final, agrégalo también en Firebase Console → Authentication →
   Settings → **Authorized domains**. Si no, Google rechazará el login
   desde ese dominio aunque el DNS esté bien.

No compré nada por ti — no tengo forma de pagar ni acceso a tus cuentas de
registrador/Vercel. Esto es la guía para que lo hagas tú en 15-20 minutos.

---

## 3. Activar el login con Google (SSO)

### Qué es y qué no es
Es "iniciar sesión con tu cuenta de Google" en vez de un usuario/contraseña
propio del sistema. Más simple y más seguro (nadie comparte contraseñas de
la app, y puedes revocar acceso quitando el correo de la lista sin cambiar
contraseñas). No es Google Workspace/SSO empresarial completo — para eso
necesitarían un dominio de correo propio gestionado por Google Workspace;
lo de abajo funciona igual de bien con cuentas @gmail.com normales.

### Pasos

1. **Firebase Console** → tu proyecto `fox-produccion` → Authentication →
   Sign-in method → habilita el proveedor **Google** (botón "Enable",
   elige un correo de soporte, guarda).
2. **Authorized domains** (misma pantalla de Authentication → Settings):
   confirma que estén `fox-produccion.vercel.app` y, cuando lo tengas, tu
   dominio propio. `localhost` ya viene por defecto (sirve para probar en
   tu máquina).
3. **Edita el archivo `src/App.jsx`**, busca `EMAIL_USERS` (cerca de la
   línea 26) y completa con los correos de Google reales de cada persona:

   ```js
   const EMAIL_USERS = {
     "mireya@gmail.com":   { name:"Mireya",   role:"vendedora", sede:"Centro" },
     "jhoana@gmail.com":   { name:"Jhoana",   role:"vendedora", sede:"Centro" },
     // ...una línea por persona, con el correo real
   };
   ```
   Solo los correos que estén en esta lista pueden entrar por Google. Si
   alguien no está, el botón le dice "correo no autorizado" y no entra —
   es la única forma de darle a alguien acceso: agregarlo aquí.
4. Prueba localmente (`npm run dev`) antes de subir: entra con un correo de
   la lista y confirma que carga con el rol/sede correctos.
5. Cuando confíes en que funciona para todos, puedes (opcional, no lo
   hice yo) quitar el formulario de usuario/contraseña viejo y dejar solo
   Google — o dejarlos convivir indefinidamente, como está ahora.

---

## 4. Restricción de acceso solo por IP

Ya creé `middleware.js` en la raíz del proyecto. Corre en Vercel antes de
servir la app y bloquea cualquier IP que no esté en la lista — **pero está
apagado hasta que configures la variable de entorno**, para no arriesgarme
a dejarlos a todos bloqueados sin querer mientras dormías.

### Para activarla

1. Pide la **IP pública** de cada sede/oficina: que alguien en cada lugar
   entre a https://whatismyipaddress.com y te pase el número "IPv4".
   (Ojo: esto bloquea por red, no por persona — alguien trabajando desde
   el celular con datos móviles, o desde la casa, quedará bloqueado a
   menos que agregues también esa IP. Piensa si de verdad quieres esto o
   si el login con Google ya te da suficiente control de acceso.)
2. Vercel Dashboard → proyecto → Settings → Environment Variables → agrega:
   - Name: `ALLOWED_IPS`
   - Value: las IPs separadas por coma, ej: `181.52.34.10,190.60.1.20`
   - Environment: Production (y Preview si quieres probarlo antes)
3. Vuelve a desplegar (cualquier push a `main` ya la toma; o "Redeploy"
   manual desde el dashboard).
4. Prueba entrando desde una red NO autorizada (datos móviles, por
   ejemplo) — debe salir el mensaje de acceso restringido.

Para desactivarla de nuevo: borra la variable `ALLOWED_IPS` en Vercel (o
déjala vacía) y vuelve a desplegar.

---

## 5. Paso futuro (NO hacer todavía): reglas de Firestore más estrictas

Ahora mismo `firestore.rules` es `allow read, write: if true` para
**todo** — cualquiera con el link de la app (o solo la URL de Firestore)
puede leer y escribir cualquier dato, tenga sesión o no. Los permisos por
rol (`gerencia`, `vendedora`, etc.) que ves en la app son solo de interfaz:
no impiden que alguien llame a Firestore directamente sin pasar por la
app.

**No cambié esto todavía a propósito.** Si se endurecen las reglas
(exigir `request.auth != null`, por ejemplo) ANTES de que todo el equipo
tenga login con Google funcionando, cualquiera que siga entrando con el
usuario/contraseña viejo (que no pasa por Firebase Auth) se quedaría sin
poder leer ni escribir nada — pantalla en blanco o errores por todos
lados.

Cuando **todo el equipo ya esté usando el botón de Google** (no antes),
avísame y preparo las reglas estrictas + la migración del login viejo. Es
un cambio de una tarde, pero el orden importa.

---

## 6. Hallazgos que encontré pero no toqué (para que decidas)

Un análisis de fondo del código encontró estos dos, de menor prioridad —
no los cambié porque necesitan una decisión tuya sobre el comportamiento,
no son bugs obvios de "una sola forma correcta de arreglar":

- **Fusión de clientes**: cuando fusionas dos clientes duplicados, las
  órdenes/remisiones viejas guardan el nombre del cliente tal como estaba
  en ese momento (no una referencia en vivo). Si la pantalla de detalle de
  un cliente no cruza también por los alias fusionados, el historial viejo
  podría no aparecer ahí. Vale la pena que lo pruebes: fusiona dos
  clientes de prueba y mira si el historial completo aparece en el
  cliente resultante.
- **Sincronización de clientes por nombre**: crea el ID del cliente a
  partir del texto del nombre. Dos clientes distintos con nombres muy
  parecidos (genéricos, tipo "Cliente Ferretería") podrían mezclarse en un
  solo registro. Bajo riesgo salvo que lo veas pasar en la práctica.

---

## 7. Cómo revisar y publicar cuando despiertes

```bash
git log main..feature/sso-ip-dominio-mejoras --oneline   # ver los commits
git diff main..feature/sso-ip-dominio-mejoras             # ver todo el diff
```

Si todo se ve bien:
```bash
git checkout main
git merge feature/sso-ip-dominio-mejoras
git push
```

Si quieres probar antes en un link de Vercel sin tocar producción, dime y
subo solo la rama (sin tocar `main`) para que Vercel genere el preview.

Nada de esto se subió a GitHub ni a Vercel — sigue 100% local hasta que tú
decidas.
