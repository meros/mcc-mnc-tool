# MCC/MNC Data Tool

[![npm](https://img.shields.io/npm/v/mcc-mnc-tool)](https://www.npmjs.com/package/mcc-mnc-tool)
[![CI](https://github.com/meros/mcc-mnc-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/meros/mcc-mnc-tool/actions/workflows/ci.yml)

A CLI and library that downloads the official list of Mobile Country Codes (MCC) and Mobile Network Codes (MNC) from the ITU and saves it as JSON.

The ITU publishes the list as a Word document, the annex to Recommendation ITU-T E.212 ("E.212B"). This tool finds the newest edition, downloads the English `.docx` and reads the table in it. It has no dependencies: it unzips the document with Node's built-in `zlib` and reads the Word XML directly.

## Usage

Run it without installing:

```bash
npx mcc-mnc-tool                          # writes ./data.json
npx mcc-mnc-tool --output ./mcc-mnc.json
```

Options:

| Option | Description |
|---|---|
| `--output`, `-o` | Output file path (default: `./data.json`) |
| `--version`, `-v` | Show the version |
| `--help`, `-h` | Show help |

Set `NO_COLOR=1` to turn off colors. Colors are also off when the output is not a terminal.

### As a library

```js
import { fetchMccMnc } from "mcc-mnc-tool";

const data = await fetchMccMnc();
console.log(data.areas.sweden);
```

`parseDocx(buffer)` parses a `.docx` that you already have.

## Output format

```json
{
  "metadata": {
    "generated": "2026-10-08T19:16:10.412Z",
    "source": "https://www.itu.int/dms_pub/itu-t/opb/sp/T-SP-E.212B-2023-MSW-E.docx",
    "etag": "\"714dc962fe16da1:0\""
  },
  "areas": {
    "afghanistan": [
      { "name": "AWCC", "mcc": "412", "mnc": "01" }
    ]
  },
  "areaNames": ["Afghanistan", "Albania"]
}
```

- `areas` is keyed by the area name in lower case. `areaNames` keeps the names as the document prints them, in document order.
- `mcc` and `mnc` are strings, so leading zeros stay (`"01"`).
- An MCC/MNC pair can occur in more than one area when networks are shared, for example `208 01` in France and Monaco.
- The tool reads only the main list. It does not read the other tables in the document, such as the shared MCC 901 networks.

## Requirements

- Node.js 22 or later
- Internet access to www.itu.int

## Development

```bash
git clone https://github.com/meros/mcc-mnc-tool.git
cd mcc-mnc-tool
npm test            # unit tests, offline
npm run test:live   # end-to-end run against the live ITU website
```

CI runs the unit tests on Node 22 and 24 for each push and pull request. Once a week, it runs the live test, so a layout change at the ITU shows up as a failed run. A GitHub release publishes the package to npm through npm trusted publishing, so the repo stores no npm token.

## Status

Maintained. The ITU publishes a new edition every few years, with amendments in its Operational Bulletin in between. This tool reads the edition document only, not the amendments.

## License

MIT. See [LICENSE](LICENSE).
