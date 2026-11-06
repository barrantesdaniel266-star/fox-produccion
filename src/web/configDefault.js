// Contenido inicial del sitio público. La pestaña "Sitio Web" del sistema (gerencia) lo
// sobrescribe campo por campo guardando en Firestore: sitio/config.
// En heroTitulo, lo que va entre *asteriscos* se resalta en rojo.
export const CONFIG_DEFAULT = {
  titulo: "Mallas y Alambres Fox",
  colorAcento: "#E13E30",
  banner: "",
  heroTitulo: "Somos *fabricantes* de mallas y cerramientos perimetrales",
  heroSubtitulo: "Malla eslabonada, malla PVC, postes, tubería y alambres con producción propia en Bogotá. Consulta disponibilidad en tiempo real y cotiza en minutos.",
  imagenHero: "",
  nosotros: "Somos fabricantes de malla eslabonada, malla PVC, postes y alambres, con producción propia y despacho en Bogotá. Te asesoramos para elegir el material correcto para tu proyecto, desde un lote hasta una obra industrial.",
  whatsapp: "",
  horario: "",
  email: "",
  instagram: "",
  facebook: "",
  ciudad: "Bogotá, Colombia",
  sedes: [
    { nombre: "Sede Centro", direccion: "Calle 12 # 15-87", telefono: "321 424 0407 · 322 914 7720" },
    { nombre: "Sede Santa Lucía", direccion: "Cra 22 # 44 Sur - 62", telefono: "310 754 1094 · 320 315 3731" },
  ],
};
