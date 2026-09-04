export type Stage = 7 | 15 | 28 | "nps";
export type CaseStatus = "pendiente" | "contactado" | "incidencia" | "resuelto" | "no-localizado";

export type Touchpoint = {
  stage: Stage;
  dueDate: string;
  completedAt?: string;
  result?: string;
  note?: string;
};

export type FollowUpCase = {
  id: string;
  customer: string;
  phone: string;
  email?: string;
  agency: string;
  vehicle: string;
  vin: string;
  advisor: string;
  bdcAgent: string;
  source: "entrega" | "servicio";
  referenceDate: string;
  status: CaseStatus;
  priority: "alta" | "media" | "normal";
  complaint?: string;
  solution?: string;
  incidentOwner?: string;
  incidentDueDate?: string;
  touchpoints: Touchpoint[];
};
