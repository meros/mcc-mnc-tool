import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import { deflateRawSync } from "node:zlib";
import { parseDocumentXml, parseDocx, readZipEntry } from "../lib.mjs";

// Same structure as word/document.xml in T-SP-E.212B-2023-MSW-E.docx.
const xml = await fs.readFile(new URL("./fixture-document.xml", import.meta.url), "utf8");

/** Build a minimal ZIP archive. `method` 0 stores, 8 deflates. */
function makeZip(files, method = 8) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const raw = Buffer.from(content);
    const data = method === 8 ? deflateRawSync(raw) : raw;
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

test("parses areas in document order", () => {
  const { areaNames } = parseDocumentXml(xml);
  assert.deepEqual(areaNames, ["Afghanistan", "Georgia", "Kosovo", "Türkiye"]);
});

test("parses entries into lower-case area keys", () => {
  const { areas } = parseDocumentXml(xml);
  assert.deepEqual(areas.afghanistan, [
    { name: "AWCC", mcc: "412", mnc: "01" },
    { name: "Roshan", mcc: "412", mnc: "20" },
  ]);
});

test("cleans names: whitespace, XML entities and paragraphs", () => {
  const { areas } = parseDocumentXml(xml);
  assert.deepEqual(areas.georgia.map((e) => e.name), ["GLOBALCELL LTD", "AT&T Georgia (test)"]);
});

test("removes footnote markers from area names", () => {
  const { areas } = parseDocumentXml(xml);
  assert.deepEqual(areas.kosovo, [{ name: "Telecom of Kosovo J.S.C.", mcc: "221", mnc: "01" }]);
});

test("skips header and empty rows, keeps areas without entries", () => {
  const { areas } = parseDocumentXml(xml);
  assert.deepEqual(areas["türkiye"], []);
  assert.equal(areas["country or geographical area"], undefined);
});

test("reads only the first area table", () => {
  const { areas } = parseDocumentXml(xml);
  assert.ok(!Object.values(areas).flat().some((e) => e.mcc === "901"));
  assert.equal(areas.shared, undefined);
});

test("fails when there is no area table", () => {
  assert.throws(() => parseDocumentXml("<w:document><w:body/></w:document>"), /Could not find/);
});

for (const method of [0, 8]) {
  test(`reads a ZIP entry (method ${method})`, () => {
    const zip = makeZip({ "a.txt": "first", "word/document.xml": "<x>ä</x>" }, method);
    assert.equal(readZipEntry(zip, "word/document.xml").toString("utf8"), "<x>ä</x>");
    assert.throws(() => readZipEntry(zip, "missing.xml"), /not found/);
  });
}

test("parses a .docx end to end", () => {
  const { areas } = parseDocx(makeZip({ "word/document.xml": xml }));
  assert.equal(Object.values(areas).flat().length, 5);
});

test("rejects a document with no entries", () => {
  const empty = xml.replace(/<w:tr><w:tc><w:tcPr><w:vMerge\/>[\s\S]*?<\/w:tr>/g, "");
  assert.throws(() => parseDocx(makeZip({ "word/document.xml": empty })), /0 entries/);
});

test("rejects data that is not a ZIP", () => {
  assert.throws(() => readZipEntry(Buffer.from("not a zip at all, just text....")), /Not a ZIP/);
});
