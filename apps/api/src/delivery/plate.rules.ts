/**
 * Ethiopian vehicle plate helpers.
 * Accepts common formats such as AA-12345, OR-1-23456, ET-1234.
 */
export function normalizePlateNumber(raw: unknown): string {
  if (raw == null) return '';
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/-+/g, '-');
}

const PLATE_RE = /^[A-Z0-9]{1,4}(-[A-Z0-9]{1,6}){0,3}$/;

export function isValidEthiopianPlate(raw: unknown): boolean {
  const plate = normalizePlateNumber(raw);
  if (!plate || plate.length < 3 || plate.length > 20) return false;
  if (!PLATE_RE.test(plate)) return false;
  if (!/\d/.test(plate)) return false;
  return true;
}
