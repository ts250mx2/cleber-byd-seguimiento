import * as XLSX from "xlsx";
import type { FollowUpCase, Touchpoint } from "./types";
import { canonicalAgency } from "./agencies";

const clean = (value: unknown) => String(value ?? "").trim();
const key = (value: unknown) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const get = (row: Record<string, unknown>, aliases: string[]) => {
  for (const alias of aliases) {
    const match = Object.keys(row).find((header) => key(header) === alias);
    if (match) return row[match];
  }
  return undefined;
};
const iso = (value: unknown) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};
const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10);
};

export async function importExcel(file: File): Promise<FollowUpCase[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const cases: FollowUpCase[] = [];
  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    if (/ejemplo|script|fechas|hoja 7|hoja 8/i.test(sheetName)) return;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" });
    rows.forEach((row, rowIndex) => {
      const customer = clean(get(row, ["cliente", "nombre", "f"]) || Object.values(row)[0]);
      const vin = clean(get(row, ["vin"]));
      if ((!customer && !vin) || /intrucciones|secciones|ejemplo/i.test(customer)) return;
      const delivery = iso(get(row, ["fechaentrega", "fechaentregadelvehiculo"]));
      const invoice = iso(get(row, ["fechafacturacion", "fechadefacturacion"]));
      const source = key(get(row, ["7modiadespuesdelaentrega"])) ? "entrega" : delivery && get(row, ["coche"]) ? "entrega" : "servicio";
      const referenceDate = delivery || invoice || iso(get(row, ["fechadeapertura", "fechaapertura"])) || new Date().toISOString().slice(0, 10);
      const comment = clean(get(row, ["comentario", "llamadascomentario", "detalledelaqueja"]));
      const hasComplaint = Boolean(comment && !/todo.*bien|excelente|buzon|no atendio|no se pudo/i.test(comment));
      const touchpoints: Touchpoint[] = source === "entrega"
        ? ([7, 15, 28] as const).map((stage) => ({ stage, dueDate: addDays(referenceDate, stage) }))
        : [{ stage: "nps", dueDate: addDays(referenceDate, 7) }];
      cases.push({
        id: `IMP-${sheetIndex + 1}-${rowIndex + 2}`, customer: customer || "Cliente sin nombre",
        phone: clean(get(row, ["telefono"])), email: clean(get(row, ["email"])), agency: canonicalAgency(clean(get(row, ["agencia", "nombredistribuidora"])) || sheetName),
        vehicle: clean(get(row, ["coche", "modelo", "modelodelvehiculo", "vehiculo", "unidad"])), vin: vin || "Sin VIN", advisor: clean(get(row, ["vendedor", "nombreasesor", "asesor"])),
        bdcAgent: clean(get(row, ["asesorbdc", "agentebdc", "agente"])), source, referenceDate,
        status: hasComplaint ? "incidencia" : "pendiente", priority: hasComplaint ? "alta" : "normal", complaint: hasComplaint ? comment : undefined, touchpoints,
      });
    });
  });
  return cases;
}
