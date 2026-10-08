# MCC/MNC Data Tool

[![npm](https://img.shields.io/npm/v/mcc-mnc-tool)](https://www.npmjs.com/package/mcc-mnc-tool)

Simple CLI tool to fetch and parse the latest MCC/MNC data from ITU-T E.212 documents.

## About

This tool automatically:
- Downloads the latest E.212 document from ITU website
- Extracts Mobile Country Codes (MCC) and Mobile Network Codes (MNC)
- Saves the data in a structured JSON format

The ITU publishes the list as a Word document. This tool, written in December 2024, turns it into JSON.

## Installation

Run it without installing:

```bash
npx mcc-mnc-tool
```

Or clone the repository:

```bash
git clone https://github.com/meros/mcc-mnc-tool.git
cd mcc-mnc-tool
npm install
```

## Usage

### Basic usage (writes `./data.json`):

```bash
node index.mjs
```

### Specify custom output path:

```bash
node index.mjs --output ./custom-path.json
```

### Show help:

```bash
node index.mjs --help
```

### Using npx:

```bash
npx mcc-mnc-tool --output ./mcc-mnc.json
```

## Output Format

The tool generates a JSON file with the following structure:

```json
{
    "metadata": {
        "generated": "2024-03-15T12:34:56.789Z",
        "source": "https://www.itu.int/...",
        "etag": "\"abc123\""
    },
    "areas": {
        "united states": [
            {
                "name": "Verizon Wireless",
                "mcc": "310",
                "mnc": "004"
            }
        ]
    },
    "areaNames": [
        "United States",
        "Canada"
    ]
}
```

## Requirements

- Node.js 20.18.1 or later (required by cheerio 1.2)
- Internet connection to fetch ITU documents

## Development

```bash
npm test
```

The test runs the tool against the live ITU website, so it needs an internet connection and fails if the ITU page changes.

## Status

Version 1.0.8 is published on npm. If the ITU changes its page or document layout, the parser will need an update.

## License

MIT. See [LICENSE](LICENSE).

## Author

Alexander Schrab
