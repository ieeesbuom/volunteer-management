import { pdfFonts, pdfLayout, pdfTheme } from "@/pdf/theme";
import {
  checkPageBreak,
  createPdfDocument,
  finalizePdf,
  renderDocumentHeader,
  renderSectionHeader,
  renderTable,
} from "@/pdf/layout";
import type { PdfBuildResult, VolunteerProfilePdfInput } from "@/pdf/types";

export async function buildVolunteerProfilePdf(
  input: VolunteerProfilePdfInput,
): Promise<PdfBuildResult> {
  const doc = createPdfDocument(`Volunteer Profile - ${input.name}`);

  // 1. Header Banner
  renderDocumentHeader(
    doc,
    "Volunteer Performance Profile",
    `Official Record & Activity Summary • ${input.name}`,
    input.uomEmail ? "UoM Verified" : "Registered User",
  );

  // 2. Executive Profile Card
  renderProfileCard(doc, input);

  // 3. Participation Section
  renderParticipationSection(doc, input);

  // 4. Recommendations Section
  renderRecommendationsSection(doc, input);

  // 5. Points Summary Section
  renderPointsSection(doc, input);

  const buffer = await finalizePdf(doc);

  return {
    buffer,
    filename: buildFilename("volunteer", input.name),
  };
}

function renderProfileCard(
  doc: ReturnType<typeof createPdfDocument>,
  input: VolunteerProfilePdfInput,
) {
  checkPageBreak(doc, 110);

  const startX = doc.page.margins.left;
  const cardWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cardHeight = 96;
  const y = doc.y;

  // Background Card Fill & Stroke
  doc
    .roundedRect(startX, y, cardWidth, cardHeight, 6)
    .fillAndStroke(pdfTheme.surfaceSubtle, pdfTheme.border);

  // Left Column Details
  const leftX = startX + 14;
  let currentY = y + 12;

  doc
    .fontSize(13)
    .fillColor(pdfTheme.text)
    .text(input.name, leftX, currentY, { width: cardWidth * 0.6 });

  currentY += 18;

  const rows = [
    { label: "Google Email", value: input.googleEmail },
    { label: "UoM Email", value: input.uomEmail ?? "Not verified" },
    {
      label: "SB Roles",
      value: input.sbRoles.length > 0 ? input.sbRoles.join(", ") : "None assigned",
    },
  ];

  rows.forEach((row) => {
    doc
      .fontSize(pdfFonts.bodySm)
      .fillColor(pdfTheme.secondary)
      .text(`${row.label}: `, leftX, currentY, { continued: true });
    doc
      .fillColor(pdfTheme.text)
      .text(row.value);
    currentY += 15;
  });

  // Vertical Divider line before right stats
  const dividerX = startX + cardWidth * 0.64;
  doc
    .strokeColor(pdfTheme.border)
    .lineWidth(1)
    .moveTo(dividerX, y + 10)
    .lineTo(dividerX, y + cardHeight - 10)
    .stroke();

  // Right Column Stats
  const rightX = dividerX + 14;
  let statY = y + 14;

  const totalPoints = input.pointsLedger?.total ?? 0;
  doc
    .fontSize(pdfFonts.caption)
    .fillColor(pdfTheme.secondary)
    .text("LIFETIME POINTS", rightX, statY, { characterSpacing: 0.5 });
  statY += 12;
  doc
    .fontSize(15)
    .fillColor(pdfTheme.primary)
    .text(`${totalPoints} pts`, rightX, statY);

  statY += 22;

  doc
    .fontSize(pdfFonts.caption)
    .fillColor(pdfTheme.secondary)
    .text("EVENTS", rightX, statY, { continued: true });
  doc
    .fillColor(pdfTheme.text)
    .text(`  ${input.participations.length}`, { continued: false });

  statY += 14;
  doc
    .fontSize(pdfFonts.caption)
    .fillColor(pdfTheme.secondary)
    .text("RECOMMENDATIONS", rightX, statY, { continued: true });
  doc
    .fillColor(pdfTheme.text)
    .text(`  ${input.recommendations.length}`, { continued: false });

  doc.y = y + cardHeight + pdfLayout.sectionGap;
}

function renderParticipationSection(
  doc: ReturnType<typeof createPdfDocument>,
  input: VolunteerProfilePdfInput,
) {
  renderSectionHeader(doc, "Event Participation History");

  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidths = [
    Math.floor(tableWidth * 0.44),
    Math.floor(tableWidth * 0.34),
    Math.floor(tableWidth * 0.22),
  ];

  const rows = input.participations.map((p) => [
    p.eventTitle,
    `${p.role}${p.committeeName ? ` (${p.committeeName})` : ""}`,
    formatDisplayDate(p.assignedAt) ?? "—",
  ]);

  renderTable(doc, {
    alignments: ["left", "left", "left"],
    columnWidths: colWidths,
    emptyMessage: "No event participation recorded for this volunteer.",
    headers: ["Event Title", "Role & Committee", "Assigned Date"],
    rows,
  });
}

function renderRecommendationsSection(
  doc: ReturnType<typeof createPdfDocument>,
  input: VolunteerProfilePdfInput,
) {
  renderSectionHeader(doc, "Recommendations & Endorsements");

  const cardWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startX = doc.page.margins.left;

  if (input.recommendations.length === 0) {
    checkPageBreak(doc, 40);
    doc
      .roundedRect(startX, doc.y, cardWidth, 36, 4)
      .fillAndStroke(pdfTheme.surfaceSubtle, pdfTheme.borderSubtle);

    doc
      .fillColor(pdfTheme.muted)
      .fontSize(pdfFonts.bodySm)
      .text("No recommendations recorded for this volunteer.", startX + 12, doc.y + 12, {
        width: cardWidth - 24,
      });

    doc.y += 48;
    return;
  }

  for (const recommendation of input.recommendations) {
    doc.fontSize(pdfFonts.bodySm);
    const noteHeight = doc.heightOfString(`"${recommendation.note}"`, {
      width: cardWidth - 30,
    });
    const cardHeight = Math.max(54, Math.ceil(noteHeight + 34));

    checkPageBreak(doc, cardHeight + 10);
    const cardY = doc.y;

    // Card container
    doc
      .roundedRect(startX, cardY, cardWidth, cardHeight, 4)
      .fillAndStroke(pdfTheme.surfaceSubtle, pdfTheme.border);

    // Left accent bar
    doc
      .rect(startX, cardY, 3.5, cardHeight)
      .fill(pdfTheme.primary);

    // Header info: From & Event
    doc
      .fontSize(pdfFonts.bodySm)
      .fillColor(pdfTheme.text)
      .text(`Endorsed by ${recommendation.fromName}`, startX + 12, cardY + 8, {
        continued: true,
      });
    doc
      .fillColor(pdfTheme.muted)
      .text(`  •  Event: ${recommendation.eventTitle}`);

    // Note body
    doc
      .fontSize(pdfFonts.bodySm)
      .fillColor(pdfTheme.secondary)
      .text(`"${recommendation.note}"`, startX + 12, cardY + 24, {
        lineGap: 3,
        width: cardWidth - 24,
      });

    doc.y = cardY + cardHeight + 10;
  }

  doc.y += pdfLayout.sectionGap - 10;
}

function renderPointsSection(
  doc: ReturnType<typeof createPdfDocument>,
  input: VolunteerProfilePdfInput,
) {
  renderSectionHeader(doc, "Scoring & Points Ledger");

  if (!input.pointsLedger) {
    const startX = doc.page.margins.left;
    const cardWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    checkPageBreak(doc, 40);
    doc
      .roundedRect(startX, doc.y, cardWidth, 36, 4)
      .fillAndStroke(pdfTheme.surfaceSubtle, pdfTheme.borderSubtle);

    doc
      .fillColor(pdfTheme.muted)
      .fontSize(pdfFonts.bodySm)
      .text(
        "Ledger data is not connected yet. Awarded points will appear here once finalized.",
        startX + 12,
        doc.y + 12,
        { width: cardWidth - 24 },
      );

    doc.y += 48;
    return;
  }

  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidths = [
    Math.floor(tableWidth * 0.40),
    Math.floor(tableWidth * 0.28),
    Math.floor(tableWidth * 0.18),
    Math.floor(tableWidth * 0.14),
  ];

  const rows = input.pointsLedger.entries.map((entry) => [
    entry.eventTitle,
    entry.role,
    formatDisplayDate(entry.awardedAt) ?? "—",
    `+${entry.points} pts`,
  ]);

  renderTable(doc, {
    alignments: ["left", "left", "left", "right"],
    columnWidths: colWidths,
    emptyMessage: "No points entries recorded in the ledger yet.",
    headers: ["Event / Activity", "Role / Description", "Awarded Date", "Points"],
    rows,
  });
}

function formatDisplayDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleDateString();
}

function buildFilename(prefix: string, label: string) {
  const sanitized = sanitizeFilename(label);
  return sanitized ? `${prefix}-${sanitized}.pdf` : `${prefix}-profile.pdf`;
}

function sanitizeFilename(value: string) {
  const ascii = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return ascii;
}
