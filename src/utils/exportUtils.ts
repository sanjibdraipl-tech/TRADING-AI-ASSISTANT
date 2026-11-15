/**
 * Section 34: Export Utilities (CSV, Excel-compatible CSV with UTF-8 BOM, JSON, Printable Report)
 */

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv(
  rows: Record<string, unknown>[],
  filename: string,
  excelBom: boolean = false
) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => headers.map((h) => escapeCsvCell(r[h])).join(',')),
  ];
  const content = (excelBom ? '\uFEFF' : '') + csvLines.join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

export function exportToJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(blob, filename);
}

export function exportPrintableReport() {
  window.print();
}
