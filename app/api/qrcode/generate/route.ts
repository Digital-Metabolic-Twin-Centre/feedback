import path from "path";
import fs from "fs";
import { NextRequest } from "next/server";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { getUserGroupsFromSession } from "@/utils/auth/get-user-groups";
import { getTableData } from "@/app/actions/select/qrcode/generate/action";
import { verifyToken, handleApiError } from "@/lib/api-helpers";
import { corsHeaders } from "@/lib/cors";
import { validateDateField } from "@/lib/api-validation";
import { assertHasAllPermissions } from "@/lib/api-table-authorization";
import { SITE_PERMISSIONS } from "@/lib/permissions";
import { withRateLimit } from "@/lib/rate-limit";

const QR_SCHEMA = "imdhub_core";
const ALLOWED_QR_TABLES = new Set([
  "participant_registrations",
  "participant_visits",
  "biospecimen_logs",
]);

const postHandler = async (req: NextRequest) => {
  try {
    const origin = req.headers.get("origin");
    const headers = corsHeaders(origin, { allowCredentials: true });
    const { table, dateField, from, to, color = "#000000", qrTextColor = "#000000" } = await req.json();

    await verifyToken(req);
    const { roles, groups } = await getUserGroupsFromSession();
    assertHasAllPermissions(
      roles,
      [SITE_PERMISSIONS.CAN_ACCESS_LOGISTICS],
      "generate QR code labels",
    );

    if (typeof table !== "string" || !ALLOWED_QR_TABLES.has(table)) {
      return new Response(
        JSON.stringify({ message: "Invalid table selected for QR generation" }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }

    const dateFilter =
      from || to
        ? {
          field: validateDateField(dateField) ? dateField : "created_at",
          from,
          to,
        }
        : undefined;

    const result = await getTableData(QR_SCHEMA, table, {}, groups, dateFilter);

    // Gracefully handle empty data
    if (!result.success) {
      return new Response(
        JSON.stringify({ message: result.message || "Query failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!result.data?.length) {
      return new Response(
        JSON.stringify({ message: "No records found for selected filters" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (table === "biospecimen_logs") {
      // Keep the order fixed
      const fieldOrder = [
        "urine_aliquots_identifiers",
        "plasma_aliquots_identifiers",
        "frozen_pellets_aliquots_identifiers",
        "frozen_cryo_aliquots_identifiers"
      ];

      // Flatten and sort aliquots in this order
      const orderedAliquots = fieldOrder.flatMap(field =>
        result.data.flatMap(row =>
          ((row as Record<string, string | null | undefined>)[field] || "")
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        )
      );

      if (!orderedAliquots.length) {
        return new Response(
          JSON.stringify({ message: "No aliquot identifiers found for selected filters" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      // Replace result.data with a new array formatted for QR printing
      result.data = orderedAliquots.map(id => ({
        biospecimen_aliquots: id
      }));
    }

    const fontPath = path.join(process.cwd(), "public", "fonts", "Roboto-Regular.ttf");
    const fontBoldPath = path.join(process.cwd(), "public", "fonts", "Roboto-Bold.ttf");

    const doc = new PDFDocument({ size: "A4", margin: 36, autoFirstPage: true, font: fontBoldPath });

    // const orgName = groups && groups.length > 0 ? groups.join(", ") : "Recon4IMD Network";
    // const title = `Organisation: ${orgName}`;

    // doc.fontSize(14)
    //   .fillColor("#000000")
    //   .text(title, { align: "center" });

    // doc.moveDown(1); // Adds some vertical space after the header

    if (fs.existsSync(fontPath)) doc.registerFont("Body", fontPath);
    if (fs.existsSync(fontBoldPath)) doc.registerFont("BodyBold", fontBoldPath);
    doc.font(fs.existsSync(fontPath) ? "Body" : "Times-Roman");

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));

    // Layout configuration
    const labelsPerRow = 3;
    const labelsPerColumn = 7;
    const labelsPerPage = labelsPerRow * labelsPerColumn;
    const labelGapX = 14;
    const labelGapY = 8;
    const labelWidth = 160;
    const labelHeight = 100;

    // Draw each label
    for (let i = 0; i < result.data.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = result.data[i] as { code?: string; id: string;[key: string]: any };
      const qrValue = String(row.participant_id_code || row.biospecimen_aliquots || row.visit_id || "").trim();
      if (!qrValue) continue;

      // Add new page if needed
      if (i > 0 && i % labelsPerPage === 0) doc.addPage();

      const position = i % labelsPerPage;
      const col = position % labelsPerRow;
      const rowNum = Math.floor(position / labelsPerRow);
      const x = doc.page.margins.left + col * (labelWidth + labelGapX);
      const y = doc.page.margins.top + rowNum * (labelHeight + labelGapY);

      // Label background — user-selected color
      doc.save();
      doc.rect(x, y, labelWidth, labelHeight).fill(color);
      doc.restore();

      // White inner box (for logo + QR)
      const innerPadding = 10;
      const innerX = x + innerPadding;
      const innerY = y + 30;
      const innerWidth = labelWidth - innerPadding * 2;
      const innerHeight = labelHeight - 45;
      doc.save();
      doc.roundedRect(innerX, innerY, innerWidth, innerHeight, 8).fill("#FFFFFF");
      doc.restore();

      // Border for label
      doc.lineWidth(0.5).strokeColor("#aaa");
      doc.roundedRect(x, y, labelWidth, labelHeight, 6).stroke();

      const centerX = x + labelWidth / 2;

      // Code label on top (over colored area)
      if (fs.existsSync(fontBoldPath)) doc.font("BodyBold");
      doc.fontSize(14).fillColor(qrTextColor || "#000000");
      doc.text(qrValue, x + 5, y + 8, { width: labelWidth - 10, align: "center" });

      // Logo + QR insisde white box
      const logoPath = path.join(process.cwd(), "public/images", "recon4imd.png");
      const logoSize = 30;
      const qrSize = 30;
      const spacing = 12;
      const groupY = innerY + 8;
      const totalWidth = logoSize + spacing + qrSize;
      const startX = centerX - totalWidth / 2;

      // Logo (left)
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, startX, groupY, { width: logoSize, height: logoSize });
      } else {
        if (fs.existsSync(fontPath)) doc.font("Body");
        doc.fontSize(8).fillColor("#000");
        doc.text("Recon4IMD", startX, groupY + qrSize / 2 - 5, {
          width: logoSize,
          align: "center",
        });
      }

      // QR (right)
      const qrCode = await QRCode.toDataURL(qrValue, {
        color: { dark: "#000000", light: "#FFFFFF" },
        margin: 0,
      });
      doc.image(qrCode, startX + logoSize + spacing, groupY, {
        width: qrSize,
        height: qrSize,
      });

      // Text label “Recon4IMD” under both
      if (fs.existsSync(fontBoldPath)) {
        doc.font("Body");
      } else if (fs.existsSync(fontPath)) {
        doc.font("Body");
      }
      doc.fontSize(10).fillColor("#000");
      doc.text("Recon4IMD", x + 5, innerY + qrSize + 10, {
        width: labelWidth - 10,
        align: "center",
      });
    }

    // Only end the doc *after* all labels
    doc.end();

    const buffer = await new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Response(buffer as any, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Recon4IMD_Labels.pdf"',
      },
    });
  } catch (err) {
    return handleApiError(err, req);
  }
};

export const POST = withRateLimit(postHandler);
