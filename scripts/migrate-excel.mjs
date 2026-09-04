import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import XLSX from "xlsx";

const root = process.cwd();
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim();
}

const files = ["NPS POSTVENTA.xlsx", "Plantilla de seguimiento Q4 - BYD CLEBER.xlsx"];
const clean = (value) => String(value ?? "").trim();
const headerKey = (value) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const normalizedName = (value) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\b(S\.?A\.?\s+DE\s+C\.?V\.?|S\.?\s+DE\s+R\.?L\.?\s+DE\s+C\.?V\.?)\b/g, "").replace(/[^A-Z0-9]/g, "");
const normalizedVin = (value) => clean(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
const get = (row, aliases) => {
  for (const alias of aliases) {
    const match = Object.keys(row).find((header) => headerKey(header) === alias);
    if (match) return row[match];
  }
  return undefined;
};
const hasHeader = (row, aliases) => Object.keys(row).some((header) => aliases.includes(headerKey(header)));
const iso = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getUTCFullYear();
  return Number.isNaN(date.getTime()) || year < 2000 || year > 2100 ? "" : date.toISOString().slice(0, 10);
};
const dateTime = (value) => { const date = iso(value); return date ? `${date} 12:00:00` : null; };
const addDays = (date, days) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
const canonicalAgency = (value) => {
  const agency = clean(value).replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (/^(byd\s*)?(carretera\s*nacional|carretera)$/i.test(agency)) return "Carretera Nacional";
  if (/^(byd\s*)?(chihuahua|cuu)$/i.test(agency)) return "Chihuahua";
  if (/^(byd\s*)?linda\s*vista$/i.test(agency)) return "Linda Vista";
  if (/^(byd\s*)?ju[aá]rez$/i.test(agency)) return "Juárez";
  if (/^(byd\s*)?san\s*pedro$/i.test(agency)) return "San Pedro";
  if (/^formato$/i.test(agency)) return "Sin agencia";
  return agency || "Sin agencia";
};
const meaningfulComplaint = (comment) => {
  if (!comment) return false;
  const operationalOutcome = /todo.*bien|excelente|muy buen|buen servicio|sin novedad|sin comentario|buz[oó]n|no atendi[oó]|no se pudo|no contest|cliente colg[oó]|n[uú]mero no|no hay n[uú]mero|no localizado|no se contact[oó]|sin respuesta|equivocado|apagado|fuera de servicio|contestara|contestar[aá]|responder[aá]|^empresa$|^n\/?a$/i;
  const complaintSignal = /problema|detalle|molest|queja|pendiente|falta|fall|no funciona|no sirve|ruido|tard|demora|precio|cobro|dañ|ray[oó]|golpe|mal servicio|inconforme|esperando|reclama|carplay|aplicaci[oó]n|adaptador|cargador|amortiguador|bater[ií]a|refacci[oó]n|garant[ií]a|no entreg|no explic|sucio|lavado/i;
  return !operationalOutcome.test(comment.trim()) && complaintSignal.test(comment.trim());
};

function parseFiles() {
  const records = [];
  for (const file of files) {
    const workbook = XLSX.readFile(path.join(root, file), { cellDates: true, cellFormula: true });
    workbook.SheetNames.forEach((sheetName) => {
      if (/ejemplo|script|fechas|hoja 7|hoja 8/i.test(sheetName)) return;
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", raw: true });
      rows.forEach((row, rowIndex) => {
        const customer = clean(get(row, ["cliente", "nombre"]) || Object.values(row)[0]);
        const rawVin = clean(get(row, ["vin", "f"]));
        if ((!customer && !rawVin) || /intrucciones|secciones|ejemplo/i.test(customer)) return;
        const delivery = iso(get(row, ["fechaentrega", "fechaentregadelvehiculo"]));
        const invoice = iso(get(row, ["fechafacturacion", "fechadefacturacion"]));
        const opening = iso(get(row, ["fechadeapertura", "fechaapertura"]));
        const isDelivery = hasHeader(row, ["7modiadespuesdelaentrega"]);
        const referenceDate = delivery || invoice || opening || new Date().toISOString().slice(0, 10);
        const comment = clean(get(row, ["comentario", "llamadascomentario", "detalledelaqueja"]));
        const importKey = `${file}|${sheetName}|${rowIndex + 2}`;
        const vin = normalizedVin(rawVin) || `SINVIN${Buffer.from(importKey).toString("hex").slice(-20).toUpperCase()}`;
        const stages = isDelivery ? [
          { stage: "7", due: iso(get(row, ["7modiadespuesdelaentrega"])) || addDays(referenceDate, 7), note: clean(get(row, ["detalledelaqueja"])), result: clean(get(row, ["solucionadosino", "clientetienequeja"])) },
          { stage: "15", due: iso(get(row, ["15vodiadespuesdelaentrega"])) || addDays(referenceDate, 15), note: "", result: "" },
          { stage: "28", due: iso(get(row, ["28vodiadespuesdelaentrega"])) || addDays(referenceDate, 28), note: clean(get(row, ["califidaddecalidad"])), result: "" },
        ] : [{ stage: "nps", due: addDays(referenceDate, 7), note: comment, completed: get(row, ["llamada", "llamadadeseguimiento", "fechadellamada", "fechaencuesta"]), result: comment ? (/buz[oó]n|no atendio|no se pudo/i.test(comment) ? "No localizado" : "Contactado") : "" }];
        const complaint = meaningfulComplaint(comment) ? comment : "";
        records.push({
          importKey, sourceFile: file, sourceSheet: sheetName, sourceRow: rowIndex + 2,
          customer: customer || "Cliente sin nombre", normalizedCustomer: normalizedName(customer || "Cliente sin nombre"),
          phone: clean(get(row, ["telefono"])), email: clean(get(row, ["email"])), agency: canonicalAgency(clean(get(row, ["agencia", "nombredistribuidora"])) || sheetName),
          vin, model: clean(get(row, ["coche", "modelo", "modelodelvehiculo", "vehiculo", "unidad"])), modelYear: Number(get(row, ["ano"])) || null, mileage: Number(get(row, ["kilometraje"])) || null,
          advisor: clean(get(row, ["vendedor", "nombreasesor", "asesor"])), bdcAgent: clean(get(row, ["asesorbdc", "agentebdc", "agente"])), order: clean(get(row, ["nroorden", "numerodeorden"])),
          source: isDelivery ? "entrega" : "servicio", referenceDate, status: complaint ? "incidencia" : stages.some((stage) => stage.completed || stage.note || stage.result) ? "contactado" : "pendiente", priority: complaint ? "alta" : "normal", complaint, stages,
        });
      });
    });
  }
  return records;
}

const chunks = (items, size = 500) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

async function bulkMigrate() {
  const records = parseFiles();
  const admin = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, multipleStatements: true });
  await admin.query("CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", [process.env.DB_NAME]);
  await admin.end();
  const connection = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, multipleStatements: true, charset: "utf8mb4" });
  await connection.query(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
  await connection.query("ALTER TABLE customers MODIFY phone VARCHAR(100) NULL");
  await connection.query("ALTER TABLE vehicles MODIFY vin VARCHAR(255) NOT NULL");
  await connection.query("ALTER TABLE touchpoints MODIFY result TEXT NULL");
  const [ownerColumn] = await connection.query("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='incidents' AND COLUMN_NAME='owner_name'", [process.env.DB_NAME]);
  if (!ownerColumn.length) await connection.query("ALTER TABLE incidents ADD COLUMN owner_name VARCHAR(190) NULL AFTER owner_id");

  await connection.beginTransaction();
  try {
    const agencyNames = [...new Set(records.map((record) => record.agency))];
    await connection.query("INSERT INTO agencies (name) VALUES ? ON DUPLICATE KEY UPDATE active=TRUE", [agencyNames.map((name) => [name])]);
    const [agencyRows] = await connection.query("SELECT id,name FROM agencies");
    const agencyIds = new Map(agencyRows.map((row) => [row.name, row.id]));

    const customerRecords = new Map();
    for (const record of records) {
      const current = customerRecords.get(record.normalizedCustomer);
      if (!current || [record.phone, record.email].filter(Boolean).length > [current.phone, current.email].filter(Boolean).length) customerRecords.set(record.normalizedCustomer, record);
    }
    for (const batch of chunks([...customerRecords.values()])) {
      await connection.query("INSERT INTO customers (full_name,normalized_name,phone,email) VALUES ? ON DUPLICATE KEY UPDATE full_name=IF(CHAR_LENGTH(VALUES(full_name))>CHAR_LENGTH(full_name),VALUES(full_name),full_name),phone=IF(VALUES(phone)<>'',VALUES(phone),phone),email=IF(VALUES(email)<>'',VALUES(email),email)", [batch.map((record) => [record.customer, record.normalizedCustomer, record.phone || null, record.email || null])]);
    }
    const [customerRows] = await connection.query("SELECT id,normalized_name FROM customers");
    const customerIds = new Map(customerRows.map((row) => [row.normalized_name, row.id]));

    const vehicleRecords = new Map();
    for (const record of records) {
      const customerId = customerIds.get(record.normalizedCustomer);
      const key = `${customerId}|${record.vin}`;
      const current = vehicleRecords.get(key);
      if (!current || (!current.model && record.model) || (record.mileage || 0) > (current.mileage || 0)) vehicleRecords.set(key, { ...record, customerId });
    }
    for (const batch of chunks([...vehicleRecords.values()])) {
      await connection.query("INSERT INTO vehicles (customer_id,vin,model,model_year,current_mileage) VALUES ? ON DUPLICATE KEY UPDATE model=IF(VALUES(model)<>'',VALUES(model),model),model_year=COALESCE(VALUES(model_year),model_year),current_mileage=GREATEST(COALESCE(VALUES(current_mileage),0),COALESCE(current_mileage,0))", [batch.map((record) => [record.customerId, record.vin, record.model || null, record.modelYear, record.mileage])]);
    }
    const [vehicleRows] = await connection.query("SELECT id,customer_id,vin FROM vehicles");
    const vehicleIds = new Map(vehicleRows.map((row) => [`${row.customer_id}|${row.vin}`, row.id]));

    for (const batch of chunks(records)) {
      await connection.query("INSERT INTO follow_up_cases (agency_id,customer_id,vehicle_id,advisor_name,bdc_agent_name,source,import_key,source_file,source_sheet,source_row,external_order,reference_date,status,priority) VALUES ? ON DUPLICATE KEY UPDATE agency_id=VALUES(agency_id),advisor_name=IF(VALUES(advisor_name)<>'',VALUES(advisor_name),advisor_name),bdc_agent_name=IF(VALUES(bdc_agent_name)<>'',VALUES(bdc_agent_name),bdc_agent_name),status=VALUES(status),priority=VALUES(priority)", [batch.map((record) => { const customerId = customerIds.get(record.normalizedCustomer); return [agencyIds.get(record.agency), customerId, vehicleIds.get(`${customerId}|${record.vin}`), record.advisor || null, record.bdcAgent || null, record.source, record.importKey, record.sourceFile, record.sourceSheet, record.sourceRow, record.order || null, record.referenceDate, record.status, record.priority]; })]);
    }
    const [caseRows] = await connection.query("SELECT id,import_key FROM follow_up_cases WHERE import_key IS NOT NULL");
    const caseIds = new Map(caseRows.map((row) => [row.import_key, row.id]));

    const touchpoints = records.flatMap((record) => record.stages.map((stage) => {
      const completedAt = stage.completed ? dateTime(stage.completed) : (stage.note || stage.result ? `${stage.due} 12:00:00` : null);
      return [caseIds.get(record.importKey), stage.stage, stage.due, completedAt, stage.result || null, stage.note || null];
    }));
    for (const batch of chunks(touchpoints, 1000)) await connection.query("INSERT INTO touchpoints (case_id,stage,due_at,completed_at,result,notes) VALUES ? ON DUPLICATE KEY UPDATE due_at=VALUES(due_at),completed_at=COALESCE(VALUES(completed_at),completed_at),result=IF(VALUES(result)<>'',VALUES(result),result),notes=IF(VALUES(notes)<>'',VALUES(notes),notes)", [batch]);

    await connection.query("DELETE i FROM incidents i JOIN follow_up_cases fc ON fc.id=i.case_id WHERE fc.import_key IS NOT NULL");
    const [existingIncidentRows] = await connection.query("SELECT case_id FROM incidents");
    const existingIncidentIds = new Set(existingIncidentRows.map((row) => Number(row.case_id)));
    const incidentRows = records.filter((record) => record.complaint && !existingIncidentIds.has(Number(caseIds.get(record.importKey)))).map((record) => [caseIds.get(record.importKey), record.complaint, record.priority, "abierta"]);
    for (const batch of chunks(incidentRows, 1000)) if (batch.length) await connection.query("INSERT INTO incidents (case_id,description,priority,status) VALUES ?", [batch]);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }

  const [counts] = await connection.query("SELECT (SELECT COUNT(*) FROM customers) customers,(SELECT COUNT(*) FROM vehicles) vehicles,(SELECT COUNT(*) FROM follow_up_cases) cases,(SELECT COUNT(*) FROM touchpoints) touchpoints,(SELECT COUNT(*) FROM incidents) incidents");
  console.log(JSON.stringify({ parsed: records.length, database: process.env.DB_NAME, totals: counts[0] }, null, 2));
  await connection.end();
}

bulkMigrate().catch((error) => { console.error(error.code || error.name, error.message); process.exit(1); });
