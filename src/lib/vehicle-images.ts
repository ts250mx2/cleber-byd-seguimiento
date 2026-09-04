type VehicleImage = {
  src: string;
  family: string;
};

const normalizeModel = (model: string) => model
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, " ")
  .trim();

export function vehicleImageFor(model: string): VehicleImage | null {
  const value = normalizeModel(model);

  if (!value) return null;
  if (value.includes("SEALION 7") || value.includes("SEA LION 7") || value.includes("SELION 7") || value.includes("SELAION")) return { src: "/vehicles/sealion-7.webp", family: "SEALION 7" };
  if (value.includes("DOLPHIN MINI") || value.includes("DOLPHIMINI") || value === "MINI" || value.startsWith("MINI ")) return { src: "/vehicles/dolphin-mini.webp", family: "DOLPHIN MINI" };
  if (value.includes("SONG PLUS") || value.includes("SONG PLU") || value.includes("SONGPLUS") || value.includes("SON PLUS")) return { src: "/vehicles/song-plus.png", family: "SONG PLUS" };
  if (value.includes("SONG PRO") || value.includes("SONGPRO")) return { src: "/vehicles/song-pro.png", family: "SONG PRO" };
  if ((value.includes("YUAN PRO") || value.includes("YUANPRO")) && value.includes("DM")) return { src: "/vehicles/yuan-pro-dmi.webp", family: "YUAN PRO DM-i" };
  if (value.includes("YUAN PRO") || value.includes("YUANPRO")) return { src: "/vehicles/yuan-pro.png", family: "YUAN PRO" };
  if (value.includes("ATTO 8") || value.includes("ATTO8")) return { src: "/vehicles/atto-8.webp", family: "ATTO 8" };
  if (value.includes("SHARK")) return { src: "/vehicles/shark.png", family: "SHARK" };
  if (value.includes("KING")) return { src: "/vehicles/king.webp", family: "KING" };
  if (/\bM9\b/.test(value)) return { src: "/vehicles/m9.png", family: "M9" };
  if (value.includes("SEAL") && !value.includes("SEALION")) return { src: "/vehicles/seal.png", family: "SEAL" };

  return null;
}
