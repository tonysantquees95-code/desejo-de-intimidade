export type ShippingRegion =
  | "sudeste"
  | "sul"
  | "centro_oeste"
  | "nordeste"
  | "norte";

export const shippingRegions: { id: ShippingRegion; label: string }[] = [
  { id: "sudeste", label: "Sudeste (SP, RJ, MG, ES)" },
  { id: "sul", label: "Sul (PR, SC, RS)" },
  { id: "centro_oeste", label: "Centro-Oeste (DF, GO, MT, MS)" },
  { id: "nordeste", label: "Nordeste (BA, SE, AL, PE, PB, RN, CE, PI, MA)" },
  { id: "norte", label: "Norte (AC, AM, AP, PA, RO, RR, TO)" },
];
