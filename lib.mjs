/**
 * Fetch and parse the MCC/MNC list that the ITU publishes as an annex to
 * ITU-T E.212 (the "E.212B" list of mobile network codes).
 *
 * No dependencies: the .docx is a ZIP archive, read with node:zlib, and the
 * table is read straight from its WordprocessingML (word/document.xml).
 *
 * @author Alexander Schrab
 * @license MIT
 */

import { inflateRawSync } from "node:zlib";

export const CONFIG = {
  BASE_URL: "https://www.itu.int",
  DOCS_PATH: "/pub/T-SP-E.212B",
  TIMEOUT_MS: 60_000,
};

/**
 * @typedef {Object} MccMncEntry
 * @property {string} name
 * @property {string} mcc
 * @property {string} mnc
 */

/**
 * @typedef {Object} ParsedData
 * @property {Object.<string, MccMncEntry[]>} areas  keyed by lower-case area name
 * @property {string[]} areaNames                    area names as printed in the document
 */

/**
 * @typedef {Object} MccMncDocument
 * @property {{generated: string, source: string, etag: (string|undefined)}} metadata
 * @property {Object.<string, MccMncEntry[]>} areas
 * @property {string[]} areaNames
 */

// --- ZIP -------------------------------------------------------------------

/**
 * Read one file from a ZIP archive (stored or deflated, no ZIP64).
 *
 * @param {Buffer} zip
 * @param {string} name
 * @returns {Buffer}
 */
export function readZipEntry(zip, name) {
  // The end-of-central-directory record is in the last 22 + 65535 bytes.
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a ZIP file (no end of central directory)");

  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);

  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error("Corrupt ZIP central directory");
    const method = zip.readUInt16LE(p + 10);
    const compressedSize = zip.readUInt32LE(p + 20);
    const nameLength = zip.readUInt16LE(p + 28);
    const extraLength = zip.readUInt16LE(p + 30);
    const commentLength = zip.readUInt16LE(p + 32);
    const localOffset = zip.readUInt32LE(p + 42);
    const entryName = zip.toString("utf8", p + 46, p + 46 + nameLength);
    p += 46 + nameLength + extraLength + commentLength;

    if (entryName !== name) continue;
    if (compressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new Error("ZIP64 archives are not supported");
    }

    const local = localOffset;
    if (zip.readUInt32LE(local) !== 0x04034b50) throw new Error("Corrupt ZIP local header");
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const data = zip.subarray(start, start + compressedSize);

    if (method === 0) return data;
    if (method === 8) return inflateRawSync(data);
    throw new Error(`Unsupported ZIP compression method ${method}`);
  }

  throw new Error(`${name} not found in ZIP`);
}

// --- WordprocessingML --------------------------------------------------------

const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return XML_ENTITIES[e] ?? m;
  });
}

/** Collapse runs of whitespace (the document has double spaces in some names). */
function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * @typedef {Object} Cell
 * @property {string} text
 * @property {(undefined|"restart"|"continue")} vMerge
 */

/**
 * Split document.xml into tables of rows of cells. Header rows are skipped.
 *
 * @param {string} xml
 * @returns {Cell[][][]}
 */
export function readTables(xml) {
  const tables = [];
  const tagPattern = /<(\/?)w:(tbl|tr|tc|p|t|tab|br|vMerge|tblHeader)\b([^>]*?)(\/?)>/g;
  let table = null;
  let row = null;
  let cell = null;
  let headerRow = false;
  let textStart = -1;
  let depth = 0;
  let m;

  while ((m = tagPattern.exec(xml))) {
    const [, closing, tag, attrs, selfClosing] = m;
    const open = !closing;

    if (tag === "tbl") {
      depth += open ? 1 : -1;
      // Only top-level tables; the E.212B list has no nested tables.
      if (open && depth === 1) table = [];
      if (!open && depth === 0) {
        tables.push(table);
        table = null;
      }
      continue;
    }
    if (depth !== 1 || !table) continue;

    if (tag === "tr") {
      if (open) {
        row = [];
        headerRow = false;
      } else {
        if (!headerRow) table.push(row);
        row = null;
      }
    } else if (tag === "tblHeader" && row) {
      headerRow = true;
    } else if (tag === "tc") {
      if (open) cell = { text: "", vMerge: undefined };
      else if (row && cell) {
        cell.text = cleanText(cell.text);
        row.push(cell);
        cell = null;
      }
    } else if (!cell) {
      continue;
    } else if (tag === "vMerge") {
      cell.vMerge = /w:val="restart"/.test(attrs) ? "restart" : "continue";
    } else if (tag === "p" && !open) {
      cell.text += " ";
    } else if ((tag === "tab" || tag === "br") && selfClosing) {
      cell.text += " ";
    } else if (tag === "t") {
      if (open && !selfClosing) textStart = tagPattern.lastIndex;
      else if (!open && textStart >= 0) {
        cell.text += decodeXml(xml.slice(textStart, m.index));
        textStart = -1;
      }
    }
  }

  return tables;
}

/**
 * Parse word/document.xml of the E.212B document.
 *
 * The list is the first table that groups rows by area: the area name is in a
 * vertically merged first cell, and the rows below it hold "name | MCC MNC".
 *
 * @param {string} xml
 * @returns {ParsedData}
 */
export function parseDocumentXml(xml) {
  const table = readTables(xml).find((t) => t.some((row) => row[0]?.vMerge === "restart"));
  if (!table) throw new Error("Could not find the MCC/MNC table");

  const areas = {};
  const areaNames = [];
  let currentArea;

  for (const row of table) {
    if (row[0]?.vMerge === "restart") {
      // Drop the trailing "*" note marker, e.g. "Kosovo*". Footnote references
      // carry no text in the XML, so they need no handling.
      const areaName = row[0].text.replace(/\*+$/, "").trim();
      areaNames.push(areaName);
      currentArea = areaName.toLocaleLowerCase();
      areas[currentArea] = [];
      continue;
    }

    const cells = row.filter((c) => c.vMerge !== "continue");
    const name = cells[0]?.text;
    const [mcc, mnc] = (cells[1]?.text ?? "").split(" ");
    if (!currentArea || !name || !mcc || !mnc) continue;

    areas[currentArea].push({ name, mcc, mnc });
  }

  return { areas, areaNames };
}

/**
 * Parse a downloaded E.212B .docx.
 *
 * @param {Buffer} buffer
 * @returns {ParsedData}
 */
export function parseDocx(buffer) {
  const xml = readZipEntry(buffer, "word/document.xml").toString("utf8");
  const data = parseDocumentXml(xml);
  if (Object.values(data.areas).flat().length === 0) {
    throw new Error("Parsed 0 entries; the ITU document layout may have changed");
  }
  return data;
}

// --- ITU website ---------------------------------------------------------------

async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(CONFIG.TIMEOUT_MS) });
  if (!res.ok) throw new Error(`GET ${url} failed: HTTP ${res.status}`);
  return res;
}

/**
 * Find the download URL of the newest English E.212B document (.docx).
 *
 * @returns {Promise<string>}
 */
export async function getLatestDocxUrl() {
  const docsPage = await (await get(`${CONFIG.BASE_URL}${CONFIG.DOCS_PATH}`)).text();

  // Each edition is linked as "...parent=T-SP-E.212B-<year>". Take the newest.
  const editions = [...docsPage.matchAll(/parent=(T-SP-E\.212B-(\d{4}))/g)];
  if (editions.length === 0) throw new Error("Could not find any E.212B edition");
  const [, latest] = editions.reduce((a, b) => (Number(b[2]) > Number(a[2]) ? b : a));

  const editionPage = await (await get(`${CONFIG.BASE_URL}/pub/${latest}`)).text();

  // One .docx per language; "-E.docx" is English.
  const docxPath = editionPage.match(/href="([^"]*-E\.docx)"/)?.[1];
  if (!docxPath) throw new Error(`Could not find the English .docx for ${latest}`);

  return new URL(decodeXml(docxPath), CONFIG.BASE_URL).href;
}

/**
 * Download a document and return its contents and ETag.
 *
 * @param {string} url
 * @returns {Promise<{buffer: Buffer, etag: (string|undefined)}>}
 */
export async function downloadDocx(url) {
  const res = await get(url);
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    etag: res.headers.get("etag") ?? undefined,
  };
}

/**
 * Fetch the newest list and return it in the same shape the CLI writes.
 *
 * @returns {Promise<MccMncDocument>}
 */
export async function fetchMccMnc() {
  const source = await getLatestDocxUrl();
  const { buffer, etag } = await downloadDocx(source);
  return {
    metadata: { generated: new Date().toISOString(), source, etag },
    ...parseDocx(buffer),
  };
}
