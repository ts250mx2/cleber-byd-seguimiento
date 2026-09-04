import type { FollowUpCase } from "./types";

export const demoCases: FollowUpCase[] = [
  {
    id: "BYD-1048", customer: "Mariana Lozano", phone: "81 8000 1428", email: "mariana@example.com",
    agency: "San Pedro", vehicle: "Dolphin Mini", vin: "LGXCE4CC•••7142", advisor: "Carlos Garza", bdcAgent: "Citlally",
    source: "entrega", referenceDate: "2026-08-19", status: "incidencia", priority: "alta",
    complaint: "La unidad no aparece vinculada en la aplicación BYD.", solution: "Validar correo registrado con ventas.",
    touchpoints: [
      { stage: 7, dueDate: "2026-08-26", completedAt: "2026-08-26", result: "Contactado", note: "Reporta problema con la aplicación." },
      { stage: 15, dueDate: "2026-09-03" }, { stage: 28, dueDate: "2026-09-16" },
    ],
  },
  {
    id: "BYD-1042", customer: "Ricardo Treviño", phone: "81 8000 9031", agency: "Linda Vista", vehicle: "Song Plus DM-i",
    vin: "LGXC74C4•••5831", advisor: "Fernando Navarro", bdcAgent: "Enrique", source: "servicio", referenceDate: "2026-08-27",
    status: "pendiente", priority: "media", touchpoints: [{ stage: "nps", dueDate: "2026-09-03" }],
  },
  {
    id: "BYD-1039", customer: "Alejandra Villarreal", phone: "81 8000 3349", agency: "Carretera Nacional", vehicle: "BYD King DM-i",
    vin: "LC0C76C4•••3543", advisor: "Diego Rocha", bdcAgent: "Enrique", source: "entrega", referenceDate: "2026-08-18",
    status: "contactado", priority: "normal", touchpoints: [
      { stage: 7, dueDate: "2026-08-25", completedAt: "2026-08-25", result: "Sin novedad", note: "Todo en orden con la unidad." },
      { stage: 15, dueDate: "2026-09-02", completedAt: "2026-09-02", result: "Contactado", note: "Cliente satisfecho." },
      { stage: 28, dueDate: "2026-09-15" },
    ],
  },
  {
    id: "BYD-1036", customer: "Sergio Montalvo", phone: "81 8000 5552", agency: "Chihuahua", vehicle: "Shark DM-O",
    vin: "LC0C74C4•••8205", advisor: "Laura Campos", bdcAgent: "Citlally", source: "servicio", referenceDate: "2026-08-25",
    status: "no-localizado", priority: "media", touchpoints: [{ stage: "nps", dueDate: "2026-09-01", result: "Buzón", note: "Primer intento sin contacto." }],
  },
  {
    id: "BYD-1031", customer: "Claudia Elizondo", phone: "65 6000 1189", agency: "Juárez", vehicle: "Yuan Pro",
    vin: "LPE19W2A•••1616", advisor: "Eduardo Peña", bdcAgent: "Paola", source: "entrega", referenceDate: "2026-08-10",
    status: "resuelto", priority: "normal", complaint: "Faltaba adaptador de carga en la entrega.", solution: "Accesorio entregado el 29 de agosto.",
    touchpoints: [
      { stage: 7, dueDate: "2026-08-17", completedAt: "2026-08-17", result: "Incidencia" },
      { stage: 15, dueDate: "2026-08-25", completedAt: "2026-08-25", result: "En proceso" },
      { stage: 28, dueDate: "2026-09-07" },
    ],
  },
  {
    id: "BYD-1027", customer: "Mauricio Rangel", phone: "81 8000 7211", agency: "San Pedro", vehicle: "Seal", vin: "LGXCE4CB•••5440",
    advisor: "Ana Salas", bdcAgent: "Citlally", source: "servicio", referenceDate: "2026-08-26", status: "contactado", priority: "normal",
    touchpoints: [{ stage: "nps", dueDate: "2026-09-02", completedAt: "2026-09-02", result: "Excelente", note: "Confirmó que responderá la encuesta." }],
  },
  {
    id: "BYD-1022", customer: "Natalia Sada", phone: "81 8000 6718", agency: "Linda Vista", vehicle: "Dolphin Mini", vin: "LGXCE4CC•••0185",
    advisor: "Jorge Cruz", bdcAgent: "Citlally", source: "entrega", referenceDate: "2026-08-05", status: "pendiente", priority: "alta",
    touchpoints: [{ stage: 7, dueDate: "2026-08-12", completedAt: "2026-08-12", result: "Buzón" }, { stage: 15, dueDate: "2026-08-20" }, { stage: 28, dueDate: "2026-09-02" }],
  },
];
