// Utilidades del sitio público
export const money = n => "$" + Number(n).toLocaleString("es-CO");

// "321 424 0407 · 322 914 7720" -> ["573214240407","573229147720"]
export const telefonosWa = txt =>
  (String(txt || "").match(/(?:\+?57)?\s*3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/g) || [])
    .map(t => "57" + t.replace(/\D/g, "").replace(/^57/, ""));

export const waLink = (num, texto) =>
  `https://wa.me/${String(num || "").replace(/\D/g, "")}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;

export const mapaEmbed = (dir, ciudad = "Bogotá, Colombia") =>
  `https://www.google.com/maps?q=${encodeURIComponent(`${dir}, ${ciudad}`)}&output=embed`;
export const mapaRuta = (dir, ciudad = "Bogotá, Colombia") =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${dir}, ${ciudad}`)}`;

// Foto de apoyo según la categoría
export const fotoCategoria = cat => {
  const c = String(cat || "").toLowerCase();
  if (/poste|tubo|accesor|angulo|platina/.test(c)) return "/web/img/tubos.jpg";
  if (/alambre|p[uú]as|concertina|guaya/.test(c)) return "/web/img/malla.jpg";
  return "/web/img/rollos.jpg";
};

export const DISP = {
  disponible:  { t: "Disponible",     cls: "ok" },
  pocas:       { t: "Pocas unidades", cls: "low" },
  bajo_pedido: { t: "Bajo pedido",    cls: "ord" },
};
