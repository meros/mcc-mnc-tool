#!/usr/bin/env node

/**
 * MCC/MNC Data Updater
 * ====================
 * 
 * Downloads and parses the latest MCC/MNC data from ITU-T E.212 documents.
 * 
 * This script:
 * 1. Fetches the latest E.212 document from ITU website
 * 2. Converts the DOCX to HTML
 * 3. Extracts MCC/MNC data from tables
 * 4. Saves the data as JSON
 * 
 * Usage:
 *   node index.mjs [options]
 * 
 * Options:
 *   --output, -o    Output file path (default: ./data.json)
 *   --help, -h      Show this help message
 * 
 * Example:
 *   node index.mjs --output ./custom-path.json
 * 
 * @author Alexander Schrab
 * @license MIT
 */

import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs/promises";
import mammoth from "mammoth";
import path from "path";
import { fileURLToPath } from "url";

const CONFIG = {
  BASE_URL: 'https://www.itu.int',
  DOCS_PATH: '/pub/T-SP-E.212B',
  DEFAULT_OUTPUT: 'data.json'
};

const colors = {
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`, 
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`
};

class SimpleSpinner {
  constructor(text) {
    this.text = text;
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.interval = null;
    this.currentFrame = 0;
  }

  start() {
    process.stdout.write('\n');
    this.interval = setInterval(() => {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`${this.frames[this.currentFrame]} ${this.text}`);
      this.currentFrame = ++this.currentFrame % this.frames.length;
    }, 80);
  }

  stop(success = true) {
    clearInterval(this.interval);
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    const symbol = success ? '✓' : '✗';
    const color = success ? colors.green : colors.red;
    process.stdout.write(`${color(symbol)} ${this.text}\n`);
  }
}

function showHelp() {
  console.log(`
MCC/MNC Data Updater
===================

Downloads and parses the latest MCC/MNC data from ITU-T E.212 documents.

Usage:
  node index.mjs [options]

Options:
  --output, -o    Output file path (default: ./data.json)
  --help, -h      Show this help message

Example:
  node index.mjs --output ./custom-path.json
`);
  process.exit(0);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let outputPath = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      showHelp();
    }
    
    if (arg === '--output' || arg === '-o') {
      outputPath = args[i + 1];
      if (!outputPath) {
        console.error('Error: Missing output path argument');
        showHelp();
      }
      i++;
    }
  }

  return outputPath;
}

/**
 * @typedef {Object} MccMncEntry
 * @property {string} name
 * @property {string} mcc
 * @property {string} mnc
 */

/**
 * @typedef {Object} ParsedData
 * @property {Object.<string, MccMncEntry[]>} areas
 * @property {string[]} areaNames
 */

/**
 * @param {string} html
 * @returns {ParsedData}
 */
function parseTable(html) {
  const $ = cheerio.load(html);
  const $mainTable = $('table')[1];
  const $rows = $('tbody tr', $mainTable);

  const areas = {};
  const areaNames = [];
  let currentArea;
  
  $rows.each((i, $row) => {
    const firstTd = $('td:first-child', $row);
    const rowspan = Number(firstTd.attr('rowspan'));
    const isFirstEntry = !!rowspan;

    if (isFirstEntry) {
      const areaName = firstTd.text().trim();
      areaNames.push(areaName);
      currentArea = areaName.toLocaleLowerCase();
      areas[currentArea] = [];
      return;
    }

    const name = $('td:nth-child(1)', $row).text().trim();
    const [mcc, mnc] = $('td:nth-child(2)', $row).text().trim().split(' ');

    areas[currentArea].push({ name, mcc, mnc });
  });

  return { areas, areaNames };
}

/**
 * @returns {Promise<string>}
 */
async function getLatestDocxUrl() {
  const { data: docsPage } = await axios.get(`${CONFIG.BASE_URL}${CONFIG.DOCS_PATH}`);
  const $ = cheerio.load(docsPage);
  
  const overviewPath = $('.producttitle .title:last-of-type').attr('href')?.trim();
  if (!overviewPath) throw new Error('Could not find document overview path');
  
  const { data: overviewPage } = await axios.get(`${CONFIG.BASE_URL}/pub/${overviewPath}`);
  const $overview = cheerio.load(overviewPage);
  
  const docxPath = $overview('.itemtable a[href$=".docx"]').attr('href');
  if (!docxPath) throw new Error('Could not find DOCX download link');
  
  return `${CONFIG.BASE_URL}${docxPath}`;
}

/**
 * @param {string} [outputPath]
 */
async function main() {
  const startTime = Date.now();
  const spinner = new SimpleSpinner('');
  
  try {
    const outputPath = parseArgs();
    const finalPath = outputPath || path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      CONFIG.DEFAULT_OUTPUT
    );

    console.log(colors.bold('\n📱 MCC/MNC Data Updater\n'));

    spinner.text = 'Fetching latest document URL...';
    spinner.start();
    const docxUrl = await getLatestDocxUrl();
    spinner.stop();

    spinner.text = 'Downloading document...';
    spinner.start();
    const { data: docx, headers } = await axios.get(docxUrl, { responseType: 'arraybuffer' });
    spinner.stop();

    spinner.text = 'Converting to HTML...';
    spinner.start();
    const { value: html } = await mammoth.convertToHtml({ buffer: docx });
    spinner.stop();

    spinner.text = 'Parsing data...';
    spinner.start();
    const data = parseTable(html);
    spinner.stop();

    const output = {
      metadata: {
        generated: new Date().toISOString(),
        source: docxUrl,
        etag: headers.etag
      },
      ...data
    };

    await fs.writeFile(finalPath, JSON.stringify(output, null, 2));

    const fileSize = (await fs.stat(finalPath)).size;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const entriesCount = Object.values(data.areas).flat().length;

    console.log('\n' + colors.green('✨ Success!'));
    console.log(colors.dim(`
📁 Output file: ${finalPath}
📊 File size: ${(fileSize / 1024).toFixed(1)} KB
⏱️  Duration: ${duration}s
📱 Areas: ${Object.keys(data.areas).length}
📝 Entries: ${entriesCount}
`));

  } catch (error) {
    spinner?.stop(false);
    console.error(colors.red('\n✗ Error: ' + error.message));
    process.exit(1);
  }
}

await main();