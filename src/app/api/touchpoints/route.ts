import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const payload = await request.json();
  const caseId = Number(String(payload.caseId || "").replace("DB-", ""));
  if (!caseId || !payload.stage) return NextResponse.json({ error: "Seguimiento inválido" }, { status: 400 });
  const status = payload.complaint ? "incidencia" : payload.result === "No localizado" ? "no_localizado" : "contactado";
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("UPDATE touchpoints SET completed_at=NOW(),result=?,notes=? WHERE case_id=? AND stage=?", [payload.result, payload.note || null, caseId, String(payload.stage)]);
    await connection.execute("UPDATE follow_up_cases SET status=?,priority=? WHERE id=?", [status, payload.complaint ? "alta" : "normal", caseId]);
    if (payload.complaint) await connection.execute("INSERT INTO incidents (case_id,description,priority,status) VALUES (?,?,'alta','abierta')", [caseId, payload.note]);
    await connection.commit();
    return NextResponse.json({ ok: true });
  } catch (error) {
    await connection.rollback(); console.error("POST /api/touchpoints", error);
    return NextResponse.json({ error: "No fue posible guardar el seguimiento" }, { status: 500 });
  } finally { connection.release(); }
}
