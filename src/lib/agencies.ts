const agencyAliases: Array<[RegExp, string]> = [
  [/^(byd\s*)?(carretera\s*nacional|carretera)$/i, "Carretera Nacional"],
  [/^(byd\s*)?(chihuahua|cuu)$/i, "Chihuahua"],
  [/^(byd\s*)?linda\s*vista$/i, "Linda Vista"],
  [/^(byd\s*)?ju[aá]rez$/i, "Juárez"],
  [/^(byd\s*)?san\s*pedro$/i, "San Pedro"],
];

export const canonicalAgencies = ["Carretera Nacional", "Chihuahua", "Linda Vista", "Juárez", "San Pedro"];

export function canonicalAgency(value: string) {
  const normalized = value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (/^formato$/i.test(normalized)) return "Sin agencia";
  return agencyAliases.find(([pattern]) => pattern.test(normalized))?.[1] ?? (normalized || "Sin agencia");
}
