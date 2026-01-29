export const MEASUREMENT_UNITS = [
  "KG",
  "KGS",
  "G",
  "GM",
  "GMS",
  "GRAM",
  "GRAMS",
  "ML",
  "L",
  "LTR",
  "LTRS",
  "LITRE",
  "LITRES",
];

export function isMeasurementUnit(unit) {
  if (!unit) return false;
  const normalized = unit.toString().trim().toUpperCase();
  return MEASUREMENT_UNITS.includes(normalized);
}


