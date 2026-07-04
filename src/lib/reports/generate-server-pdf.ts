import 'server-only';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { logger } from '@/lib/logger';
import { renderReportToHTML } from '@/lib/reports/report-generator';
import type { ClientReport } from '@/lib/reports/report-types';
import type { GenerateServerPdfOptions } from '@/lib/reports/report-types';

const pdfLog = logger.child('reports:server-pdf');

const CHROMIUM_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter((value): value is string => Boolean(value?.trim()));

async function resolveChromiumExecutable(): Promise<string | null> {
  const fs = await import('node:fs/promises');

  for (const candidate of CHROMIUM_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }

  return null;
}

async function launchBrowser() {
  const executablePath = await resolveChromiumExecutable();
  if (!executablePath) {
    return null;
  }

  const puppeteer = await import('puppeteer-core');
  return puppeteer.default.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

async function renderPdfWithPuppeteer(report: ClientReport): Promise<Buffer | null> {
  const html = renderReportToHTML(report);
  const browser = await launchBrowser();

  if (!browser) {
    pdfLog.warn('Chromium not found — falling back to pdf-lib text renderer', {
      hint: 'Set PUPPETEER_EXECUTABLE_PATH or install Chromium for branded HTML PDFs.',
    });
    return null;
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });

    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '12mm', bottom: '16mm', left: '12mm', right: '12mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#666;text-align:center;padding:0 12mm;">
          ${report.branding.agencyName} · Confidential · Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>`,
    });

    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function stripMarkdown(content: string): string {
  return content
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^### /gm, '')
    .replace(/^- /gm, '• ')
    .replace(/_/g, '')
    .trim();
}

async function renderPdfWithPdfLib(report: ClientReport): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const primary = report.branding.primaryColor || '#F7CBCA';
  const accent = report.branding.accentColor || '#5D6B6B';

  const parseHex = (hex: string) => {
    const normalized = hex.replace('#', '');
    const r = parseInt(normalized.slice(0, 2), 16) / 255;
    const g = parseInt(normalized.slice(2, 4), 16) / 255;
    const b = parseInt(normalized.slice(4, 6), 16) / 255;
    return rgb(Number.isFinite(r) ? r : 0.97, Number.isFinite(g) ? g : 0.8, Number.isFinite(b) ? b : 0.79);
  };

  const primaryColor = parseHex(primary);
  const accentColor = parseHex(accent);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 48;
  const lineHeight = 14;
  const maxWidth = pageWidth - margin * 2;

  const addPage = () => pdfDoc.addPage([pageWidth, pageHeight]);

  let page = addPage();
  let y = pageHeight - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = addPage();
      y = pageHeight - margin;
    }
  };

  const drawLine = (text: string, size = 11, font = regular, color = rgb(0.1, 0.1, 0.1)) => {
    const lines = wrapText(text, Math.floor(maxWidth / (size * 0.52)));
    for (const line of lines) {
      ensureSpace(lineHeight);
      page.drawText(line, { x: margin, y, size, font, color, maxWidth });
      y -= lineHeight;
    }
  };

  // Cover page
  page.drawRectangle({ x: 0, y: pageHeight * 0.55, width: pageWidth, height: pageHeight * 0.45, color: primaryColor });
  drawLine(report.title, 22, bold, accentColor);
  y -= 8;
  drawLine(report.subtitle, 12, regular, rgb(0.25, 0.25, 0.25));
  y -= 24;
  drawLine(`Prepared for: ${report.cover.client}`, 12, bold);
  drawLine(`Period: ${report.cover.period}`, 11);
  drawLine(`Generated: ${report.date}`, 11);
  y -= 16;
  drawLine(report.branding.agencyName, 14, bold, accentColor);

  // TOC page
  page = addPage();
  y = pageHeight - margin;
  drawLine('Table of Contents', 18, bold, accentColor);
  y -= 8;
  report.toc.forEach((item, index) => {
    drawLine(`${index + 1}. ${item.title}`, 12);
  });

  // Section pages
  for (const section of report.sections) {
    page = addPage();
    y = pageHeight - margin;
    drawLine(section.title, 16, bold, accentColor);
    y -= 6;
    drawLine(stripMarkdown(section.content), 10);
  }

  pdfDoc.setTitle(report.title);
  pdfDoc.setAuthor(report.branding.agencyName);
  pdfDoc.setSubject(report.subtitle);
  pdfDoc.setCreator('AgentFlow AI Reports');
  pdfDoc.setProducer('AgentFlow AI (pdf-lib fallback)');
  pdfDoc.setCreationDate(new Date());
  pdfDoc.setModificationDate(new Date());
  pdfDoc.setKeywords([
    report.cover.client,
    report.cover.period,
    'client-report',
    ...report.performance.dataSources,
  ]);

  return Buffer.from(await pdfDoc.save());
}

async function applyPdfMetadata(buffer: Buffer, report: ClientReport): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(buffer);
  pdfDoc.setTitle(report.title);
  pdfDoc.setAuthor(report.branding.agencyName);
  pdfDoc.setSubject(report.subtitle);
  pdfDoc.setCreator('AgentFlow AI Reports');
  pdfDoc.setProducer('AgentFlow AI (Puppeteer + pdf-lib)');
  pdfDoc.setCreationDate(new Date());
  pdfDoc.setModificationDate(new Date());

  const keywords = [
    report.cover.client,
    report.cover.period,
    'client-report',
    ...report.performance.dataSources,
  ];
  pdfDoc.setKeywords(keywords);

  return Buffer.from(await pdfDoc.save());
}

async function applyPdfPassword(buffer: Buffer, password: string): Promise<Buffer> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const os = await import('node:os');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentflow-report-'));
  const inputPath = path.join(tmpDir, 'input.pdf');
  const outputPath = path.join(tmpDir, 'encrypted.pdf');

  try {
    await fs.writeFile(inputPath, buffer);
    await execFileAsync('qpdf', [
      '--encrypt',
      password,
      password,
      '256',
      '--print=full',
      '--modify=none',
      '--',
      inputPath,
      outputPath,
    ]);
    return await fs.readFile(outputPath);
  } catch (error) {
    pdfLog.warn('PDF password encryption skipped (install qpdf for AES-256 protection)', {
      error: error instanceof Error ? error.message : String(error),
    });
    return buffer;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function generateServerPDF(
  report: ClientReport,
  options: GenerateServerPdfOptions = {}
): Promise<Buffer> {
  const puppeteerBuffer = await renderPdfWithPuppeteer(report);
  let buffer = puppeteerBuffer ?? (await renderPdfWithPdfLib(report));

  if (puppeteerBuffer) {
    buffer = await applyPdfMetadata(puppeteerBuffer, report);
  }

  if (options.password?.trim()) {
    buffer = await applyPdfPassword(buffer, options.password.trim());
  }

  return buffer;
}

export function buildReportFilename(workspaceName: string, template = 'full') {
  const safeName = workspaceName.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 48);
  const date = new Date().toISOString().slice(0, 10);
  return `Client_Report_${safeName}_${template}_${date}.pdf`;
}