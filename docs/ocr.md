# OCR for scanned chart PDFs

Free Chart Scan scrapes the PDF text layer first. If the layer is thin (&lt; ~80 chars), OCR runs when configured.

## Providers

### 1. Webhook (any OCR service)

```bash
OCR_PROVIDER=webhook   # optional if only webhook is set
OCR_WEBHOOK_URL=https://your-ocr.example/v1/extract
OCR_WEBHOOK_SECRET=... # optional Bearer
OCR_WEBHOOK_TIMEOUT_MS=25000
```

**Request:** JSON `{ fileName, mimeType, contentBase64, sizeBytes }`  
**Response:** `{ "text": "..." }` (also accepts `fullText`, `pages[].text`, Azure-style `analyzeResult.content`)

### 2. Azure AI Document Intelligence (production)

```bash
OCR_PROVIDER=azure
AZURE_DOC_INTEL_ENDPOINT=https://YOUR_RESOURCE.cognitiveservices.azure.com
AZURE_DOC_INTEL_KEY=...
# optional:
# AZURE_DOC_INTEL_API_VERSION=2024-11-30
```

Uses **prebuilt-read**: async analyze + poll (up to ~45s). Suitable for multi-page scanned episodes.

## PHI note

OCR vendors process document bytes — complete a BAA with Azure (or your webhook host) before identifiable PHI Free Scans.

## Status

`GET /api/launch-status` → `checks.ocr`
