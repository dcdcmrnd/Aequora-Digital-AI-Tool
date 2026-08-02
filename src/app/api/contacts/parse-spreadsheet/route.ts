import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Papa from "papaparse";
import ExcelJS from "exceljs";

import { authOptions } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 5000;

async function parseCsv(buffer: Buffer): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const text = buffer.toString("utf-8");
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const headers = result.meta.fields ?? [];
  return { headers, rows: result.data.slice(0, MAX_ROWS) };
}

async function parseExcel(buffer: Buffer): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "").trim();
  });

  const rows: Record<string, string>[] = [];
  for (let i = 2; i <= sheet.rowCount && rows.length < MAX_ROWS; i++) {
    const row = sheet.getRow(i);
    if (row.cellCount === 0) continue;
    const obj: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, idx) => {
      if (!header) return;
      const cell = row.getCell(idx + 1);
      const value = cell.value;
      const text = value === null || value === undefined ? "" : typeof value === "object" && "text" in (value as object) ? String((value as { text: unknown }).text) : String(value);
      obj[header] = text.trim();
      if (obj[header]) hasValue = true;
    });
    if (hasValue) rows.push(obj);
  }

  return { headers: headers.filter(Boolean), rows };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = session.user.role === "admin" || (await checkPermission(session.user.id, "contacts.manage"));
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 10MB)." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  try {
    const parsed = name.endsWith(".csv") ? await parseCsv(buffer) : await parseExcel(buffer);
    if (parsed.headers.length === 0) {
      return NextResponse.json({ error: "Couldn't find any columns in this file." }, { status: 400 });
    }
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Couldn't read this file. Make sure it's a valid .xlsx, .xls, or .csv." }, { status: 400 });
  }
}
