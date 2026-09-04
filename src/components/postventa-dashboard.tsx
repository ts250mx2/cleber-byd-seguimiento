"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle, BarChart3, Bell, CalendarDays, Check, ChevronDown, ChevronRight,
  CarFront, Download, FileSpreadsheet, Gauge, Headphones, LayoutDashboard, Menu,
  MoreHorizontal, Pencil, Phone, Plus, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Upload,
  UserRound, Users, X,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { demoCases } from "@/lib/demo-data";
import { importExcel } from "@/lib/excel-import";
import type { CaseStatus, FollowUpCase, Stage } from "@/lib/types";
import { canonicalAgencies, canonicalAgency } from "@/lib/agencies";
import { customerNameKey, customerVinKey, indexCasesByCustomerVin, vinKey } from "@/lib/customer-index";
import { vehicleImageFor } from "@/lib/vehicle-images";

const navItems = [
  { id: "dashboard", label: "Resumen", icon: LayoutDashboard },
  { id: "seguimiento", label: "Seguimientos", icon: Headphones },
  { id: "incidencias", label: "Incidencias", icon: AlertTriangle },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "reportes", label: "Reportes", icon: BarChart3 },
] as const;

type View = (typeof navItems)[number]["id"];
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
type NewCustomerPayload = {
  customer: string; phone: string; email?: string; agency: string; advisor: string; bdcAgent: string;
  source: "entrega" | "servicio"; referenceDate: string; vehicles: Array<{ vin: string; model: string }>;
};
type CustomerGroup = { key: string; name: string; phone: string; email?: string; cases: FollowUpCase[] };
type EditCustomerPayload = { customer: string; phone: string; email?: string; vehicles: Array<{ caseId: string; vin: string; model: string }> };
type VehicleModalPayload = { mode: "new" | "edit"; caseId?: string; vin: string; model: string; agency: string; source: "entrega" | "servicio"; referenceDate: string; advisor: string; bdcAgent: string };

const stageLabel = (stage: Stage) => stage === "nps" ? "NPS" : `Día ${stage}`;
const prettyDate = (date: string) => new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`)).replace(".", "");
const statusLabel: Record<CaseStatus, string> = {
  pendiente: "Pendiente", contactado: "Contactado", incidencia: "Incidencia", resuelto: "Resuelto", "no-localizado": "No localizado",
};

function getNext(item: FollowUpCase) {
  return item.touchpoints.find((point) => !point.completedAt) ?? item.touchpoints[item.touchpoints.length - 1];
}

async function fetchDatabaseCases() {
  const response = await fetch("/api/cases", { cache: "no-store" });
  if (!response.ok) throw new Error("database unavailable");
  const data = await response.json() as { cases: FollowUpCase[] };
  return data.cases;
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "request failed");
  return response.json();
}

function Badge({ status }: { status: CaseStatus }) {
  return <span className={`status status-${status}`}><i />{statusLabel[status]}</span>;
}

function VehiclePhoto({ model, status, compact = false }: { model: string; status: CaseStatus; compact?: boolean }) {
  const photo = vehicleImageFor(model);
  return <div className={`vehicle-photo${compact ? " vehicle-photo-compact" : ""}${photo ? "" : " vehicle-photo-fallback"}`}>
    {photo ? <Image src={photo.src} alt={`BYD ${photo.family}`} fill sizes={compact ? "116px" : "(max-width: 700px) 100vw, 260px"} /> : <CarFront size={compact ? 30 : 48} strokeWidth={1.25} />}
    <span className="vehicle-photo-family">{photo?.family || "MODELO BYD"}</span>
    <Badge status={status} />
  </div>;
}

function RouteRail({ item, compact = false }: { item: FollowUpCase; compact?: boolean }) {
  return (
    <div className={`route-rail ${compact ? "route-compact" : ""}`}>
      {item.touchpoints.map((point, index) => {
        const done = Boolean(point.completedAt);
        const late = !done && point.dueDate < today;
        const active = !done && item.touchpoints.slice(0, index).every((entry) => entry.completedAt);
        return (
          <div className="route-step" key={`${item.id}-${point.stage}`}>
            <span className={`route-node ${done ? "done" : late ? "late" : active ? "active" : ""}`}>
              {done ? <Check size={12} strokeWidth={3} /> : stageLabel(point.stage).replace("Día ", "")}
            </span>
            {!compact && <span className="route-copy"><strong>{stageLabel(point.stage)}</strong><small>{done ? "Completado" : prettyDate(point.dueDate)}</small></span>}
          </div>
        );
      })}
    </div>
  );
}

function Metric({ label, value, detail, icon: Icon, tone = "ink" }: { label: string; value: string | number; detail: string; icon: typeof Gauge; tone?: string }) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-top"><span>{label}</span><Icon size={17} /></div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function PostventaDashboard() {
  const [view, setView] = useState<View>("dashboard");
  const [cases, setCases] = useState<FollowUpCase[]>(demoCases);
  const [selected, setSelected] = useState<FollowUpCase | null>(null);
  const [recording, setRecording] = useState<FollowUpCase | null>(null);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [addingIncident, setAddingIncident] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerGroup | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const [agency, setAgency] = useState("Todas las agencias");
  const [status, setStatus] = useState("Todos los estados");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDatabaseCases().then((databaseCases) => setCases(databaseCases)).catch(() => {
      const stored = window.localStorage.getItem("cleber-byd-cases");
      if (!stored) return;
      try { setCases((JSON.parse(stored) as FollowUpCase[]).map((item) => ({ ...item, agency: canonicalAgency(item.agency) }))); } catch { /* keep demo data */ }
    });
  }, []);

  const refreshCases = async () => setCases(await fetchDatabaseCases());

  const save = (next: FollowUpCase[]) => {
    const normalized = next.map((item) => ({ ...item, agency: canonicalAgency(item.agency) }));
    setCases(normalized);
    try {
      window.localStorage.setItem("cleber-byd-cases", JSON.stringify(normalized));
    } catch {
      // The full historical workbooks can exceed browser storage. The active
      // session still keeps every imported row; production uses MySQL.
    }
  };

  const agencies = useMemo(() => ["Todas las agencias", ...Array.from(new Set(cases.map((item) => item.agency))).sort()], [cases]);
  const indexedVehicles = useMemo(() => indexCasesByCustomerVin(cases), [cases]);
  const customers = useMemo(() => {
    const groups = new Map<string, CustomerGroup>();
    indexedVehicles.forEach((item) => {
      const customerKey = customerNameKey(item.customer);
      const current = groups.get(customerKey);
      if (current) current.cases.push(item);
      else groups.set(customerKey, { key: customerKey, name: item.customer, phone: item.phone, email: item.email, cases: [item] });
    });
    return Array.from(groups.values()).filter((customer) => `${customer.name} ${customer.phone} ${customer.cases.map((item) => `${item.vin} ${item.vehicle}`).join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  }, [indexedVehicles, query]);
  const filtered = useMemo(() => cases.filter((item) => {
    const text = `${item.customer} ${item.phone} ${item.vin} ${item.vehicle}`.toLowerCase();
    const matchesView = view !== "incidencias" || item.status === "incidencia";
    return matchesView && text.includes(query.toLowerCase()) && (agency === "Todas las agencias" || item.agency === agency) && (status === "Todos los estados" || item.status === status);
  }), [cases, query, agency, status, view]);

  const pending = cases.filter((item) => !getNext(item)?.completedAt).length;
  const late = cases.filter((item) => { const next = getNext(item); return next && !next.completedAt && next.dueDate < today; }).length;
  const incidents = cases.filter((item) => item.status === "incidencia").length;
  const customerCount = new Set(indexedVehicles.map((item) => customerNameKey(item.customer))).size;
  const completedTouches = cases.flatMap((item) => item.touchpoints).filter((point) => point.completedAt).length;
  const totalDue = cases.flatMap((item) => item.touchpoints).filter((point) => point.dueDate <= today).length;
  const compliance = totalDue ? Math.round((completedTouches / totalDue) * 100) : 0;
  const chartData = agencies.slice(1).map((name) => {
    const branch = cases.filter((item) => item.agency === name);
    const completed = branch.filter((item) => item.status === "contactado" || item.status === "resuelto").length;
    return { name: name.replace("Carretera Nacional", "Carr. Nacional"), value: branch.length ? Math.round((completed / branch.length) * 100) : 0 };
  });

  const announce = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3200); };

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const imported = await importExcel(file);
      save([...imported, ...cases]);
      announce(`${imported.length.toLocaleString("es-MX")} registros importados desde ${file.name}`);
    } catch { announce("No fue posible leer el archivo. Verifica que sea un Excel válido."); }
  };

  const addCustomer = async (payload: NewCustomerPayload) => {
    const existingKeys = new Set(cases.map(customerVinKey));
    const newVehicles = payload.vehicles.filter((vehicle) => !existingKeys.has(`${customerNameKey(payload.customer)}|${vinKey(vehicle.vin)}`));
    if (!newVehicles.length) { announce("Ese cliente y VIN ya están registrados"); return; }
    try {
      const result = await postJson("/api/customers", { ...payload, vehicles: newVehicles }) as { created: number };
      await refreshCases(); setAddingCustomer(false); setView("clientes");
      const ignored = payload.vehicles.length - newVehicles.length;
      announce(`Cliente guardado con ${result.created} ${result.created === 1 ? "vehículo" : "vehículos"}${ignored ? `; ${ignored} VIN duplicado no se agregó` : ""}`);
    } catch { announce("No fue posible guardar el cliente en la base de datos"); }
  };

  const addIncident = async (caseId: string, description: string, owner: string, dueDate: string, priority: FollowUpCase["priority"]) => {
    try {
      await postJson("/api/incidents", { caseId, description, owner, dueDate, priority });
      await refreshCases(); setAddingIncident(false); setView("incidencias"); announce("Incidencia creada y asignada");
    } catch { announce("No fue posible crear la incidencia en la base de datos"); }
  };

  const editCustomer = async (payload: EditCustomerPayload) => {
    try {
      await postJson("/api/customers", { ...payload, action: "update" });
      await refreshCases(); setEditingCustomer(null); announce("Cliente y vehículos actualizados");
    } catch (error) { announce(error instanceof Error ? error.message : "No fue posible actualizar el cliente"); }
  };

  const saveCustomerVehicle = async (customer: CustomerGroup, payload: VehicleModalPayload) => {
    try {
      if (payload.mode === "edit") await postJson("/api/customers", { action: "updateVehicle", caseId: payload.caseId, vin: payload.vin, model: payload.model });
      else await postJson("/api/customers", { action: "addVehicle", customerCaseId: customer.cases[0].id, ...payload });
      await refreshCases(); setEditingCustomer(null); announce(payload.mode === "edit" ? "Vehículo actualizado" : "Vehículo agregado al cliente");
    } catch (error) { announce(error instanceof Error ? error.message : "No fue posible guardar el vehículo"); }
  };

  const exportCsv = () => {
    const rows = [["Folio", "Cliente", "Teléfono", "Agencia", "Vehículo", "VIN", "Origen", "Estado", "Próximo contacto"], ...filtered.map((item) => [item.id, item.customer, item.phone, item.agency, item.vehicle, item.vin, item.source, statusLabel[item.status], getNext(item)?.dueDate ?? ""])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })); anchor.download = `seguimientos-byd-${today}.csv`; anchor.click(); URL.revokeObjectURL(anchor.href);
    announce("Reporte exportado correctamente");
  };

  const completeTouch = async (item: FollowUpCase, result: string, note: string, complaint: boolean) => {
    const nextPoint = item.touchpoints.find((point) => !point.completedAt);
    if (!nextPoint) return;
    try {
      await postJson("/api/touchpoints", { caseId: item.id, stage: nextPoint.stage, result, note, complaint });
      await refreshCases(); setRecording(null); setSelected(null); announce("Seguimiento guardado en la base de datos");
    } catch { announce("No fue posible guardar el seguimiento en la base de datos"); }
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <div className="brand"><Image src="/brand/byd-cleber-logo.svg" alt="BYD CLEBER" width={164} height={61} priority /><span>Customer care</span></div>
        <button className="nav-close" onClick={() => setMobileNav(false)} aria-label="Cerrar menú"><X size={20} /></button>
        <nav>
          <span className="nav-caption">OPERACIÓN</span>
          {navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setMobileNav(false); }}><item.icon size={18} /><span>{item.label}</span>{item.id === "incidencias" && incidents > 0 && <em>{incidents}</em>}</button>)}
          <span className="nav-caption nav-second">GESTIÓN</span>
          <button onClick={() => fileRef.current?.click()}><FileSpreadsheet size={18} /><span>Importar Excel</span></button>
          <button onClick={() => announce("Configuración disponible en la siguiente fase")}><Settings2 size={18} /><span>Configuración</span></button>
        </nav>
        <div className="sidebar-foot"><ShieldCheck size={18} /><div><strong>Datos protegidos</strong><span>Sesión de administrador</span></div></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Abrir menú"><Menu size={21} /></button>
          <div className="topbar-title"><span>Postventa</span><ChevronRight size={13} /><strong>{navItems.find((item) => item.id === view)?.label}</strong></div>
          <div className="topbar-actions"><button className="icon-button"><Bell size={18} /><i /></button><div className="avatar">AR</div><div className="user-copy"><strong>Administrador</strong><span>Grupo CLEBER</span></div><ChevronDown size={15} /></div>
        </header>

        <div className="content">
          <section className="page-heading">
            <div><span className="eyebrow">CONTROL DE EXPERIENCIA</span><h1>{view === "dashboard" ? "El día, bajo control." : navItems.find((item) => item.id === view)?.label}</h1><p>{view === "dashboard" ? "Seguimientos de entrega, servicio e incidencias en un solo lugar." : `${filtered.length} expedientes visibles con los filtros actuales.`}</p></div>
            <div className="heading-actions">
              <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={(event) => handleImport(event.target.files?.[0])} />
              <button className="button secondary import-button" onClick={() => fileRef.current?.click()}><Upload size={16} />Importar Excel</button>
              <button className="button secondary incident-button" onClick={() => setAddingIncident(true)}><AlertTriangle size={16} />Nueva incidencia</button>
              <button className="button primary" onClick={() => setAddingCustomer(true)}><Plus size={17} />Nuevo cliente</button>
            </div>
          </section>

          {view === "dashboard" && <>
            <section className="metrics-grid">
              <Metric label="Por contactar" value={pending} detail={`${late} requieren atención hoy`} icon={Phone} tone="red" />
              <Metric label="Cumplimiento" value={`${Math.min(compliance, 100)}%`} detail="Contactos realizados a tiempo" icon={Gauge} tone="green" />
              <Metric label="Incidencias abiertas" value={incidents} detail="Requieren responsable y solución" icon={AlertTriangle} tone="amber" />
              <Metric label="Clientes activos" value={customerCount} detail={`${cases.length} vehículos registrados`} icon={UserRound} />
            </section>

            <section className="dashboard-grid">
              <article className="panel work-panel">
                <div className="panel-head"><div><span className="panel-kicker">BANDEJA DEL DÍA</span><h2>Prioridad de contacto</h2></div><button className="text-button" onClick={() => setView("seguimiento")}>Ver todos <ChevronRight size={15} /></button></div>
                <div className="work-list">
                  {cases.slice().sort((a, b) => (getNext(a)?.dueDate ?? "").localeCompare(getNext(b)?.dueDate ?? "")).slice(0, 5).map((item) => {
                    const next = getNext(item); const isLate = next && !next.completedAt && next.dueDate < today;
                    return <button className="work-row" key={item.id} onClick={() => setSelected(item)}>
                      <div className={`priority-marker priority-${item.priority}`} />
                      <div className="customer-avatar">{item.customer.split(" ").slice(0, 2).map((word) => word[0]).join("")}</div>
                      <div className="work-person"><strong>{item.customer}</strong><span>{item.vehicle} · {item.agency}</span></div>
                      <RouteRail item={item} compact />
                      <div className={`due-copy ${isLate ? "late" : ""}`}><strong>{next?.completedAt ? "Ciclo al día" : isLate ? "Vencido" : "Próximo"}</strong><span>{next ? prettyDate(next.dueDate) : "—"}</span></div>
                      <ChevronRight className="row-chevron" size={17} />
                    </button>;
                  })}
                </div>
              </article>

              <article className="panel pulse-panel">
                <div className="panel-head"><div><span className="panel-kicker">RED CLEBER</span><h2>Cumplimiento por agencia</h2></div><button className="icon-plain"><MoreHorizontal size={19} /></button></div>
                <div className="chart-wrap"><ResponsiveContainer width="100%" height={215}><BarChart data={chartData} margin={{ top: 16, right: 0, left: -28, bottom: 0 }}><CartesianGrid vertical={false} stroke="#edf0f2" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#697077", fontSize: 10 }} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#9aa0a6", fontSize: 10 }} /><Tooltip cursor={{ fill: "#f5f6f7" }} contentStyle={{ border: "1px solid #e1e4e7", borderRadius: 8, boxShadow: "0 8px 22px rgba(0,0,0,.08)", fontSize: 12 }} formatter={(value) => [`${value}%`, "Cumplimiento"]} /><Bar dataKey="value" radius={[5, 5, 0, 0]} barSize={24}>{chartData.map((entry) => <Cell key={entry.name} fill={entry.value < 50 ? "#d21f2b" : "#20252a"} />)}</Bar></BarChart></ResponsiveContainer></div>
                <div className="chart-note"><Sparkles size={15} /><span><strong>Oportunidad:</strong> priorizar llamadas vencidas antes de las 13:00.</span></div>
              </article>
            </section>
          </>}

          <section className={`panel table-panel ${view === "dashboard" ? "dashboard-table" : ""}`}>
            <div className="table-toolbar">
              <div><span className="panel-kicker">{view === "dashboard" ? "ACTIVIDAD RECIENTE" : view === "clientes" ? "DIRECTORIO" : "EXPEDIENTES"}</span><h2>{view === "dashboard" ? "Últimos seguimientos" : view === "incidencias" ? "Quejas por resolver" : view === "clientes" ? "Clientes y vehículos" : "Control de seguimiento"}</h2></div>
              <div className="filters"><label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cliente, VIN o teléfono" /></label>{view !== "clientes" && <><label className="select-box"><select value={agency} onChange={(event) => setAgency(event.target.value)}>{agencies.map((name) => <option key={name}>{name}</option>)}</select><ChevronDown size={14} /></label><label className="select-box"><select value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos los estados</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><SlidersHorizontal size={14} /></label></>}<button className="icon-button bordered" onClick={exportCsv} title="Exportar CSV"><Download size={17} /></button></div>
            </div>
            <div className="table-scroll">
              {view === "clientes" ? <table className="customers-table"><thead><tr><th>Cliente</th><th>Contacto</th><th>Agencias</th><th>Vehículos registrados</th><th>VIN / modelo</th><th /></tr></thead><tbody>
                {customers.map((customer) => <tr key={customer.key} onClick={() => setEditingCustomer(customer)}><td><div className="table-person"><strong>{customer.name}</strong><span>{customer.cases.length} {customer.cases.length === 1 ? "vehículo" : "vehículos"}</span></div></td><td><strong className="cell-strong">{customer.phone || "Sin teléfono"}</strong><span className="cell-sub">{customer.email || "Sin correo"}</span></td><td><div className="agency-stack">{Array.from(new Set(customer.cases.map((item) => item.agency))).map((name) => <span key={name}>{name}</span>)}</div></td><td>{customer.cases.length === 1 ? <VehiclePhoto model={customer.cases[0].vehicle} status={customer.cases[0].status} compact /> : <div className="vehicle-count"><CarFront size={16} /><strong>{customer.cases.length}</strong></div>}</td><td><div className="vin-stack">{customer.cases.slice(0, 3).map((item) => <span key={item.id}><strong>{item.vehicle || "Modelo sin registrar"}</strong><small>{item.vin}</small></span>)}{customer.cases.length > 3 && <em>+{customer.cases.length - 3} más</em>}</div></td><td><button className="edit-customer-button" onClick={(event) => { event.stopPropagation(); setEditingCustomer(customer); }} title="Editar cliente"><Pencil size={14} /></button></td></tr>)}
                {customers.length === 0 && <tr><td colSpan={6}><div className="empty"><Search size={22} /><strong>Sin clientes</strong><span>Cambia la búsqueda o registra un cliente nuevo.</span></div></td></tr>}
              </tbody></table> : <table><thead><tr><th>Cliente</th><th>Agencia</th><th>Modelo del vehículo</th><th>VIN</th><th>Ruta de seguimiento</th><th>Próximo contacto</th><th>Estado</th><th>Agente</th><th /></tr></thead><tbody>
                {filtered.slice(0, view === "dashboard" ? 5 : 100).map((item) => { const next = getNext(item); return <tr key={item.id} onClick={() => setSelected(item)}><td><div className="table-person"><strong>{item.customer}</strong><span>{item.phone || "Sin teléfono"} · {item.id}</span></div></td><td><strong className="cell-strong">{item.agency}</strong></td><td><strong className="vehicle-model">{item.vehicle || "Modelo sin registrar"}</strong></td><td><span className="vin-code">{item.vin}</span></td><td><RouteRail item={item} compact /></td><td><strong className={next && !next.completedAt && next.dueDate < today ? "date-late" : "cell-strong"}>{next ? prettyDate(next.dueDate) : "—"}</strong><span className="cell-sub">{next ? stageLabel(next.stage) : "Ciclo completo"}</span></td><td><Badge status={item.status} /></td><td><div className="agent-chip">{item.bdcAgent ? item.bdcAgent[0] : "—"}</div><span className="agent-name">{item.bdcAgent || "Sin asignar"}</span></td><td><ChevronRight size={16} className="row-chevron" /></td></tr>; })}
                {filtered.length === 0 && <tr><td colSpan={9}><div className="empty"><Search size={22} /><strong>Sin resultados</strong><span>Prueba con otros filtros o importa un archivo.</span></div></td></tr>}
              </tbody></table>}
            </div>
          </section>
        </div>
      </main>

      {selected && <CaseDrawer item={selected} onClose={() => setSelected(null)} onRecord={() => setRecording(selected)} />}
      {recording && <RecordModal item={recording} onClose={() => setRecording(null)} onSave={completeTouch} />}
      {addingCustomer && <CustomerModal onClose={() => setAddingCustomer(false)} onSave={addCustomer} />}
      {addingIncident && <IncidentModal cases={indexedVehicles} onClose={() => setAddingIncident(false)} onSave={addIncident} />}
      {editingCustomer && <CustomerEditModal customer={editingCustomer} onClose={() => setEditingCustomer(null)} onSave={editCustomer} onSaveVehicle={(payload) => saveCustomerVehicle(editingCustomer, payload)} />}
      {notice && <div className="toast"><Check size={16} /><span>{notice}</span></div>}
    </div>
  );
}

function CaseDrawer({ item, onClose, onRecord }: { item: FollowUpCase; onClose: () => void; onRecord: () => void }) {
  const next = getNext(item);
  return <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="drawer">
    <div className="drawer-head"><div><span className="panel-kicker">EXPEDIENTE {item.id}</span><h2>{item.customer}</h2><Badge status={item.status} /></div><button className="icon-button bordered" onClick={onClose}><X size={18} /></button></div>
    <div className="drawer-body">
      <section className="vehicle-plate"><span>{item.vehicle || "Vehículo BYD"}</span><strong>{item.vin}</strong><small>{item.agency} · {item.source === "entrega" ? "Post entrega" : "Post servicio"}</small></section>
      <section className="contact-grid"><div><Phone size={16} /><span>Teléfono</span><strong>{item.phone || "No registrado"}</strong></div><div><UserRound size={16} /><span>Asesor</span><strong>{item.advisor || "No asignado"}</strong></div></section>
      <section className="drawer-section"><div className="section-title"><CalendarDays size={17} /><h3>Ruta de seguimiento</h3></div><RouteRail item={item} />{item.touchpoints.map((point) => point.note && <div className="history-note" key={String(point.stage)}><span>{stageLabel(point.stage)} · {point.completedAt ? prettyDate(point.completedAt) : prettyDate(point.dueDate)}</span><p>{point.note}</p></div>)}</section>
      {(item.complaint || item.solution) && <section className="issue-card"><div className="section-title"><AlertTriangle size={17} /><h3>Incidencia</h3></div>{item.complaint && <p>{item.complaint}</p>}{(item.incidentOwner || item.incidentDueDate) && <div className="incident-meta"><span><strong>Responsable</strong>{item.incidentOwner || "Sin asignar"}</span><span><strong>Fecha compromiso</strong>{item.incidentDueDate ? prettyDate(item.incidentDueDate) : "Sin fecha"}</span></div>}{item.solution && <div className="solution"><Check size={15} /><span>{item.solution}</span></div>}</section>}
    </div>
    <div className="drawer-foot"><div><span>Próximo contacto</span><strong>{next && !next.completedAt ? `${stageLabel(next.stage)} · ${prettyDate(next.dueDate)}` : "Ciclo al día"}</strong></div><button className="button primary" onClick={onRecord} disabled={!next || Boolean(next.completedAt)}><Phone size={16} />Registrar contacto</button></div>
  </aside></div>;
}

function RecordModal({ item, onClose, onSave }: { item: FollowUpCase; onClose: () => void; onSave: (item: FollowUpCase, result: string, note: string, complaint: boolean) => void }) {
  const [result, setResult] = useState("Contactado"); const [note, setNote] = useState(""); const [complaint, setComplaint] = useState(false); const next = getNext(item);
  return <div className="overlay modal-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="modal" onSubmit={(event) => { event.preventDefault(); onSave(item, result, note, complaint); }}>
    <div className="modal-head"><div><span className="panel-kicker">{next ? stageLabel(next.stage) : "CONTACTO"}</span><h2>Registrar seguimiento</h2><p>{item.customer} · {item.phone}</p></div><button type="button" className="icon-button bordered" onClick={onClose}><X size={18} /></button></div>
    <label className="field"><span>Resultado de la llamada</span><select value={result} onChange={(event) => setResult(event.target.value)}><option>Contactado</option><option>No localizado</option><option>Buzón</option><option>Mensaje enviado</option><option>Cliente satisfecho</option></select></label>
    <label className="field"><span>Notas del contacto</span><textarea required value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe brevemente lo que comentó el cliente y el siguiente paso…" /></label>
    <label className="check-field"><input type="checkbox" checked={complaint} onChange={(event) => setComplaint(event.target.checked)} /><span><strong>El cliente reportó una queja</strong><small>Se abrirá una incidencia con prioridad alta.</small></span></label>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary"><Check size={16} />Guardar seguimiento</button></div>
  </form></div>;
}

function CustomerModal({ onClose, onSave }: { onClose: () => void; onSave: (payload: NewCustomerPayload) => void }) {
  const [form, setForm] = useState<Omit<NewCustomerPayload, "vehicles">>({ customer: "", phone: "", email: "", agency: "San Pedro", advisor: "", bdcAgent: "", source: "entrega", referenceDate: today });
  const [vehicles, setVehicles] = useState([{ vin: "", model: "" }]);
  const updateVehicle = (index: number, field: "vin" | "model", value: string) => setVehicles((current) => current.map((vehicle, position) => position === index ? { ...vehicle, [field]: value } : vehicle));
  return <div className="overlay modal-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="modal wide-modal" onSubmit={(event) => { event.preventDefault(); onSave({ ...form, vehicles: vehicles.filter((vehicle) => vehicle.vin.trim() && vehicle.model.trim()) }); }}>
    <div className="modal-head"><div><span className="panel-kicker">ALTA MANUAL</span><h2>Nuevo cliente</h2><p>Registra al cliente y todos sus vehículos, sin depender de un Excel.</p></div><button type="button" className="icon-button bordered" onClick={onClose}><X size={18} /></button></div>
    <div className="form-grid">
      <label className="field"><span>Nombre completo *</span><input required value={form.customer} onChange={(event) => setForm({ ...form, customer: event.target.value })} placeholder="Nombre del cliente" /></label>
      <label className="field"><span>Teléfono *</span><input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="81 1234 5678" /></label>
      <label className="field"><span>Correo</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="cliente@correo.com" /></label>
      <label className="field"><span>Agencia *</span><select required value={form.agency} onChange={(event) => setForm({ ...form, agency: event.target.value })}>{canonicalAgencies.map((name) => <option key={name}>{name}</option>)}</select></label>
      <label className="field"><span>Asesor de venta/servicio</span><input value={form.advisor} onChange={(event) => setForm({ ...form, advisor: event.target.value })} placeholder="Nombre del asesor" /></label>
      <label className="field"><span>Agente BDC</span><input value={form.bdcAgent} onChange={(event) => setForm({ ...form, bdcAgent: event.target.value })} placeholder="Responsable de seguimiento" /></label>
      <label className="field"><span>Tipo de seguimiento *</span><select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as "entrega" | "servicio" })}><option value="entrega">Post entrega · 7, 15 y 28 días</option><option value="servicio">Post servicio · NPS</option></select></label>
      <label className="field"><span>Fecha de {form.source === "entrega" ? "entrega" : "servicio"} *</span><input type="date" required value={form.referenceDate} onChange={(event) => setForm({ ...form, referenceDate: event.target.value })} /></label>
    </div>
    <section className="vehicles-editor"><div className="vehicles-title"><div><CarFront size={17} /><span><strong>Vehículos del cliente</strong><small>El modelo es obligatorio para cada VIN.</small></span></div><button type="button" className="text-button add-vehicle" onClick={() => setVehicles([...vehicles, { vin: "", model: "" }])}><Plus size={14} />Agregar vehículo</button></div>
      {vehicles.map((vehicle, index) => <div className="vehicle-row" key={index}><span className="vehicle-index">{index + 1}</span><label className="field"><span>VIN *</span><input required value={vehicle.vin} onChange={(event) => updateVehicle(index, "vin", event.target.value.toUpperCase())} placeholder="VIN de 17 caracteres" maxLength={24} /></label><label className="field"><span>Modelo del vehículo *</span><input required value={vehicle.model} onChange={(event) => updateVehicle(index, "model", event.target.value)} placeholder="Ej. Song Plus DM-i" /></label>{vehicles.length > 1 && <button type="button" className="remove-vehicle" onClick={() => setVehicles(vehicles.filter((_, position) => position !== index))} aria-label="Quitar vehículo"><X size={16} /></button>}</div>)}
    </section>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary"><Check size={16} />Guardar cliente</button></div>
  </form></div>;
}

function CustomerEditModal({ customer, onClose, onSave, onSaveVehicle }: { customer: CustomerGroup; onClose: () => void; onSave: (payload: EditCustomerPayload) => void; onSaveVehicle: (payload: VehicleModalPayload) => void }) {
  const [form, setForm] = useState({ customer: customer.name, phone: customer.phone, email: customer.email || "" });
  const [vehicleModal, setVehicleModal] = useState<{ mode: "new" | "edit"; item?: FollowUpCase } | null>(null);
  const vehicleRefs = customer.cases.map((item) => ({ caseId: item.id, vin: item.vin, model: item.vehicle }));
  return <><div className="overlay modal-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="modal vehicles-modal" onSubmit={(event) => { event.preventDefault(); onSave({ ...form, vehicles: vehicleRefs }); }}>
    <div className="modal-head"><div><span className="panel-kicker">DIRECTORIO MAESTRO</span><h2>Editar cliente</h2><p>Actualiza sus datos y los vehículos vinculados sin alterar los seguimientos históricos.</p></div><button type="button" className="icon-button bordered" onClick={onClose}><X size={18} /></button></div>
    <div className="form-grid">
      <label className="field"><span>Nombre completo *</span><input required value={form.customer} onChange={(event) => setForm({ ...form, customer: event.target.value })} /></label>
      <label className="field"><span>Teléfono</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
      <label className="field field-full"><span>Correo</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
    </div>
    <section className="vehicle-detail-section"><div className="vehicles-title"><div><CarFront size={17} /><span><strong>Vehículos registrados</strong><small>Un registro único por cada combinación cliente + VIN.</small></span></div><button type="button" className="button vehicle-add-button" onClick={() => setVehicleModal({ mode: "new" })}><Plus size={15} />Agregar vehículo</button></div>
      <div className="vehicle-card-grid">{customer.cases.map((item) => <article className="vehicle-card" key={item.id}><VehiclePhoto model={item.vehicle} status={item.status} /><div className="vehicle-card-copy"><strong className="vehicle-card-model">{item.vehicle || "Modelo sin registrar"}</strong><span className="vehicle-card-vin">{item.vin}</span><div className="vehicle-card-meta"><span>{item.agency}</span><span>{item.source === "entrega" ? "Post entrega" : "Post servicio"}</span></div><button type="button" onClick={() => setVehicleModal({ mode: "edit", item })}><Pencil size={13} />Editar vehículo</button></div></article>)}</div>
    </section>
    <div className="edit-note"><ShieldCheck size={15} /><span>Los contactos e incidencias anteriores permanecerán vinculados al vehículo.</span></div>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary"><Check size={16} />Guardar cambios</button></div>
  </form></div>{vehicleModal && <VehicleEditorModal mode={vehicleModal.mode} item={vehicleModal.item} defaultAgency={customer.cases[0]?.agency || "San Pedro"} onClose={() => setVehicleModal(null)} onSave={onSaveVehicle} />}</>;
}

function VehicleEditorModal({ mode, item, defaultAgency, onClose, onSave }: { mode: "new" | "edit"; item?: FollowUpCase; defaultAgency: string; onClose: () => void; onSave: (payload: VehicleModalPayload) => void }) {
  const [form, setForm] = useState<VehicleModalPayload>({ mode, caseId: item?.id, vin: item?.vin || "", model: item?.vehicle || "", agency: item?.agency || defaultAgency, source: item?.source || "entrega", referenceDate: item?.referenceDate || today, advisor: item?.advisor || "", bdcAgent: item?.bdcAgent || "" });
  return <div className="overlay modal-layer vehicle-editor-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="modal vehicle-editor-modal" onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
    <div className="modal-head"><div><span className="panel-kicker">{mode === "new" ? "NUEVA UNIDAD" : "VEHÍCULO REGISTRADO"}</span><h2>{mode === "new" ? "Agregar vehículo" : "Editar vehículo"}</h2><p>{mode === "new" ? "El nuevo VIN quedará vinculado a este cliente." : "La corrección se reflejará en todos sus seguimientos."}</p></div><button type="button" className="icon-button bordered" onClick={onClose}><X size={18} /></button></div>
    <div className="vehicle-form-identity"><CarFront size={22} /><span><strong>{form.model || "Modelo BYD"}</strong><small>{form.vin || "VIN pendiente"}</small></span></div>
    <div className="form-grid"><label className="field"><span>VIN *</span><input required value={form.vin} onChange={(event) => setForm({ ...form, vin: event.target.value.toUpperCase() })} placeholder="VIN de la unidad" /></label><label className="field"><span>Modelo del vehículo *</span><input required value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="Ej. Song Plus DM-i" /></label></div>
    {mode === "new" && <><div className="form-grid"><label className="field"><span>Agencia *</span><select value={form.agency} onChange={(event) => setForm({ ...form, agency: event.target.value })}>{canonicalAgencies.map((name) => <option key={name}>{name}</option>)}</select></label><label className="field"><span>Seguimiento *</span><select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as "entrega" | "servicio" })}><option value="entrega">Post entrega · 7, 15 y 28 días</option><option value="servicio">Post servicio · NPS</option></select></label><label className="field"><span>Fecha de referencia *</span><input required type="date" value={form.referenceDate} onChange={(event) => setForm({ ...form, referenceDate: event.target.value })} /></label><label className="field"><span>Agente BDC</span><input value={form.bdcAgent} onChange={(event) => setForm({ ...form, bdcAgent: event.target.value })} /></label></div><label className="field"><span>Asesor de venta/servicio</span><input value={form.advisor} onChange={(event) => setForm({ ...form, advisor: event.target.value })} /></label></>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary"><Check size={16} />{mode === "new" ? "Agregar vehículo" : "Guardar vehículo"}</button></div>
  </form></div>;
}

function IncidentModal({ cases, onClose, onSave }: { cases: FollowUpCase[]; onClose: () => void; onSave: (caseId: string, description: string, owner: string, dueDate: string, priority: FollowUpCase["priority"]) => void }) {
  const [caseId, setCaseId] = useState(""); const [customerSearch, setCustomerSearch] = useState("");
  const [description, setDescription] = useState(""); const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState(today); const [priority, setPriority] = useState<FollowUpCase["priority"]>("alta");
  const chosen = cases.find((item) => item.id === caseId);
  const normalizedSearch = customerSearch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const matches = normalizedSearch.length < 2 ? [] : cases.filter((item) => `${item.customer} ${item.phone} ${item.vin} ${item.vehicle} ${item.agency}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalizedSearch)).slice(0, 30);
  return <div className="overlay modal-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="modal" onSubmit={(event) => { event.preventDefault(); onSave(caseId, description, owner, dueDate, priority); }}>
    <div className="modal-head"><div><span className="panel-kicker">ALTA MANUAL</span><h2>Nueva incidencia</h2><p>Asocia la queja a un cliente y a un VIN específico.</p></div><button type="button" className="icon-button bordered" onClick={onClose}><X size={18} /></button></div>
    {cases.length ? <>
      <div className="field"><span>Buscar cliente o vehículo *</span><div className="incident-search"><Search size={16} /><input autoFocus value={customerSearch} onChange={(event) => { setCustomerSearch(event.target.value); setCaseId(""); }} placeholder="Nombre, teléfono, VIN o modelo…" /></div></div>
      {!chosen && <div className="incident-results">
        {normalizedSearch.length < 2 ? <div className="search-guidance">Escribe al menos 2 caracteres para buscar.</div> : matches.length ? matches.map((item) => <button type="button" key={item.id} onClick={() => { setCaseId(item.id); setCustomerSearch(item.customer); }}><div className="result-avatar">{item.customer.split(" ").slice(0, 2).map((word) => word[0]).join("")}</div><span><strong>{item.customer}</strong><small>{item.phone || "Sin teléfono"} · {item.agency}</small></span><span className="result-vehicle"><strong>{item.vehicle || "Modelo sin registrar"}</strong><small>{item.vin}</small></span><ChevronRight size={15} /></button>) : <div className="search-guidance">No encontramos clientes con esa búsqueda.</div>}
        {matches.length === 30 && <div className="search-limit">Mostrando los primeros 30 resultados. Agrega teléfono o VIN para precisar.</div>}
      </div>}
      {chosen && <div className="incident-vehicle"><CarFront size={18} /><span><strong>{chosen.vehicle || "Modelo sin registrar"}</strong><small>{chosen.agency} · {chosen.vin}</small></span></div>}
      <label className="field"><span>Descripción de la incidencia *</span><textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="¿Qué reportó el cliente y qué necesita resolver?" /></label>
      <div className="form-grid"><label className="field"><span>Responsable *</span><input required value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Nombre del responsable" /></label><label className="field"><span>Fecha compromiso *</span><input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label></div>
      <label className="field"><span>Prioridad</span><select value={priority} onChange={(event) => setPriority(event.target.value as FollowUpCase["priority"])}><option value="alta">Alta</option><option value="media">Media</option><option value="normal">Normal</option></select></label>
    </> : <div className="empty"><Users size={24} /><strong>Primero registra un cliente</strong><span>La incidencia necesita un cliente y un vehículo asociados.</span></div>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={!cases.length || !chosen}><AlertTriangle size={16} />Crear incidencia</button></div>
  </form></div>;
}
