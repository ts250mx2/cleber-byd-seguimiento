import type { FollowUpCase } from "./types";

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toUpperCase()
  .replace(/\b(S\.?A\.?\s+DE\s+C\.?V\.?|S\.?\s+DE\s+R\.?L\.?\s+DE\s+C\.?V\.?)\b/g, "")
  .replace(/[^A-Z0-9]/g, "");

export const customerNameKey = (name: string) => normalize(name);
export const vinKey = (vin: string) => normalize(vin);

export function customerVinKey(item: Pick<FollowUpCase, "customer" | "vin" | "id">) {
  const vin = vinKey(item.vin);
  const validVin = vin && vin !== "SINVIN";
  return validVin ? `${customerNameKey(item.customer)}|${vin}` : `${customerNameKey(item.customer)}|SINVIN|${item.id}`;
}

function informationScore(item: FollowUpCase) {
  return [item.phone, item.email, item.vehicle, item.vin, item.advisor, item.bdcAgent, item.complaint, item.solution].filter(Boolean).length;
}

/** Builds the customer-vehicle master index without deleting historical follow-ups. */
export function indexCasesByCustomerVin(cases: FollowUpCase[]) {
  const index = new Map<string, FollowUpCase>();
  cases.forEach((item) => {
    const key = customerVinKey(item);
    const current = index.get(key);
    if (!current || informationScore(item) > informationScore(current) || (informationScore(item) === informationScore(current) && item.referenceDate > current.referenceDate)) {
      index.set(key, item);
    }
  });
  return Array.from(index.values());
}
