import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canonicalAgency } from "@/lib/agencies";
import { customerNameKey, vinKey } from "@/lib/customer-index";

const addDays = (date: string, days: number) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };

export async function POST(request: Request) {
  const payload = await request.json();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const agency = canonicalAgency(String(payload.agency || ""));
    const [agencyResult] = await connection.execute("INSERT INTO agencies (name) VALUES (?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)", [agency]);
    const agencyId = (agencyResult as { insertId: number }).insertId;
    const normalizedName = customerNameKey(String(payload.customer || ""));
    const [customerResult] = await connection.execute("INSERT INTO customers (full_name,normalized_name,phone,email) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),phone=IF(VALUES(phone)<>'',VALUES(phone),phone),email=IF(VALUES(email)<>'',VALUES(email),email)", [payload.customer, normalizedName, payload.phone || null, payload.email || null]);
    const customerId = (customerResult as { insertId: number }).insertId;
    let created = 0;
    for (const vehicle of payload.vehicles || []) {
      const vin = vinKey(String(vehicle.vin || ""));
      const [vehicleResult] = await connection.execute("INSERT INTO vehicles (customer_id,vin,model) VALUES (?,?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),model=VALUES(model)", [customerId, vin, vehicle.model]);
      const vehicleId = (vehicleResult as { insertId: number }).insertId;
      const [existing] = await connection.execute("SELECT id FROM follow_up_cases WHERE customer_id=? AND vehicle_id=? AND source=? AND reference_date=? LIMIT 1", [customerId, vehicleId, payload.source, payload.referenceDate]);
      if ((existing as unknown[]).length) continue;
      const [caseResult] = await connection.execute("INSERT INTO follow_up_cases (agency_id,customer_id,vehicle_id,advisor_name,bdc_agent_name,source,reference_date,status,priority) VALUES (?,?,?,?,?,?,?,'pendiente','normal')", [agencyId, customerId, vehicleId, payload.advisor || null, payload.bdcAgent || null, payload.source, payload.referenceDate]);
      const caseId = (caseResult as { insertId: number }).insertId;
      const stages = payload.source === "entrega" ? [["7", 7], ["15", 15], ["28", 28]] : [["nps", 7]];
      for (const [stage, days] of stages) await connection.execute("INSERT INTO touchpoints (case_id,stage,due_at) VALUES (?,?,?)", [caseId, stage, addDays(payload.referenceDate, Number(days))]);
      created++;
    }
    await connection.commit();
    return NextResponse.json({ created });
  } catch (error) {
    await connection.rollback(); console.error("POST /api/customers", error);
    return NextResponse.json({ error: "No fue posible guardar el cliente" }, { status: 500 });
  } finally { connection.release(); }
}
