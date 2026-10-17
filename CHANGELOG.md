# Changelog

## 0.2.0

- New **Remove Background** operation. It returns an SVG without the background and a transparent PNG. By default it vectorizes the image first.
- New **Recolor SVG** and **Simplify SVG Colors** operations. They use no credits.
- New **Image URL** input for images up to 20 MB, downloaded by SVG.new.
- Results over 3 MB, which SVG.new returns as links, are downloaded by the node.
- Clearer errors for an invalid API key, no credits left and the rate limit.
- Output files are named after the input file.
- Light and dark icons, and an icon on the credential.
- Built, linted and released with the n8n node CLI (`@n8n/node-cli`). Published from GitHub Actions with npm provenance.
- Version 0.1 parameters still work: the operation defaults to Vectorize Image.

## 0.1.2

- Credential test.

## 0.1.1

- Published from GitHub Actions with npm provenance.

## 0.1.0

- First release: Vectorize, from binary data or a base64 data URL.
