# Harbor Press Newsletter Studio

A local-first Electron application for creating newsletters, previewing attached
PDF pages, and exporting one continuous newsletter page followed by the
attachments as US Letter pages.

## Requirements

- Node.js 22.13 or newer

## Development

```bash
npm install
npm run electron:dev
```

The web editor is available at `http://localhost:3000`. Native storage and
direct PDF generation are available in the Electron window.

## Validation

```bash
npm test
npm run lint
```

## Packaging

```bash
npm run electron:pack
npm run electron:dist:mac
npm run electron:dist:win
```

Issue data, uploaded images, and attached PDFs are stored in the user’s
Documents folder under `Harbor Press Newsletter Studio`.
