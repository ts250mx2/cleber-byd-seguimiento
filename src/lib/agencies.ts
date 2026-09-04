const agencyAliases: Array<[RegExp, string]> = [
  [/^(byd\s*)?carretera\s*nacional$/i, "Carretera Nacional"],
  [/^(byd\s*)?chihuahua$/i, "Chihuahua"],
  [/^(byd\s*)?linda\s*vista$/i, "Linda Vista"],
  [/^(byd\s*)?ju[aá]rez$/i, "Juárez"],
  [/^(byd\s*)?san\s*pedro$/i, "San Pedro"],
];

export const canonicalAgencies = ["Carretera Nacional", "Chihuahua", "Linda Vista", "Juárez", "San Pedro"];

export function canonicalAgency(value: string) {
  const normalized = value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return agencyAliases.find(([pattern]) => pattern.test(normalized))?.[1] ?? (normalized || "Sin agencia");
}
