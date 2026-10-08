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
 *   mcc-mnc-tool [options]
 *
 * @author Alexander Schrab
 * @license MIT
 */

import fs from "fs/promises";
import { downloadDocx, getLatestDocxUrl, parseDocx } from "./lib.mjs";

const DEFAULT_OUTPUT = "./data.json";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const colors = {
  green: paint(32),
  red: paint(31),
  bold: paint(1),
  dim: paint(2),
};

class SimpleSpinner {
  constructor(text) {
    this.text = text;
    this.frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    this.interval = null;
    this.currentFrame = 0;
  }

  start() {
    if (process.stdout.isTTY) {
      process.stdout.write("\n");
      this.interval = setInterval(() => {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(`${this.frames[this.currentFrame]} ${this.text}`);
        this.currentFrame = ++this.currentFrame % this.frames.length;
      }, 80);
    }
  }

  stop(success = true) {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (process.stdout.isTTY) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    }
    const symbol = success ? "✓" : "✗";
    const color = success ? colors.green : colors.red;
    process.stdout.write(`${color(symbol)} ${this.text}\n`);
  }
}

const HELP = `
MCC/MNC Data Updater
====================

Downloads and parses the latest MCC/MNC data from ITU-T E.212 documents.

Usage:
  mcc-mnc-tool [options]

Options:
  --output, -o    Output file path (default: ${DEFAULT_OUTPUT})
  --version, -v   Show the version
  --help, -h      Show this help message

Example:
  mcc-mnc-tool --output ./custom-path.json
`;

async function version() {
  const pkg = JSON.parse(await fs.readFile(new URL("./package.json", import.meta.url), "utf8"));
  return pkg.version;
}

function usageError(message) {
  console.error(colors.red(`Error: ${message}`));
  console.error(HELP);
  process.exit(1);
}

async function parseArgs() {
  const args = process.argv.slice(2);
  let outputPath = DEFAULT_OUTPUT;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      console.log(HELP);
      process.exit(0);
    } else if (arg === "--version" || arg === "-v") {
      console.log(await version());
      process.exit(0);
    } else if (arg === "--output" || arg === "-o") {
      outputPath = args[++i];
      if (!outputPath) usageError("Missing output path argument");
    } else {
      usageError(`Unknown option: ${arg}`);
    }
  }

  return outputPath;
}

/**
 * Run one step with a spinner, and mark the spinner as failed if it throws.
 *
 * @template T
 * @param {SimpleSpinner} spinner
 * @param {string} text
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function step(spinner, text, fn) {
  spinner.text = text;
  spinner.start();
  try {
    const result = await fn();
    spinner.stop();
    return result;
  } catch (error) {
    spinner.stop(false);
    throw error;
  }
}

async function main() {
  const outputPath = await parseArgs();
  const startTime = Date.now();
  const spinner = new SimpleSpinner("");

  try {
    console.log(colors.bold("\n📱 MCC/MNC Data Updater\n"));

    const source = await step(spinner, "Fetching latest document URL...", getLatestDocxUrl);
    const { buffer, etag } = await step(spinner, "Downloading document...", () => downloadDocx(source));
    const data = await step(spinner, "Parsing data...", () => parseDocx(buffer));

    const output = {
      metadata: { generated: new Date().toISOString(), source, etag },
      ...data,
    };

    await fs.writeFile(outputPath, JSON.stringify(output, null, 2));

    const fileSize = (await fs.stat(outputPath)).size;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const entriesCount = Object.values(data.areas).flat().length;

    console.log("\n" + colors.green("✨ Success!"));
    console.log(colors.dim(`
📁 Output file: ${outputPath}
📊 File size: ${(fileSize / 1024).toFixed(1)} KB
⏱️  Duration: ${duration}s
📱 Areas: ${Object.keys(data.areas).length}
📝 Entries: ${entriesCount}
`));
  } catch (error) {
    console.error(colors.red("\n✗ Error: " + error.message));
    process.exit(1);
  }
}

await main();
