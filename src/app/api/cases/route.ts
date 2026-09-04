import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { FollowUpCase, Stage, Touchpoint } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [caseRows] = await db.query(`
      SELECT fc.id, c.full_name customer, c.phone, c.email, a.name agency,
             v.model vehicle, v.vin, fc.advisor_name advisor, fc.bdc_agent_name bdc_agent,
             fc.source, fc.reference_date, fc.status, fc.priority,
             i.description complaint, i.solution, i.owner_name incident_owner,
             DATE(i.due_at) incident_due_date
      FROM follow_up_cases fc
      JOIN customers c ON c.id=fc.customer_id
      JOIN vehicles v ON v.id=fc.vehicle_id
      JOIN agencies a ON a.id=fc.agency_id
      LEFT JOIN incidents i ON i.id=(SELECT MAX(i2.id) FROM incidents i2 WHERE i2.case_id=fc.id)
      ORDER BY fc.reference_date DESC, fc.id DESC
      LIMIT 25000
    `);
    const [touchRows] = await db.query(`
      SELECT t.case_id, t.stage, t.due_at, t.completed_at, t.result, t.notes
      FROM touchpoints t
      JOIN follow_up_cases fc ON fc.id=t.case_id
      ORDER BY t.case_id, FIELD(t.stage,'7','15','28','nps')
      LIMIT 75000
    `);
    const touches = new Map<number, Touchpoint[]>();
    for (const row of touchRows as Array<Record<string, string | number | null>>) {
      const caseId = Number(row.case_id);
      const stageValue = String(row.stage);
      const point: Touchpoint = {
        stage: (stageValue === "nps" ? "nps" : Number(stageValue)) as Stage,
        dueDate: String(row.due_at).slice(0, 10),
        completedAt: row.completed_at ? String(row.completed_at).slice(0, 10) : undefined,
        result: row.result ? String(row.result) : undefined,
        note: row.notes ? String(row.notes) : undefined,
      };
      touches.set(caseId, [...(touches.get(caseId) || []), point]);
    }
    const cases: FollowUpCase[] = (caseRows as Array<Record<string, string | number | null>>).map((row) => ({
      id: `DB-${row.id}`, customer: String(row.customer), phone: String(row.phone || ""), email: row.email ? String(row.email) : undefined,
      agency: String(row.agency), vehicle: String(row.vehicle || ""), vin: String(row.vin), advisor: String(row.advisor || ""), bdcAgent: String(row.bdc_agent || ""),
      source: row.source as FollowUpCase["source"], referenceDate: String(row.reference_date).slice(0, 10),
      status: row.status === "no_localizado" ? "no-localizado" : row.status as FollowUpCase["status"], priority: row.priority as FollowUpCase["priority"],
      complaint: row.complaint ? String(row.complaint) : undefined, solution: row.solution ? String(row.solution) : undefined,
      incidentOwner: row.incident_owner ? String(row.incident_owner) : undefined,
      incidentDueDate: row.incident_due_date ? String(row.incident_due_date).slice(0, 10) : undefined,
      touchpoints: touches.get(Number(row.id)) || [],
    }));
    return NextResponse.json({ cases });
  } catch (error) {
    console.error("GET /api/cases", error);
    return NextResponse.json({ error: "No fue posible consultar la base de datos" }, { status: 500 });
  }
}
