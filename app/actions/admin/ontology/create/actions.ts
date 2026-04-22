/* eslint-disable @typescript-eslint/no-explicit-any */

"use server";

import { pgPool } from "@/lib/db";
import { setCurrentUserOnConnection } from "@/lib/safe-session";
import * as XLSX from "xlsx";
import {
  listTablesInSchema,
  validateSheetColumns,
  insertSheetData,
} from "@/lib/db";
import {
  logError,
  getUserFriendlyMessage,
  isSecurityCritical,
} from "@/lib/error-logger";
import { getUserEmailFromSession } from "@/utils/auth/get-user-server-session";
import { validateExcelUpload } from "@/lib/upload-validation";

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

const HEADER_EXCEPTIONS: Record<string, string> = {
  codesystem: "code_system",
};

function snake(header: string) {
  const base = header
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .toLowerCase();
  return HEADER_EXCEPTIONS[base] ?? base;
}

const DROP_COLUMNS: Record<string, string[]> = {
  organisations: ["country_code"],
};

const RELATIONSHIP_COLUMNS: Record<string, Record<string, string>> = {
  organisations: {
    type: "organisation_types",
    country: "countries",
  },
  storage_temperatures: {
    biospecimen_type: "biospecimen_types",
  },
  participant_identifiers: {
    clinical_site: "organisations",
  },
};

const PRIORITY_TABLES = ["countries", "organisation_types", "biospecimen_types"];

export async function getOntologyTableStatuses(): Promise<{
  tables: { name: string; isEmpty: boolean; schema: string }[];
}> {
  const client = await pgPool.connect();
  try {
    const statuses: { name: string; isEmpty: boolean; schema: string }[] = [];
    for (const schema of ["imdhub_refs", "imdhub_core"]) {
      const tables = await listTablesInSchema(schema);
      for (const t of tables) {
        const { rows } = await client.query<{ exists: boolean }>(
          `SELECT EXISTS (SELECT 1 FROM ${q(schema)}.${q(t)} LIMIT 1) AS exists`
        );
        statuses.push({ name: t, isEmpty: !rows[0].exists, schema });
      }
    }
    return { tables: statuses };
  } finally {
    client.release();
  }
}

export async function submitOntologyExcelSheet(
  formData: FormData
): Promise<{ success: boolean; message: string }> {
  const client = await pgPool.connect();
  await client.query("BEGIN");

  try {
    // Set user session for audit logging
    const [user_email] = await getUserEmailFromSession();
    const me = user_email || "imdhub-system";
    await setCurrentUserOnConnection(client, me);

    //Load workbook and normalize headers
    const file = formData.get("file") as File | null;
    validateExcelUpload(file);

    // Optional: target a single table instead of bulk upload
    const targetTable = (formData.get("targetTable") as string) || null;
    const targetSchema = (formData.get("targetSchema") as string) || "imdhub_refs";

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const newSheets: Record<string, XLSX.WorkSheet> = {};
    const newNames = workbook.SheetNames.map((oldName) => {
      const normName = snake(oldName);
      const sheet = workbook.Sheets[oldName];
      const range = XLSX.utils.decode_range(sheet["!ref"]!);
      for (let col = range.s.c; col <= range.e.c; ++col) {
        const addr = XLSX.utils.encode_cell({ r: range.s.r, c: col });
        const cell = sheet[addr];
        if (cell && typeof cell.v === "string") {
          const newHdr = snake(cell.v);
          cell.v = newHdr;
          cell.w = newHdr;
        }
      }
      newSheets[normName] = sheet;
      return normName;
    });

    workbook.SheetNames = newNames;
    workbook.Sheets = newSheets;

    // Fast path: imdhub_core specific-table upload (no relationship resolution needed)
    if (targetTable && targetSchema === "imdhub_core") {
      const allSheetNames = workbook.SheetNames;
      if (!allSheetNames.includes(targetTable))
        throw new Error(`Sheet "${targetTable}" not found in the uploaded file.`);

      const coreTables = await listTablesInSchema("imdhub_core");
      if (!coreTables.includes(targetTable))
        throw new Error(`Table "${targetTable}" does not exist in imdhub_core schema.`);

      const { rows: existsRows } = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM imdhub_core.${q(targetTable)} LIMIT 1) AS exists`
      );
      if (existsRows[0].exists)
        throw new Error(`Import aborted — table "${targetTable}" already contains data.`);

      await validateSheetColumns(client, "imdhub_core", targetTable, workbook.Sheets[targetTable]);
      await insertSheetData(client, "imdhub_core", targetTable, workbook.Sheets[targetTable]);
      await client.query("COMMIT");
      return { success: true, message: `Successfully uploaded data into imdhub_core.${targetTable}.` };
    }

    // For specific-table mode, restrict to the requested sheet only
    const allSheetNames = workbook.SheetNames;
    let sheetNames: string[];
    if (targetTable) {
      if (!allSheetNames.includes(targetTable))
        throw new Error(
          `Sheet "${targetTable}" not found in the uploaded file.`
        );
      sheetNames = [targetTable];
    } else {
      sheetNames = allSheetNames;
    }

    //Check schema and emptiness ===
    const tables = await listTablesInSchema("imdhub_refs");
    const missing = sheetNames.filter((s) => !tables.includes(s));
    if (missing.length)
      throw new Error(`Missing tables in schema: ${missing.join(", ")}`);

    const nonEmpty: string[] = [];
    for (const t of sheetNames) {
      const { rows } = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM imdhub_refs.${q(t)} LIMIT 1) AS exists`
      );
      if (rows[0].exists) nonEmpty.push(t);
    }
    if (nonEmpty.length) {
      const msg = targetTable
        ? `Import aborted — table "${nonEmpty[0]}" already contains data.`
        : `Import aborted — tables already contain data:\n${nonEmpty.join(", ")}`;
      throw new Error(msg);
    }

    //Drop unwanted columns ===
    for (const [sheetName, colsToDrop] of Object.entries(DROP_COLUMNS)) {
      if (!sheetNames.includes(sheetName)) continue;
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      const header = rows[0] as string[];
      const dropIdx = header
        .map((h, i) => (colsToDrop.includes(h) ? i : -1))
        .filter((i) => i >= 0)
        .sort((a, b) => b - a);
      if (dropIdx.length) {
        for (const i of dropIdx) rows.forEach((r) => r.splice(i, 1));
        workbook.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(rows);
      }
    }

    //Insert priority lookup tables
    const prioritySet = new Set(PRIORITY_TABLES);
    const prioritySheetNames = sheetNames.filter((n) => prioritySet.has(n));
    for (const name of prioritySheetNames) {
      await insertSheetData(client, "imdhub_refs", name, workbook.Sheets[name]);
    }

    // Resolve and insert organisations
    if (sheetNames.includes("organisations")) {
      const sheet = workbook.Sheets["organisations"];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      const header = rows[0] as string[];

      for (const [colName, refTable] of Object.entries(
        RELATIONSHIP_COLUMNS["organisations"]
      )) {
        const colIdx = header.indexOf(colName);
        if (colIdx === -1) continue;
        const { rows: refRows } = await client.query(
          `SELECT id, name, definition FROM imdhub_refs.${q(refTable)} ORDER BY id`
        );
        const nameMap = new Map<string, number>();
        const defMap = new Map<string, number>();
        for (const r of refRows) {
          const n = r.name?.trim().toLowerCase();
          const d = r.definition?.trim().toLowerCase();
          if (n) nameMap.set(n, r.id);
          if (d) defMap.set(d, r.id);
        }
        for (let r = 1; r < rows.length; r++) {
          const val = rows[r][colIdx]?.toString().trim().toLowerCase();
          if (!val) continue;
          if (nameMap.has(val)) rows[r][colIdx] = nameMap.get(val)!;
          else if (defMap.has(val)) rows[r][colIdx] = defMap.get(val)!;
          else throw new Error(`Value "${rows[r][colIdx]}" not found in ${refTable}`);
        }
      }

      workbook.Sheets["organisations"] = XLSX.utils.aoa_to_sheet(rows);
      await insertSheetData(
        client,
        "imdhub_refs",
        "organisations",
        workbook.Sheets["organisations"]
      );
    }

    // Resolve and insert participant_identifiers 
    if (sheetNames.includes("participant_identifiers")) {
      const sheet = workbook.Sheets["participant_identifiers"];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      const header = rows[0] as string[];
      const colIdx = header.indexOf("clinical_site");

      if (colIdx !== -1) {
        const { rows: refRows } = await client.query(
          `SELECT id, name, definition FROM imdhub_refs.organisations ORDER BY id`
        );
        const nameMap = new Map<string, number>();
        const defMap = new Map<string, number>();
        for (const r of refRows) {
          const n = r.name?.trim().toLowerCase();
          const d = r.definition?.trim().toLowerCase();
          if (n) nameMap.set(n, r.id);
          if (d) defMap.set(d, r.id);
        }

        for (let r = 1; r < rows.length; r++) {
          const val = rows[r][colIdx]?.toString().trim().toLowerCase();
          if (!val) continue;
          if (nameMap.has(val)) rows[r][colIdx] = nameMap.get(val)!;
          else if (defMap.has(val)) rows[r][colIdx] = defMap.get(val)!;
          else
            throw new Error(
              `Value "${rows[r][colIdx]}" not found in organisations`
            );
        }
      }

      workbook.Sheets["participant_identifiers"] =
        XLSX.utils.aoa_to_sheet(rows);
      await insertSheetData(
        client,
        "imdhub_refs",
        "participant_identifiers",
        workbook.Sheets["participant_identifiers"]
      );
    }

    //Validate all sheets
    for (const s of sheetNames) {
      await validateSheetColumns(client, "imdhub_refs", s, workbook.Sheets[s]);
    }

    //Insert any remaining independent sheets
    const already = new Set([
      ...prioritySheetNames,
      "organisations",
      "participant_identifiers",
    ]);
    const otherSheets = sheetNames.filter((n) => !already.has(n));
    for (const s of otherSheets) {
      await insertSheetData(client, "imdhub_refs", s, workbook.Sheets[s]);
    }

    await client.query("COMMIT");

    return {
      success: true,
      message: `Ontology file processed successfully.\n\nSheets:\n${sheetNames
        .map((s) => `• ${s}`)
        .join("\n")}`,
    };
  } catch (err: any) {
    await client.query("ROLLBACK");
    const [user_email] = await getUserEmailFromSession();
    const user = user_email || "imdhub-system";
    logError(
      err,
      {
        operation: "Import:OntologyExcel",
        userId: user,
        resource: "imdhub_refs",
        metadata: { message: "Error from ontology import" },
      },
      isSecurityCritical(err) ? "critical" : "error"
    );
    return { success: false, message: getUserFriendlyMessage(err) };
  } finally {
    client.release();
  }
}
