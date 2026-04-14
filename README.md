# Mallas y Alambres Fox — Sistema de Gestión de Producción

App web en tiempo real para gestión de órdenes de producción.
Tecnología: React + Vite + Firebase Firestore + Vercel

---

## PASO 1 — Crear proyecto Firebase (5 min)

1. Ve a https://console.firebase.google.com
2. Clic en **Agregar proyecto** → nombre: `fox-produccion`
3. Desactiva Google Analytics → **Crear proyecto**
4. Clic en el ícono **</>** (Web) → nombre de app: `Fox Produccion` → **Registrar app**
5. **Copia los valores de firebaseConfig** que aparecen — los necesitarás en el Paso 3

### Activar Firestore Database
1. Menú izquierdo → **Firestore Database** → **Crear base de datos**
2. Selecciona **"Iniciar en modo de producción"** → Siguiente
3. Ubicación: `nam5 (us-central)` → **Listo**
4. Pestaña **Reglas** → reemplaza el contenido con:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /orders/{orderId} {
         allow read, write: if true;
       }
     }
   }
   ```
5. Clic en **Publicar**

---

## PASO 2 — Subir el código a GitHub (5 min)

1. Crea cuenta gratis en https://github.com
2. Clic en **New repository** → nombre: `fox-produccion` → **Create repository**
3. En la pantalla que aparece → clic en **"uploading an existing file"**
4. Arrastra TODA la carpeta `fox-produccion` descomprimida
5. Clic en **Commit changes**

---

## PASO 3 — Crear el archivo .env

Crea un archivo llamado `.env` en la raíz del proyecto con tus datos de Firebase:

```
VITE_FIREBASE_API_KEY=tu_valor_aqui
VITE_FIREBASE_AUTH_DOMAIN=fox-produccion.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=fox-produccion
VITE_FIREBASE_STORAGE_BUCKET=fox-produccion.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_valor_aqui
VITE_FIREBASE_APP_ID=tu_valor_aqui
```

El archivo `.env` NO se sube a GitHub (está en .gitignore).
En Vercel lo configuras como variables de entorno (ver Paso 4).

---

## PASO 4 — Publicar en Vercel (5 min)

1. Ve a https://vercel.com → **Sign up with GitHub**
2. Clic en **Add New Project** → importa `fox-produccion`
3. Sección **Environment Variables** → agrega las 6 variables:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
4. Clic en **Deploy** → en 2 minutos tienes la URL

---

## RESULTADO

✅ URL pública tipo `fox-produccion.vercel.app`
✅ Datos en tiempo real entre todas las sedes
✅ Sin costo mensual para el volumen de la empresa
✅ Sesión persistente en el navegador
✅ Funciona en celular como app instalable

---

## USUARIOS

| Usuario          | Contraseña      | Rol       | Sede        |
|------------------|-----------------|-----------|-------------|
| mireya.centro    | Foxcentrom2026  | Vendedora | Centro      |
| jhoana.centro    | Foxcentroj2026  | Vendedora | Centro      |
| tatiana.santal   | Foxsantat2026   | Vendedora | Santa Lucía |
| carolina.santal  | Foxsantac2026   | Vendedora | Santa Lucía |
| rafael           | Fox2026*        | Gerencia  | Ambas       |
| natalia          | Fox2026*        | Gerencia  | Ambas       |
| jefe.planta      | Fox2026*        | Gerencia  | Ambas       |
