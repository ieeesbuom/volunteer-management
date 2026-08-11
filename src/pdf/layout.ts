import PDFDocument from "pdfkit";
import { APP_NAME, ORGANIZATION_NAME } from "@/lib/config";
import { pdfFonts, pdfLayout, pdfTheme } from "@/pdf/theme";

export type PdfDocument = InstanceType<typeof PDFDocument>;

export function createPdfDocument(title: string) {
  const doc = new PDFDocument({
    margin: pdfLayout.margin,
    size: "A4",
    info: {
      Author: ORGANIZATION_NAME,
      Creator: APP_NAME,
      Title: title,
    },
  });

  return doc;
}

export function renderTopBar(doc: PdfDocument) {
  doc
    .rect(0, 0, doc.page.width, 4)
    .fill(pdfTheme.primary);
}

export function renderDocumentHeader(
  doc: PdfDocument,
  title: string,
  subtitle?: string,
  badgeText?: string,
) {
  renderTopBar(doc);

  const startX = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startY = doc.y;

  // Eyebrow
  doc
    .fillColor(pdfTheme.primary)
    .fontSize(pdfFonts.caption)
    .text(ORGANIZATION_NAME.toUpperCase(), startX, startY, {
      characterSpacing: 0.5,
      continued: false,
    });

  doc.moveDown(0.3);

  // Title & optional right-aligned badge
  const titleY = doc.y;
  doc
    .fontSize(pdfFonts.title)
    .fillColor(pdfTheme.text)
    .text(title, startX, titleY, { width: badgeText ? contentWidth * 0.7 : contentWidth });

  if (badgeText) {
    const badgeWidth = 110;
    const badgeHeight = 20;
    const badgeX = startX + contentWidth - badgeWidth;
    const badgeY = titleY;

    doc
      .roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 4)
      .fillAndStroke(pdfTheme.badgeBg, pdfTheme.border);

    doc
      .fillColor(pdfTheme.badgeText)
      .fontSize(pdfFonts.caption)
      .text(badgeText.toUpperCase(), badgeX, badgeY + 5, {
        align: "center",
        width: badgeWidth,
      });
  }

  if (subtitle) {
    doc.moveDown(0.2);
    doc
      .fontSize(pdfFonts.body)
      .fillColor(pdfTheme.secondary)
      .text(subtitle, startX, doc.y, { width: contentWidth });
  }

  doc.moveDown(0.7);

  // Horizontal divider
  const lineY = doc.y;
  doc
    .strokeColor(pdfTheme.border)
    .lineWidth(1)
    .moveTo(startX, lineY)
    .lineTo(startX + contentWidth, lineY)
    .stroke();

  doc.y = lineY + 14;
}

export function checkPageBreak(doc: PdfDocument, neededHeight: number) {
  const bottomMargin = doc.page.margins.bottom + 25;
  if (doc.y + neededHeight > doc.page.height - bottomMargin) {
    doc.addPage();
    renderTopBar(doc);
    doc.y = doc.page.margins.top;
    return true;
  }
  return false;
}

export function renderSectionHeader(doc: PdfDocument, heading: string) {
  checkPageBreak(doc, 36);

  const startX = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const currentY = doc.y;

  // Blue vertical accent bar
  doc
    .rect(startX, currentY + 1, 3.5, 14)
    .fill(pdfTheme.primary);

  // Section Heading text
  doc
    .fontSize(pdfFonts.section)
    .fillColor(pdfTheme.text)
    .text(heading.toUpperCase(), startX + 10, currentY, {
      characterSpacing: 0.5,
      width: contentWidth - 10,
    });

  const nextY = doc.y + 4;

  // Subtle underline rule
  doc
    .strokeColor(pdfTheme.borderSubtle)
    .lineWidth(1)
    .moveTo(startX, nextY)
    .lineTo(startX + contentWidth, nextY)
    .stroke();

  doc.y = nextY + 10;
}

export function renderTable(
  doc: PdfDocument,
  options: {
    headers: string[];
    columnWidths: number[];
    alignments?: Array<"left" | "center" | "right">;
    rows: string[][];
    emptyMessage?: string;
  },
) {
  const { headers, columnWidths, alignments = [], rows, emptyMessage = "No records found." } = options;
  const startX = doc.page.margins.left;
  const totalWidth = columnWidths.reduce((a, b) => a + b, 0);

  if (rows.length === 0) {
    checkPageBreak(doc, 40);
    doc
      .roundedRect(startX, doc.y, totalWidth, 36, 4)
      .fillAndStroke(pdfTheme.surfaceSubtle, pdfTheme.borderSubtle);

    doc
      .fillColor(pdfTheme.muted)
      .fontSize(pdfFonts.bodySm)
      .text(emptyMessage, startX + 12, doc.y + 12, { width: totalWidth - 24 });

    doc.y += 48;
    return;
  }

  // Draw Header Row
  const drawHeader = () => {
    checkPageBreak(doc, 28);
    const headerY = doc.y;
    const headerHeight = 24;

    doc
      .rect(startX, headerY, totalWidth, headerHeight)
      .fillAndStroke(pdfTheme.primarySoft, pdfTheme.border);

    let x = startX;
    headers.forEach((header, colIdx) => {
      const colWidth = columnWidths[colIdx];
      const align = alignments[colIdx] || "left";

      doc
        .fillColor(pdfTheme.primaryDark)
        .fontSize(pdfFonts.caption)
        .text(header.toUpperCase(), x + 8, headerY + 7, {
          align,
          width: colWidth - 16,
        });

      x += colWidth;
    });

    doc.y = headerY + headerHeight;
  };

  drawHeader();

  // Draw Table Rows
    rows.forEach((row, rowIdx) => {
      // Estimate row height based on text content
      let maxHeight = 24;
      doc.fontSize(pdfFonts.bodySm);
      row.forEach((cellText, colIdx) => {
        const colWidth = columnWidths[colIdx] - 16;
        const textHeight = doc.heightOfString(cellText || "", { width: colWidth });
        if (textHeight + 12 > maxHeight) {
          maxHeight = Math.ceil(textHeight + 12);
        }
      });

    if (checkPageBreak(doc, maxHeight + 5)) {
      drawHeader();
    }

    const currentY = doc.y;
    const bg = rowIdx % 2 === 0 ? pdfTheme.surface : pdfTheme.surfaceSubtle;

    doc
      .rect(startX, currentY, totalWidth, maxHeight)
      .fillAndStroke(bg, pdfTheme.borderSubtle);

    let x = startX;
    row.forEach((cellText, colIdx) => {
      const colWidth = columnWidths[colIdx];
      const align = alignments[colIdx] || "left";

      doc
        .fillColor(pdfTheme.text)
        .fontSize(pdfFonts.bodySm)
        .text(cellText || "—", x + 8, currentY + 6, {
          align,
          width: colWidth - 16,
          lineGap: 2,
        });

      x += colWidth;
    });

    doc.y = currentY + maxHeight;
  });

  doc.y += pdfLayout.sectionGap;
}

export function finalizePdf(doc: PdfDocument) {
  doc.end();

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}
