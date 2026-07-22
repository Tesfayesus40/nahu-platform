/** Report type registry — domains add exporters without a warehouse. */
export const REPORT_TYPES = [
  'orders.summary',
  'delivery.exceptions',
  'audit.events',
  'verification.pending',
  'listings.moderation',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export function isKnownReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

export function reportTypeLabel(type: string): string {
  switch (type) {
    case 'orders.summary':
      return 'Orders summary';
    case 'delivery.exceptions':
      return 'Delivery exceptions';
    case 'audit.events':
      return 'Audit events';
    case 'verification.pending':
      return 'Pending verifications';
    case 'listings.moderation':
      return 'Listing moderation';
    default:
      return type;
  }
}

export function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(
  header: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(row.map((c) => csvEscape(c == null ? '' : String(c))).join(','));
  }
  return lines.join('\n');
}
