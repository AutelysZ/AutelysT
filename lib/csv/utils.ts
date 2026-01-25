import * as XLSX from "xlsx";

export type CsvFileData = {
  name: string;
  rows: string[][];
};

const INVALID_SHEET_CHARS = /[:\\/?*\[\]]/;
const EXCEL_SHEET_NAME_LIMIT = 31;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    current.push(field);
    field = "";
  };

  const pushRow = () => {
    pushField();
    rows.push(current);
    current = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      pushField();
      continue;
    }

    if (char === "\r") {
      if (text[i + 1] === "\n") i++;
      pushRow();
      continue;
    }

    if (char === "\n") {
      pushRow();
      continue;
    }

    field += char;
  }

  // Push final field/row
  pushField();
  if (current.length > 1 || current[0] !== "" || rows.length > 0) {
    rows.push(current);
  }

  return rows;
}

export function stringifyCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell = "") => {
          const needsQuote = /[",\n\r]/.test(cell);
          const escaped = cell.replace(/"/g, '""');
          return needsQuote ? `"${escaped}"` : escaped;
        })
        .join(","),
    )
    .join("\n");
}

export function stripCsvExtension(name: string): string {
  return name.toLowerCase().endsWith(".csv") ? name.slice(0, -4) : name;
}

export function isValidSheetName(name: string): boolean {
  if (!name) return false;
  if (name.length > EXCEL_SHEET_NAME_LIMIT) return false;
  return !INVALID_SHEET_CHARS.test(name);
}

export function worksheetToRows(sheet: XLSX.WorkSheet): string[][] {
  const csv = XLSX.utils.sheet_to_csv(sheet, {
    FS: ",",
    RS: "\n",
    blankrows: true,
    strip: false,
  });
  return parseCsv(csv);
}

export async function readCsvFile(file: File): Promise<CsvFileData> {
  const text = await file.text();
  return {
    name: file.name,
    rows: parseCsv(text),
  };
}

export async function readExcelFile(file: File): Promise<CsvFileData[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellText: true,
    cellDates: false,
  });

  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const name = `${sheetName}.csv`;
    return {
      name,
      rows: worksheetToRows(sheet),
    };
  });
}

export function rowsToWorksheet(rows: string[][]): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet(rows, { sheetStubs: true });

  // Force all cells to be text to avoid implicit conversions
  Object.keys(sheet).forEach((cellKey) => {
    if (cellKey.startsWith("!")) return;
    const cell = sheet[cellKey];
    const value = cell?.v ?? "";
    sheet[cellKey] = {
      t: "s",
      v: String(value),
      w: String(value),
    } as XLSX.CellObject;
  });

  return sheet;
}
