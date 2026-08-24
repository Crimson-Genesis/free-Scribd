# Scribd to 1:1 PDF Studio

A high-fidelity web application designed to parse, extract, and convert Scribd document web pages into standalone, search-selectable 1:1 PDF files with accurate vector typography and composited image sprite layers.

## Overview

The engine accurately preserves original document layout details:
- **1:1 Vector Rendering**: Preserves original fonts, positions, line heights, and multi-column academic paper structures.
- **Image Sprite Compositing**: Parses `<img class="absimg">` sprite fragments with precise CSS `clip: rect(...)` cropping.
- **Standalone Selectable Text**: Embeds Noto Sans and Google Fonts with selectable text search capability.
- **Animated Particle Canvas**: Smooth ambient background particle animation supporting both Dark and Light modes.
- **Circular Ripple View Transitions**: View Transition API animated theme toggle.
- **Responsive Mobile & Desktop Layout**: Single-viewport fixed desktop workspace and scrollable mobile layout.
- **Anti-Spam Toast Notifications**: Bottom-right de-duplicated notification stack.

## Architecture

- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Lucide Icons, Sonner.
- **Backend Engine**: Python (`reportlab`, `Pillow`, `BeautifulSoup4`).

## Setup and Usage

### Prerequisites
- Node.js (v18+)
- Python 3.10+ with `reportlab`, `Pillow`, `beautifulsoup4`

### Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build production bundle
npm run build
```

## License

MIT License.
