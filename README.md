# n8n-nodes-svgnew

Remove background and vectorize images in [n8n](https://n8n.io/) workflows with [SVG.new](https://svg.new). You can also recolor an SVG or reduce its colors.

This is an n8n community node. It calls the [SVG.new API](https://svg.new/developers) and needs an SVG.new API key.

- [Installation](#installation)
- [Operations](#operations)
- [Credentials](#credentials)
- [Inputs and outputs](#inputs-and-outputs)
- [Example workflows](#example-workflows)
- [Limits](#limits)
- [Compatibility](#compatibility)
- [Resources](#resources)
- [Version history](#version-history)

## Installation

On a self-hosted n8n, go to **Settings > Community Nodes**, select **Install**, enter `n8n-nodes-svgnew` and confirm. See n8n's [community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) for details.

After n8n verifies the node, it also appears in the nodes panel of n8n Cloud and of self-hosted instances that show verified community nodes. Search for **SVG.new**.

## Operations

| Operation | What it does | Credits |
| --- | --- | --- |
| **Remove Background** | Removes the background from an image. Returns an SVG without the background shapes and a transparent PNG. By default it vectorizes the image first; you can also give it an SVG you already have. | 2 when it vectorizes first, otherwise 1 |
| **Vectorize Image** | Converts a PNG, JPEG or WebP image to an SVG. | 1 |
| **Recolor SVG** | Replaces colors in an SVG. Each shape filled with a "From" color gets its "To" color. | 0 |
| **Simplify SVG Colors** | Reduces an SVG to at most a set number of colors (1 to 256) by merging similar colors. | 0 |

Credits come from your SVG.new account. A free account gets 1 credit a day. Paid plans are listed at [svg.new/pricing](https://svg.new/pricing).

The node can also be used as a tool by the n8n AI Agent node.

## Credentials

1. Sign in at [svg.new](https://svg.new) and open [your account page](https://svg.new/account).
2. Under **API keys**, create a key. Keys start with `svk_`.
3. In n8n, create an **SVG.new API** credential and paste the key.

n8n tests the credential by listing one of your past vectorizations. The test uses no credits.

The node sends the key as a Bearer token to `https://svg.new` and to no other host.

## Inputs and outputs

### Image input (Remove Background, Vectorize Image)

- **Binary File**: an image from a previous node, such as HTTP Request, Form Trigger or Read/Write Files from Disk. Up to 3 MB.
- **Image URL**: a public HTTPS link. SVG.new downloads the image itself, up to 20 MB.
- **Base64 Data URL**: such as `data:image/png;base64,...`. Up to 3 MB.

### SVG input (Remove Background, Recolor SVG, Simplify SVG Colors)

- **Binary File**: an SVG file from a previous node. Up to 3 MB.
- **SVG Text**: SVG markup, such as the `svg` field from an earlier SVG.new step. Up to 3 MB.
- **SVG URL**: a public HTTPS link to an SVG file, up to 20 MB.

For Remove Background, an existing SVG must have been made from the same image. The default, **Vectorize the Image First**, needs no SVG.

### Output

Every operation returns one item per input item:

- `json.svg`: the SVG markup.
- `binary.data`: the same SVG as a file (`image/svg+xml`).

Some operations add more:

- **Vectorize Image**: `json.id` (the vectorization ID on SVG.new) and `json.metadata` (`created_at`, `credits_remaining`).
- **Remove Background**: `binary.transparentImage`, the image with a transparent background as a PNG. When it vectorizes first, also `json.id` and `json.metadata`.
- **Simplify SVG Colors**: `json.colorsBefore` and `json.colorsAfter`.

File names follow the input file, for example `logo.png` becomes `logo.svg` or `logo-no-background.svg`.

SVG.new returns results over 3 MB as one-hour download links. The node downloads them, so the output looks the same either way.

## Example workflows

**Remove the background from product photos**

1. **Google Drive Trigger** (or any trigger) when a photo is added to a folder.
2. **Google Drive: Download File**.
3. **SVG.new: Remove Background** with Image Input set to Binary File.
4. **Google Drive: Upload File** for `transparentImage` (PNG) and `data` (SVG).

**Vectorize an image from a URL**

1. **Webhook** that receives `{ "url": "https://..." }`.
2. **SVG.new: Vectorize Image** with Image Input set to Image URL and the URL set to `{{ $json.body.url }}`.
3. **Respond to Webhook** with the `svg` field.

**Make a one-color logo from an upload**

1. **Form Trigger** with a file field.
2. **SVG.new: Remove Background**.
3. **SVG.new: Simplify SVG Colors** with SVG Input set to Binary File and Max Colors set to 1.
4. **Send Email** with the `data` binary field attached.

## Limits

- Images and SVGs sent from n8n (binary, text or data URL) can be up to 3 MB. Use a URL input for files up to 20 MB.
- SVG.new allows 10 vectorizations a minute per account.
- Errors from SVG.new, such as an invalid key or no credits left, show SVG.new's message and a suggested next step. Turn on **Continue On Fail** to keep the workflow running and get the error in `json.error`.

## Compatibility

Built with the n8n node CLI (`@n8n/node-cli` 0.52) and `n8n-workflow` 2.x. The package has no runtime dependencies.

Version 0.2 keeps the parameters of 0.1, so existing workflows keep vectorizing as before.

## Resources

- [SVG.new](https://svg.new)
- [SVG.new API documentation](https://svg.new/developers)
- [SVG.new and n8n](https://svg.new/n8n)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Report an issue](https://github.com/svgnew/n8n/issues)

## Version history

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE.md)
