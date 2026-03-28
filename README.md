# n8n-nodes-svgnew

[n8n](https://n8n.io/) community node for [SVG.new](https://svg.new) — convert images to SVG vectors in your n8n workflows.

## Operations

- **Vectorize** — Convert a raster image (PNG, JPG, WebP) to a clean SVG vector
- **Recolor** — Change colors in an SVG using a color map
- **Simplify Colors** — Reduce the number of colors in an SVG

## Setup

1. Install this node in your n8n instance
2. Add SVG.new credentials with your API key from [svg.new/account](https://svg.new/account)
3. Add the SVG.new node to your workflow

## Input

The Vectorize operation accepts:
- **Binary data** from a previous node (e.g., HTTP Request, Read Binary File)
- **Base64 data URL** as a string

## Output

Returns the SVG as both:
- JSON (`svg` field with the SVG string)
- Binary data (`data` property with the SVG file)

## Links

- [SVG.new](https://svg.new)
- [API Documentation](https://svg.new/developers)
- [Get API Key](https://svg.new/account)
