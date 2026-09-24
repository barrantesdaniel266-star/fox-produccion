// Restricción de acceso por IP para toda la app.
//
// Desactivada por defecto: si la variable de entorno ALLOWED_IPS no está
// configurada en Vercel, este middleware deja pasar todo (para no bloquear
// a nadie por accidente antes de configurarla).
//
// Para activarla: Vercel → Project Settings → Environment Variables →
// agrega ALLOWED_IPS con las IPs públicas autorizadas separadas por coma
// (ej: "181.52.34.10,190.60.1.20"). Cada sede/oficina expone su propia IP
// pública — pídele a cada una que visite https://whatismyipaddress.com y
// te pase el número "IPv4". Un cambio de plan de internet o de router
// puede cambiar esa IP, así que si alguien queda bloqueado sin razón,
// revisa primero si su IP pública cambió.
//
// Los cron jobs de /api quedan siempre exentos (Vercel los invoca desde su
// propia infraestructura, no desde una IP de oficina).

import { ipAddress, next } from "@vercel/functions";

export const config = {
  matcher: ["/((?!api|_vercel|favicon.ico).*)"],
};

function normalizeIp(ip) {
  if (!ip) return ip;
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

export default function middleware(request) {
  const raw = (process.env.ALLOWED_IPS || "").trim();
  if (!raw) return next(); // sin configurar todavía -> no bloquea a nadie

  const allowlist = raw.split(",").map(s => s.trim()).filter(Boolean);
  const ip = normalizeIp(ipAddress(request));

  if (ip && allowlist.includes(ip)) return next();

  return new Response(
    "Acceso restringido: esta red no está autorizada para usar el sistema. Si crees que es un error, contacta al administrador.",
    { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } }
  );
}
