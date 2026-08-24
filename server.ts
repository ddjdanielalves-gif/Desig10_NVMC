import express from 'express';
import multer from 'multer';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

// ============================================================
// CONFIGURAÇÃO ATUAL DA CONGREGAÇÃO
// ============================================================

const ELDERS = [
  'Daniel Alves da Silva',
  'Edivaldo Conceição Nascimento',
  'Elias Conceição Borges',
  'José Milton Miranda Batista',
  'Leandro Nascimento da Silva',
  'Leonardo da Silva Novaes dos Santos',
  'Paulo Sérgio Coppque de Freitas',
  'Rafael Santos do Espírito Santo',
  'Reginaldo Nascimento Sousa'
];

const SERVOS = [
  'Alan dos Santos Miranda Batista',
  'Alexandre Santos do Nascimento',
  'Gutemberg Moura Dos Santos',
  'Mateus Silva Dos Santos'
];

const READERS_EBC = [
  'Alexandre Nascimento',
  'Mateus dos Santos',
  'Alan Miranda',
  'Cléber Bessa',
  'Edvando Silva',
  'Juraci Rebouças',
  'Pedro Costa',
  'Sérgio Gualberto',
  'Ítalo Dantas'
];

const SPECIAL_LOW_FREQUENCY = new Set([
  'Edivaldo Conceição Nascimento',
  'José Milton Miranda Batista'
]);

const NOT_EBC_DIRIGENTES = new Set(SPECIAL_LOW_FREQUENCY);
const NOT_PRESIDENTS = new Set(SPECIAL_LOW_FREQUENCY);

const DISCURSO1_WEIGHTS: Record<string, number> = {};
for (const name of SPECIAL_LOW_FREQUENCY) {
  DISCURSO1_WEIGHTS[name] = 0.30;
}

const RARE_JOIAS = [
  'José Milton Miranda Batista',
  'Edivaldo Conceição Nascimento'
];

const MONTHS: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  março: 3,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12
};

const MONTH_NAMES: Record<number, string> = {
  1: 'janeiro',
  2: 'fevereiro',
  3: 'março',
  4: 'abril',
  5: 'maio',
  6: 'junho',
  7: 'julho',
  8: 'agosto',
  9: 'setembro',
  10: 'outubro',
  11: 'novembro',
  12: 'dezembro'
};

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const ALIASES: Record<string, string[]> = {
  'Gutemberg Moura Dos Santos': ['Gutemberg Moura'],
  'Mateus Silva Dos Santos': ['Mateus Silva'],
  'Alexandre Santos do Nascimento': ['Alexandre Nascimento'],
  'Alan dos Santos Miranda Batista': ['Alan Miranda'],
  'Edivaldo Conceição Nascimento': ['Edivaldo Nascimento'],
  'José Milton Miranda Batista': ['José Milton Miranda', 'José Milton'],
  'Leandro Nascimento da Silva': ['Leandro Nascimento'],
  'Leonardo da Silva Novaes dos Santos': ['Leonardo da Silva Novaes'],
  'Paulo Sérgio Coppque de Freitas': ['Paulo Sérgio'],
  'Rafael Santos do Espírito Santo': ['Rafael Santos'],
  'Reginaldo Nascimento Sousa': ['Reginaldo Nascimento']
};

// ============================================================
// XML HELPERS
// ============================================================

function isTag(node: any, name: string): boolean {
  if (!node || node.nodeType !== 1) return false;
  return node.localName === name || node.tagName === `w:${name}` || node.tagName === name;
}

function findDescendants(node: any, name: string): any[] {
  const result: any[] = [];
  function recurse(curr: any) {
    if (!curr) return;
    if (curr.nodeType === 1 && isTag(curr, name)) {
      result.push(curr);
    }
    const children = curr.childNodes;
    if (children) {
      for (let i = 0; i < children.length; i++) {
        recurse(children[i]);
      }
    }
  }
  const children = node.childNodes;
  if (children) {
    for (let i = 0; i < children.length; i++) {
      recurse(children[i]);
    }
  }
  return result;
}

function findChildren(node: any, name: string): any[] {
  const result: any[] = [];
  const children = node.childNodes;
  if (!children) return result;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.nodeType === 1 && isTag(child, name)) {
      result.push(child);
    }
  }
  return result;
}

function clean(s: string | null | undefined): string {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function textFromParagraph(p: any): string {
  const tNodes = findDescendants(p, 't');
  const texts = tNodes.map(t => t.textContent || '').filter(Boolean);
  return clean(texts.join(' '));
}

function textFromCell(c: any): string {
  const paragraphs = findDescendants(c, 'p');
  const parts = paragraphs.map(p => textFromParagraph(p)).filter(Boolean);
  if (parts.length > 0) {
    return clean(parts.join(' '));
  }
  const tNodes = findDescendants(c, 't');
  const texts = tNodes.map(t => t.textContent || '').filter(Boolean);
  return clean(texts.join(' '));
}

function xmlText(node: any): string {
  if (isTag(node, 'tc')) {
    return textFromCell(node);
  }
  const parts: string[] = [];
  const paragraphs = findDescendants(node, 'p');
  for (const p of paragraphs) {
    const txt = textFromParagraph(p);
    if (txt) parts.push(txt);
  }
  return clean(parts.join(' '));
}

function compact(s: string): string {
  let res = clean(s).toUpperCase();
  res = res.replace(/\s*([:;,./])\s*/g, '$1');
  return res;
}

function rowCells(row: any): any[] {
  return findChildren(row, 'tc');
}

function rowNumber(row: any): number | null {
  const txt = xmlText(row);
  const match = txt.match(/(?:^|[^\d])([1-9]\d?)\s*\./);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

// ============================================================
// DATAS
// ============================================================

function extractDate(text: string): [number, number] | null {
  let s = clean(text).toUpperCase();
  s = s.replace(/\u00a0/g, ' ');

  const sortedMonths = Object.keys(MONTHS).sort((a, b) => b.length - a.length);

  for (const monthName of sortedMonths) {
    const spacedMonth = monthName.toUpperCase().split('').map(c => escapeRegExp(c)).join('\\s*');
    const pattern = new RegExp(`(?:^|[^\\d])(\\d(?:\\s*\\d)?)\\s*DE\\s*(${spacedMonth})(?![A-Z])`, 'i');
    const match = s.match(pattern);
    if (match) {
      const day = parseInt(match[1].replace(/\s+/g, ''), 10);
      return [day, MONTHS[monthName]];
    }
  }
  return null;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// TABELAS
// ============================================================

function tableRows(root: any): { ti: number; tbl: any; rows: any[] }[] {
  const tbls = findDescendants(root, 'tbl');
  const result: { ti: number; tbl: any; rows: any[] }[] = [];
  tbls.forEach((tbl, ti) => {
    const rows = findChildren(tbl, 'tr');
    if (rows.length > 0) {
      result.push({ ti, tbl, rows });
    }
  });
  return result;
}

function firstRowContaining(rows: any[], predicate: (s: string) => boolean): { ri: number; row: any } | { ri: -1; row: null } {
  for (let ri = 0; ri < rows.length; ri++) {
    if (predicate(xmlText(rows[ri]))) {
      return { ri, row: rows[ri] };
    }
  }
  return { ri: -1, row: null };
}

function rowHasPlaceholder(row: any): boolean {
  return compact(xmlText(row)).includes('ESCOLHER UM ITEM');
}

// ============================================================
// NOMES
// ============================================================

function extractNamesFromText(text: string): string[] {
  const low = text.toLowerCase();
  const found: string[] = [];
  const allPeople = [...ELDERS, ...SERVOS];

  for (const name of allPeople) {
    const candidates = [name, ...(ALIASES[name] || [])];
    for (const candidate of candidates) {
      const pattern = new RegExp(`(?:^|[^\\wÀ-ÿ])${escapeRegExp(candidate.toLowerCase())}(?![\\wÀ-ÿ])`, 'i');
      if (pattern.test(low)) {
        if (!found.includes(name)) {
          found.push(name);
        }
        break;
      }
    }
  }
  return found;
}

// ============================================================
// REGRAS DE ELEGIBILIDADE
// ============================================================

function ebcEligibleElders(): string[] {
  return ELDERS.filter(name => !NOT_EBC_DIRIGENTES.has(name));
}

function presidentEligibleElders(): string[] {
  return ELDERS.filter(name => !NOT_PRESIDENTS.has(name));
}

function discurso1Weight(name: string): number {
  if (name in DISCURSO1_WEIGHTS) {
    return DISCURSO1_WEIGHTS[name];
  }
  if (SERVOS.includes(name)) {
    return 0.30;
  }
  return 1.0;
}

// ============================================================
// IDENTIFICAÇÃO DA NOSSA VIDA CRISTÃ
// ============================================================

function nvcPartKind(row: any): 'ebc' | 'nvc' | null {
  const number = rowNumber(row);
  const txt = compact(xmlText(row));
  if (txt.includes('ESTUDO BÍBLICO DE CONGREGAÇÃO')) {
    return 'ebc';
  }
  if (number === null) {
    return null;
  }
  return 'nvc';
}

interface NvcRowInfo {
  rowIndex: number;
  row: any;
  part: number | null;
  kind: 'ebc' | 'nvc';
  text: string;
  hasPlaceholder: boolean;
  targetCellIndex: number;
}

function findNvcRows(rows: any[]): NvcRowInfo[] {
  const result: NvcRowInfo[] = [];
  let inNvc = false;

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const txt = xmlText(row);
    const c = compact(txt);

    if (c.includes('NOSSA VIDA CRISTÃ')) {
      inNvc = true;
      continue;
    }

    if (!inNvc) continue;

    const cells = rowCells(row);
    if (!cells.length) continue;

    if (c.includes('ESTUDO BÍBLICO DE CONGREGAÇÃO')) {
      result.push({
        rowIndex: ri,
        row,
        part: rowNumber(row),
        kind: 'ebc',
        text: txt,
        hasPlaceholder: rowHasPlaceholder(row),
        targetCellIndex: cells.length - 1
      });
      break;
    }

    const number = rowNumber(row);
    if (number === null) continue;
    if (cells.length < 2) continue;

    const kind = nvcPartKind(row);
    if (kind !== 'nvc') continue;

    const targetIndex = cells.length - 1;
    result.push({
      rowIndex: ri,
      row,
      part: number,
      kind: 'nvc',
      text: txt,
      hasPlaceholder: rowHasPlaceholder(row),
      targetCellIndex: targetIndex
    });
  }

  return result;
}

function getNvcAssignmentSlots(rows: any[]): any[] {
  const slots: any[] = [];
  const nvcRows = findNvcRows(rows);

  for (const info of nvcRows) {
    if (info.kind === 'ebc') continue;
    const cells = rowCells(info.row);
    if (!cells.length) continue;
    const targetIndex = info.targetCellIndex;
    if (targetIndex >= cells.length) continue;

    const target = cells[targetIndex];
    const rawText = textFromCell(target);
    const normalized = compact(rawText);
    const placeholder = normalized.includes('ESCOLHER UM ITEM');
    const current = placeholder ? '' : clean(rawText);

    slots.push({
      slotId: `nvc-${info.rowIndex}`,
      part: info.part,
      kind: 'nvc',
      rowIndex: info.rowIndex,
      targetCellIndex: targetIndex,
      text: info.text,
      current,
      empty: !Boolean(current),
      placeholder,
      assignable: true
    });
  }

  return slots;
}

function findNvcAssignmentRow(rows: any[], part: number): any | null {
  for (const info of findNvcRows(rows)) {
    if (info.kind === 'nvc' && info.part === part) {
      return info.row;
    }
  }
  return null;
}

// ============================================================
// PARSER
// ============================================================

async function parseDoc(fileBuffer: Buffer, filename = ''): Promise<any[]> {
  const zip = await JSZip.loadAsync(fileBuffer);
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('word/document.xml não encontrado no arquivo DOCX.');
  }
  const xmlString = await docXmlFile.async('text');
  const parser = new DOMParser();
  const root = parser.parseFromString(xmlString, 'text/xml');

  const yearMatch = (filename || '').match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

  const weeks: any[] = [];
  const tblEntries = tableRows(root);

  for (const { ti, rows } of tblEntries) {
    let d: [number, number] | null = null;

    for (const candidateRow of rows.slice(0, 8)) {
      const cells = rowCells(candidateRow);
      for (const cell of cells.slice(0, 4)) {
        d = extractDate(textFromCell(cell));
        if (d) break;
      }
      if (d) break;
    }

    if (!d) continue;

    const [day, month] = d;
    const dateStart = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const label = `${day.toString().padStart(2, '0')} DE ${MONTH_NAMES[month].toUpperCase()}`;

    const existing: any = {
      presidencia: '',
      oracao: '',
      discurso1: '',
      joias: '',
      leitura: '',
      facaSeuMelhor: '',
      facaSeuMelhorNames: [],
      considerations: [],
      considerationNames: [],
      nvcSlots: [],
      part7: '',
      part8: '',
      part7Names: [],
      part8Names: [],
      dirigenteEbc: '',
      leitorEbc: '',
      necessidadesLocais: ''
    };

    // PRESIDÊNCIA
    const presRow = firstRowContaining(rows, s => compact(s).includes('PRESIDENTE:'));
    if (presRow.row && !rowHasPlaceholder(presRow.row)) {
      existing.presidencia = xmlText(presRow.row);
    }

    // ORAÇÃO
    const oracaoRow = firstRowContaining(rows, s => compact(s).includes('19:30') && compact(s).includes('ORAÇÃO:'));
    if (oracaoRow.row && !rowHasPlaceholder(oracaoRow.row)) {
      existing.oracao = xmlText(oracaoRow.row);
    }

    // DISCURSO 1
    const disc1Row = firstRowContaining(rows, s => /\b1\./.test(s) && compact(s).includes('ESCOLHER UM ITEM') && !compact(s).includes('JOIAS ESPIRITUAIS'));
    if (disc1Row.row && !rowHasPlaceholder(disc1Row.row)) {
      existing.discurso1 = xmlText(disc1Row.row);
    }

    // JOIAS
    const joiasRow = firstRowContaining(rows, s => s.includes('2.') && compact(s).includes('JOIAS ESPIRITUAIS'));
    if (joiasRow.row && !rowHasPlaceholder(joiasRow.row)) {
      existing.joias = xmlText(joiasRow.row);
    }

    // LEITURA
    const leituraRow = firstRowContaining(rows, s => s.includes('3.') && compact(s).includes('LEITURA DA BÍBLIA'));
    if (leituraRow.row) {
      existing.leitura = xmlText(leituraRow.row);
    }

    // FAÇA SEU MELHOR
    const fmRows: string[] = [];
    let inFm = false;
    for (const row of rows) {
      const txt = xmlText(row);
      const c = compact(txt);
      if (c.includes('FAÇA SEU MELHOR NO MINISTÉRIO')) {
        inFm = true;
        continue;
      }
      if (inFm && c.includes('NOSSA VIDA CRISTÃ')) {
        break;
      }
      if (inFm && txt) {
        fmRows.push(txt);
      }
    }
    existing.facaSeuMelhor = fmRows.join('\n');
    for (const txt of fmRows) {
      for (const name of extractNamesFromText(txt)) {
        if (!existing.facaSeuMelhorNames.includes(name)) {
          existing.facaSeuMelhorNames.push(name);
        }
      }
    }

    // NOMES JÁ DESIGNADOS
    const assignedNames: string[] = [];
    for (const row of rows) {
      const names = extractNamesFromText(xmlText(row));
      for (const name of names) {
        if (!assignedNames.includes(name)) {
          assignedNames.push(name);
        }
      }
    }

    // NOSSA VIDA CRISTÃ
    const nvcSlots = getNvcAssignmentSlots(rows);
    existing.nvcSlots = nvcSlots;

    for (const slot of nvcSlots) {
      const current = clean(slot.current);
      if (slot.part === 7 && current) {
        existing.part7 = current;
        const names = extractNamesFromText(current);
        existing.part7Names = names;
        existing.considerations.push(current);
        existing.considerationNames.push(names[0] || '');
      } else if (slot.part === 8 && current) {
        existing.part8 = current;
        existing.part8Names = extractNamesFromText(current);
      }
    }

    // EBC
    const ebcRow = firstRowContaining(rows, s => compact(s).includes('DIRIGENTE/LEITOR:'));
    if (ebcRow.row && !rowHasPlaceholder(ebcRow.row)) {
      existing.dirigenteEbc = xmlText(ebcRow.row);
    }

    // SEMANA
    weeks.push({
      id: ti,
      tableIndex: ti,
      label,
      dateStart,
      existing,
      existingAssignedNames: assignedNames,
      considerationSlots: nvcSlots.filter(s => s.part === 7).length,
      nvcSlots,
      ebcEligibleElders: ebcEligibleElders(),
      presidentEligibleElders: presidentEligibleElders(),
      notEbcDirigentes: Array.from(NOT_EBC_DIRIGENTES).sort(),
      notPresidents: Array.from(NOT_PRESIDENTS).sort(),
      discurso1Weights: Object.fromEntries(
        [...ELDERS, ...SERVOS].map(name => [name, discurso1Weight(name)])
      ),
      skipped: false,
      skipReason: ''
    });
  }

  return weeks;
}

// ============================================================
// FORMATAÇÃO AZUL & ESCRITA XML
// ============================================================

function findBlueRpr(node: any): any | null {
  const runs = findDescendants(node, 'r');
  for (const run of runs) {
    const rprs = findChildren(run, 'rPr');
    if (!rprs.length) continue;
    const colors = findChildren(rprs[0], 'color');
    if (!colors.length) continue;
    const val = (colors[0].getAttribute('w:val') || colors[0].getAttribute('val') || '').toUpperCase();
    if (val === '0000FF' || val === 'BLUE') {
      return rprs[0];
    }
  }
  return null;
}

function makeBlueRpr(doc: any): any {
  const rpr = doc.createElementNS(W_NS, 'w:rPr');
  const color = doc.createElementNS(W_NS, 'w:color');
  color.setAttribute('w:val', '0000FF');
  rpr.appendChild(color);
  return rpr;
}

function ensureBlueRun(run: any, doc: any): any {
  let rprs = findChildren(run, 'rPr');
  let rpr: any;
  if (!rprs.length) {
    rpr = doc.createElementNS(W_NS, 'w:rPr');
    if (run.firstChild) {
      run.insertBefore(rpr, run.firstChild);
    } else {
      run.appendChild(rpr);
    }
  } else {
    rpr = rprs[0];
  }

  let colors = findChildren(rpr, 'color');
  let color: any;
  if (!colors.length) {
    color = doc.createElementNS(W_NS, 'w:color');
    rpr.appendChild(color);
  } else {
    color = colors[0];
  }

  color.setAttribute('w:val', '0000FF');
  color.removeAttribute('w:themeColor');
  color.removeAttribute('themeColor');
  color.removeAttribute('w:themeTint');
  color.removeAttribute('themeTint');
  color.removeAttribute('w:themeShade');
  color.removeAttribute('themeShade');

  return run;
}

function clearPlaceholderStyle(run: any): void {
  const rprs = findChildren(run, 'rPr');
  if (!rprs.length) return;
  const rstyles = findChildren(rprs[0], 'rStyle');
  if (!rstyles.length) return;
  const rstyle = rstyles[0];
  const val = (rstyle.getAttribute('w:val') || rstyle.getAttribute('val') || '').toUpperCase();
  if (['PLACEHOLDER', 'ESPAÇO', 'ESPACO', 'TEXTO'].some(term => val.includes(term))) {
    rprs[0].removeChild(rstyle);
  }
}

function ensureBlueCellRuns(cell: any, doc: any): void {
  const runs = findDescendants(cell, 'r');
  for (const run of runs) {
    ensureBlueRun(run, doc);
    clearPlaceholderStyle(run);
  }
}

function writeValueToCell(cell: any, value: string, sourceRpr: any | null, doc: any): boolean {
  if (!value) return false;
  const paragraphs = findDescendants(cell, 'p');
  let p: any;
  if (paragraphs.length > 0) {
    p = paragraphs[0];
  } else {
    p = doc.createElementNS(W_NS, 'w:p');
    cell.appendChild(p);
  }

  const runs = findChildren(p, 'r');
  if (runs.length > 0) {
    const firstRun = runs[0];
    const textNodes = findDescendants(firstRun, 't');
    if (textNodes.length > 0) {
      textNodes[0].textContent = value;
    } else {
      const t = doc.createElementNS(W_NS, 'w:t');
      t.textContent = value;
      firstRun.appendChild(t);
    }

    for (let i = 1; i < runs.length; i++) {
      const otherTexts = findDescendants(runs[i], 't');
      for (const t of otherTexts) {
        t.textContent = '';
      }
    }

    ensureBlueRun(firstRun, doc);
    clearPlaceholderStyle(firstRun);
    return true;
  }

  const run = doc.createElementNS(W_NS, 'w:r');
  if (sourceRpr) {
    run.appendChild(sourceRpr.cloneNode(true));
  } else {
    run.appendChild(makeBlueRpr(doc));
  }

  const t = doc.createElementNS(W_NS, 'w:t');
  t.textContent = value;
  run.appendChild(t);
  p.appendChild(run);

  ensureBlueRun(run, doc);
  return true;
}

function replacePlaceholderInContainer(container: any, value: string, doc: any): boolean {
  const textNodes = findDescendants(container, 't');
  const combined = textNodes.map(n => n.textContent || '').join('');
  const match = combined.match(/Escolher um item\.?/i);
  if (!match || match.index === undefined) return false;

  const start = match.index;
  const end = start + match[0].length;
  let position = 0;
  const touchedRuns: any[] = [];
  let firstDone = false;

  for (const node of textNodes) {
    const nodeText = node.textContent || '';
    const nodeStart = position;
    const nodeEnd = position + nodeText.length;
    position = nodeEnd;

    if (!(nodeStart < end && nodeEnd > start)) {
      continue;
    }

    const localStart = Math.max(0, start - nodeStart);
    const localEnd = Math.min(nodeText.length, end - nodeStart);

    const before = nodeText.substring(0, localStart);
    const after = nodeText.substring(localEnd);

    if (!firstDone) {
      node.textContent = before + value + after;
      firstDone = true;
    } else {
      node.textContent = before + after;
    }

    // Find enclosing run
    let curr = node.parentNode;
    while (curr && curr !== container) {
      if (isTag(curr, 'r')) {
        if (!touchedRuns.includes(curr)) {
          touchedRuns.push(curr);
        }
        break;
      }
      curr = curr.parentNode;
    }
  }

  for (const run of touchedRuns) {
    ensureBlueRun(run, doc);
    clearPlaceholderStyle(run);
  }

  if (isTag(container, 'sdt')) {
    const sdtPrs = findChildren(container, 'sdtPr');
    if (sdtPrs.length) {
      const showPlc = findChildren(sdtPrs[0], 'showingPlcHdr');
      if (showPlc.length) {
        sdtPrs[0].removeChild(showPlc[0]);
      }
    }
  }

  return true;
}

function rowIsNvcAssignment(row: any): boolean {
  const num = rowNumber(row);
  if (num === null) return false;
  const txt = compact(xmlText(row));
  if (txt.includes('ESTUDO BÍBLICO DE CONGREGAÇÃO')) return false;
  const cells = rowCells(row);
  return cells.length >= 2;
}

function setRowAssignment(row: any, value: string, labels: string[] = [], doc: any): boolean {
  if (!value) return false;

  // 1. SDT placeholder
  const sdts = findDescendants(row, 'sdt');
  for (const sdt of sdts) {
    if (replacePlaceholderInContainer(sdt, value, doc)) {
      return true;
    }
  }

  // 2. Normal placeholder in row
  if (replacePlaceholderInContainer(row, value, doc)) {
    return true;
  }

  const cells = rowCells(row);

  // 3. Empty cell after label
  for (let i = 0; i < cells.length; i++) {
    const cellText = compact(textFromCell(cells[i]));
    if (labels.length > 0) {
      if (!labels.some(l => cellText.includes(l))) {
        continue;
      }
    }

    if (i + 1 >= cells.length) continue;

    const target = cells[i + 1];
    const current = compact(textFromCell(target));
    if (current && current !== 'ESCOLHER UM ITEM') {
      continue;
    }

    let sourceRpr = findBlueRpr(target) || findBlueRpr(row);
    if (writeValueToCell(target, value, sourceRpr, doc)) {
      ensureBlueCellRuns(target, doc);
      return true;
    }
  }

  // 4. Empty cell in NVC row
  if (rowIsNvcAssignment(row)) {
    if (!cells.length) return false;
    const target = cells[cells.length - 1];
    const current = compact(textFromCell(target));
    if (!current || current === 'ESCOLHER UM ITEM') {
      let sourceRpr = findBlueRpr(target) || findBlueRpr(row);
      if (writeValueToCell(target, value, sourceRpr, doc)) {
        ensureBlueCellRuns(target, doc);
        return true;
      }
    }
  }

  return false;
}

function setNvcPartAssignment(rows: any[], part: number, value: string, doc: any): boolean {
  const row = findNvcAssignmentRow(rows, part);
  if (!row) return false;
  return setRowAssignment(row, value, [], doc);
}

function setEbcAssignment(rows: any[], dirigente: string, leitor: string, doc: any): boolean {
  if (!dirigente && !leitor) return false;

  let rowMatch = firstRowContaining(rows, s => compact(s).includes('DIRIGENTE/LEITOR:'));
  let row = rowMatch.row;

  if (!row) {
    for (const info of findNvcRows(rows)) {
      if (info.kind === 'ebc') {
        row = info.row;
        break;
      }
    }
  }

  if (!row) return false;

  let combined = '';
  if (dirigente) {
    combined = `Dirigente: ${dirigente}`;
  }
  if (leitor) {
    if (combined) combined += ' / ';
    combined += `Leitor: ${leitor}`;
  }

  return setRowAssignment(row, combined, ['DIRIGENTE/LEITOR:'], doc);
}

function optimizeDocxLayout(root: any, tblEntries: { ti: number; tbl: any; rows: any[] }[]): void {
  const doc = root.ownerDocument || root;

  // 1. Margens da Página: 0.375 polegadas (540 dxa ~ 0.95 cm) para aproveitamento ideal sem estourar página
  const sectPrs = findDescendants(root, 'sectPr');
  for (const sectPr of sectPrs) {
    let pgMar = findChildren(sectPr, 'pgMar')[0];
    if (!pgMar) {
      pgMar = doc.createElementNS(W_NS, 'w:pgMar');
      sectPr.appendChild(pgMar);
    }
    pgMar.setAttributeNS(W_NS, 'w:top', '540');
    pgMar.setAttributeNS(W_NS, 'w:bottom', '540');
    pgMar.setAttributeNS(W_NS, 'w:left', '540');
    pgMar.setAttributeNS(W_NS, 'w:right', '540');
    pgMar.setAttributeNS(W_NS, 'w:header', '280');
    pgMar.setAttributeNS(W_NS, 'w:footer', '280');
    pgMar.setAttributeNS(W_NS, 'w:gutter', '0');
  }

  // 2. Remove quaisquer quebras de página existentes (br type="page" e pageBreakBefore)
  // para evitar quebras duplicadas que causam páginas em branco.
  const allBrs = findDescendants(root, 'br');
  for (const br of allBrs) {
    const type = br.getAttributeNS(W_NS, 'w:type') || br.getAttribute('w:type');
    if (type === 'page') {
      const parent = br.parentNode;
      if (parent) parent.removeChild(br);
    }
  }

  const allPageBreakBefores = findDescendants(root, 'pageBreakBefore');
  for (const pbb of allPageBreakBefores) {
    const parent = pbb.parentNode;
    if (parent) parent.removeChild(pbb);
  }

  // 3. Compacta tabelas e células para garantir que cada semana caiba com folga em 1 página
  tblEntries.forEach(({ tbl, rows }) => {
    let tblPr = findChildren(tbl, 'tblPr')[0];
    if (!tblPr) {
      tblPr = doc.createElementNS(W_NS, 'w:tblPr');
      tbl.insertBefore(tblPr, tbl.firstChild);
    }
    let tblCellMar = findChildren(tblPr, 'tblCellMar')[0];
    if (!tblCellMar) {
      tblCellMar = doc.createElementNS(W_NS, 'w:tblCellMar');
      tblPr.appendChild(tblCellMar);
    }

    const setMar = (tag: string, val: string) => {
      let m = findChildren(tblCellMar, tag)[0];
      if (!m) {
        m = doc.createElementNS(W_NS, `w:${tag}`);
        tblCellMar.appendChild(m);
      }
      m.setAttributeNS(W_NS, 'w:w', val);
      m.setAttributeNS(W_NS, 'w:type', 'dxa');
    };
    setMar('top', '20');
    setMar('bottom', '20');
    setMar('left', '50');
    setMar('right', '50');

    for (const row of rows) {
      let trPr = findChildren(row, 'trPr')[0];
      if (!trPr) {
        trPr = doc.createElementNS(W_NS, 'w:trPr');
        row.insertBefore(trPr, row.firstChild);
      }
      if (!findChildren(trPr, 'cantSplit').length) {
        const cantSplit = doc.createElementNS(W_NS, 'w:cantSplit');
        trPr.appendChild(cantSplit);
      }
      const trHeights = findChildren(trPr, 'trHeight');
      for (const th of trHeights) {
        th.setAttributeNS(W_NS, 'w:hRule', 'atLeast');
        th.setAttributeNS(W_NS, 'w:val', '200');
      }

      const cells = rowCells(row);
      for (const cell of cells) {
        const paragraphs = findDescendants(cell, 'p');
        for (const p of paragraphs) {
          let pPr = findChildren(p, 'pPr')[0];
          if (!pPr) {
            pPr = doc.createElementNS(W_NS, 'w:pPr');
            p.insertBefore(pPr, p.firstChild);
          }
          let spacing = findChildren(pPr, 'spacing')[0];
          if (!spacing) {
            spacing = doc.createElementNS(W_NS, 'w:spacing');
            pPr.appendChild(spacing);
          }
          spacing.setAttributeNS(W_NS, 'w:before', '0');
          spacing.setAttributeNS(W_NS, 'w:after', '0');
          spacing.setAttributeNS(W_NS, 'w:line', '200');
          spacing.setAttributeNS(W_NS, 'w:lineRule', 'auto');
        }

        const runs = findDescendants(cell, 'r');
        for (const run of runs) {
          const rprs = findChildren(run, 'rPr');
          for (const rpr of rprs) {
            const szs = findChildren(rpr, 'sz');
            for (const sz of szs) {
              const currentSz = parseInt(sz.getAttributeNS(W_NS, 'w:val') || sz.getAttribute('w:val') || '0', 10);
              if (currentSz > 16) {
                sz.setAttributeNS(W_NS, 'w:val', '16');
              }
            }
            const szCss = findChildren(rpr, 'szCs');
            for (const szCs of szCss) {
              const currentSz = parseInt(szCs.getAttributeNS(W_NS, 'w:val') || szCs.getAttribute('w:val') || '0', 10);
              if (currentSz > 16) {
                szCs.setAttributeNS(W_NS, 'w:val', '16');
              }
            }
          }
        }
      }
    }
  });

  // 4. Limpa o corpo do documento e insere EXATAMENTE UMA quebra de página limpa entre cada tabela semanal
  const body = findChildren(root, 'body')[0];
  if (body && tblEntries.length > 0) {
    const tableNodes = tblEntries.map(e => e.tbl);
    const bodyChildren = Array.from(body.childNodes || []);

    // Remove parágrafos vazios ou desnecessários entre tabelas no body
    for (const child of bodyChildren as any[]) {
      if (isTag(child, 'p')) {
        const txt = textFromParagraph(child).trim();
        if (!txt) {
          body.removeChild(child);
        }
      }
    }

    // Insere exatamente uma quebra de página controlada entre tabelas consecutivas
    for (let i = 0; i < tableNodes.length - 1; i++) {
      const nextTbl = tableNodes[i + 1];

      const breakP = doc.createElementNS(W_NS, 'w:p');
      const pPr = doc.createElementNS(W_NS, 'w:pPr');
      const spacing = doc.createElementNS(W_NS, 'w:spacing');
      spacing.setAttributeNS(W_NS, 'w:before', '0');
      spacing.setAttributeNS(W_NS, 'w:after', '0');
      spacing.setAttributeNS(W_NS, 'w:line', '20');
      spacing.setAttributeNS(W_NS, 'w:lineRule', 'exact');
      pPr.appendChild(spacing);
      breakP.appendChild(pPr);

      const r = doc.createElementNS(W_NS, 'w:r');
      const br = doc.createElementNS(W_NS, 'w:br');
      br.setAttributeNS(W_NS, 'w:type', 'page');
      r.appendChild(br);
      breakP.appendChild(r);

      body.insertBefore(breakP, nextTbl);
    }
  }
}

async function replaceDocx(fileBuffer: Buffer, weeks: any[]): Promise<Buffer> {
  const zip = await JSZip.loadAsync(fileBuffer);
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('word/document.xml não encontrado no arquivo DOCX.');
  }

  const xmlString = await docXmlFile.async('text');
  const parser = new DOMParser();
  const root = parser.parseFromString(xmlString, 'text/xml');
  const tblEntries = tableRows(root);

  function getName(entry: any): string {
    if (!entry) return '';
    if (typeof entry === 'object' && entry.name) {
      return entry.name;
    }
    return String(entry || '');
  }

  for (const w of weeks) {
    if (w.skipped) continue;
    const tableIndex = parseInt(w.tableIndex ?? -1, 10);
    const matchingTbl = tblEntries.find(t => t.ti === tableIndex);
    if (!matchingTbl) continue;

    const rows = matchingTbl.rows;
    const roles = w.roles || {};

    // PRESIDÊNCIA
    const presVal = getName(roles.presidencia);
    if (presVal) {
      const presRow = firstRowContaining(rows, s => compact(s).includes('PRESIDENTE:'));
      if (presRow.row) {
        setRowAssignment(presRow.row, presVal, ['PRESIDENTE:'], root);
      }
    }

    // DISCURSO 1
    const disc1Val = getName(roles.discurso1);
    if (disc1Val) {
      const disc1Row = firstRowContaining(rows, s => /\b1\./.test(s) && !compact(s).includes('JOIAS ESPIRITUAIS') && compact(s).includes('ESCOLHER UM ITEM'));
      if (disc1Row.row) {
        setRowAssignment(disc1Row.row, disc1Val, [], root);
      }
    }

    // JOIAS
    const joiasVal = getName(roles.joias);
    if (joiasVal) {
      const joiasRow = firstRowContaining(rows, s => s.includes('2.') && compact(s).includes('JOIAS ESPIRITUAIS'));
      if (joiasRow.row) {
        setRowAssignment(joiasRow.row, joiasVal, [], root);
      }
    }

    // ORAÇÕES
    const prayers: any[] = [];
    for (const row of rows) {
      if (compact(xmlText(row)).includes('ORAÇÃO:')) {
        prayers.push(row);
      }
    }

    const initVal = getName(roles.oracaoInicial);
    if (initVal && prayers.length >= 1) {
      setRowAssignment(prayers[0], initVal, ['ORAÇÃO:'], root);
    }

    const finalVal = getName(roles.oracaoFinal);
    if (finalVal && prayers.length >= 2) {
      setRowAssignment(prayers[1], finalVal, ['ORAÇÃO:'], root);
    }

    // NOSSA VIDA CRISTÃ
    const nvcAssignments = w.nvcAssignments || [];
    for (const assignment of nvcAssignments) {
      const value = clean(assignment.value || '');
      if (!value) continue;
      const rowIndex = parseInt(assignment.rowIndex, 10);
      if (isNaN(rowIndex) || rowIndex < 0 || rowIndex >= rows.length) continue;

      const row = rows[rowIndex];
      const validSlot = findNvcRows(rows).some(info => info.kind === 'nvc' && info.rowIndex === rowIndex);
      if (!validSlot) continue;

      setRowAssignment(row, value, [], root);
    }

    // COMPATIBILIDADE
    if (!nvcAssignments.length) {
      const part7 = getName(roles.part7);
      if (part7) setNvcPartAssignment(rows, 7, part7, root);

      const part8 = getName(roles.part8);
      if (part8) setNvcPartAssignment(rows, 8, part8, root);

      if (!part7 && !part8 && w.considerations && w.considerations.length > 0) {
        if (w.considerations[0]) {
          setNvcPartAssignment(rows, 7, w.considerations[0], root);
        }
      }
    }

    // EBC
    const dirigente = getName(roles.dirigenteEbc);
    const leitor = getName(roles.leitorEbc);
    if (dirigente || leitor) {
      setEbcAssignment(rows, dirigente, leitor, root);
    }

    // NECESSIDADES LOCAIS
    const needs = getName(roles.necessidadesLocais);
    if (needs) {
      const needsRow = firstRowContaining(rows, s => compact(s).includes('NECESSIDADES LOCAIS'));
      if (needsRow.row) {
        setRowAssignment(needsRow.row, needs, [], root);
      }
    }

    // GARANTIA FINAL DA COR AZUL
    for (const info of findNvcRows(rows)) {
      if (info.kind !== 'nvc') continue;
      const cells = rowCells(info.row);
      if (!cells.length) continue;
      const target = cells[cells.length - 1];
      if (clean(textFromCell(target))) {
        ensureBlueCellRuns(target, root);
      }
    }
  }

  // OTIMIZAÇÃO DE LAYOUT: CADA SEMANA EM 1 PÁGINA
  optimizeDocxLayout(root, tblEntries);

  const serializer = new XMLSerializer();
  const updatedXml = serializer.serializeToString(root);
  zip.file('word/document.xml', updatedXml);

  const updatedBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  return updatedBuffer;
}

// ============================================================
// ROTAS
// ============================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/parse', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file || !file.originalname.toLowerCase().endsWith('.docx')) {
      return res.status(400).json({ error: 'Envie um arquivo .docx.' });
    }

    const weeks = await parseDoc(file.buffer, file.originalname);

    return res.json({
      filename: file.originalname,
      weeks,
      fileBase64: file.buffer.toString('hex'),
      rules: {
        notEbcDirigentes: Array.from(NOT_EBC_DIRIGENTES).sort(),
        ebcEligibleElders: ebcEligibleElders(),
        notPresidents: Array.from(NOT_PRESIDENTS).sort(),
        presidentEligibleElders: presidentEligibleElders(),
        discurso1Weights: Object.fromEntries(
          [...ELDERS, ...SERVOS].map(name => [name, discurso1Weight(name)])
        ),
        nvcAssignmentDetection: 'structural-row-index',
        nvcSlotsAreGeneric: true
      }
    });
  } catch (error: any) {
    console.error('Erro em /api/parse:', error);
    return res.status(400).json({
      error: `Não foi possível ler o DOCX: ${error?.message || error}`
    });
  }
});

app.post('/api/export', async (req, res) => {
  try {
    const { fileHex, filename, weeks } = req.body || {};
    if (!fileHex) {
      return res.status(400).json({ error: 'Arquivo original não encontrado.' });
    }

    const rawBuffer = Buffer.from(fileHex, 'hex');
    const outputBuffer = await replaceDocx(rawBuffer, weeks || []);

    const dlName = (filename || 'programacao.docx').replace(/\.[^/.]+$/, '') + '_preenchida.docx';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(dlName)}"`);
    return res.send(outputBuffer);
  } catch (error: any) {
    console.error('Erro em /api/export:', error);
    return res.status(400).json({
      error: `Falha ao gerar DOCX: ${error?.message || error}`
    });
  }
});

// Serve static assets from public/
const publicDir = path.join(process.cwd(), 'public');
app.use('/static', express.static(path.join(publicDir, 'static')));
app.use(express.static(publicDir));

// Fallback handler for SPA without Express 5 wildcard path-to-regexp error
app.use((req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
