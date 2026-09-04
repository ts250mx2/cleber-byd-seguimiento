import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const payload = await request.json();
  const caseId = Number(String(payload.caseId || "").replace("DB-", ""));
  if (!caseId || !payload.description) return NextResponse.json({ error: "Cliente e incidencia son obligatorios" }, { status: 400 });
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("INSERT INTO incidents (case_id,owner_name,description,priority,status,due_at) VALUES (?,?,?,?, 'abierta', ?)", [caseId, payload.owner || null, payload.description, payload.priority || "alta", payload.dueDate || null]);
    await connection.execute("UPDATE follow_up_cases SET status='incidencia', priority=? WHERE id=?", [payload.priority || "alta", caseId]);
    await connection.commit();
    return NextResponse.json({ ok: true });
  } catch (error) {
    await connection.rollback(); console.error("POST /api/incidents", error);
    return NextResponse.json({ error: "No fue posible crear la incidencia" }, { status: 500 });
  } finally { connection.release(); }
}
