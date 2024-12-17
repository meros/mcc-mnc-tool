# MCC/MNC Data Tool 📱

Simple CLI tool to fetch and parse the latest MCC/MNC data from ITU-T E.212 documents.

## About

This tool automatically:
- Downloads the latest E.212 document from ITU website
- Extracts Mobile Country Codes (MCC) and Mobile Network Codes (MNC)
- Saves the data in a structured JSON format

## Installation

```bash
# Clone repository
git clone https://github.com/username/mcc-tool.git
cd mcc-tool

# Install dependencies
npm install
```

## Usage

### Basic usage with default output path:

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
npx mcc-mnc-tool
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

- Node.js 18 or later
- Internet connection to fetch ITU documents

## Development

To contribute:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details.

## Author

Alexander Schrab
