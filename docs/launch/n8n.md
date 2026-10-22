# Launch checklist: n8n-nodes-svgnew 0.2.0 and n8n verification

Goal: publish 0.2.0 to npm from GitHub Actions with provenance, then submit it in the n8n Creator Portal. Once n8n verifies it, the node can be installed on n8n Cloud.

Do the steps in order. Step 3 publishes to npm as soon as the tag is pushed.

## What is ready

- Version 0.2.0 with four operations: Remove Background, Vectorize Image, Recolor SVG, Simplify SVG Colors.
- `npm run lint` (the official `n8n-node lint`, `@n8n/node-cli` 0.52.5) passes with no errors or warnings.
- The lint rules of `@n8n/scan-community-package` 0.39.0 pass on the source and on the `npm pack` tarball. The scanner can't check provenance before the package is published; that is step 4.
- No runtime dependencies. MIT licence. README with usage, credentials and example workflows.
- The credential test lists one past vectorization (`GET /api/vectorizations?limit=1`) and uses no credits.
- `npm test` runs the node against a fake n8n context: request shapes, outputs, errors. It makes no network calls.
- `.github/workflows/publish.yml` publishes on a `v*.*.*` tag with npm trusted publishing (OIDC) and provenance. It falls back to the `NPM_TOKEN` secret if trusted publishing isn't set up.

Not checked: a real conversion against svg.new (it would spend credits), and the node in the n8n editor panel (the editor needs a signed-in owner account).

## 1. Push main as the svgnew GitHub account

Never push to svgnew/n8n as dber1.

```sh
cd ~/Develop/gologo/n8n-nodes-svgnew
git log --format='%h %an <%ae> %s' origin/main..HEAD   # every line should say svgnew <contact@svg.new>
gh auth switch -u svgnew
git -c credential.helper='!gh auth git-credential' push origin main
gh auth switch -u dber1
```

Then check that CI passed (lint and tests):

```sh
gh run list -R svgnew/n8n --workflow ci.yml --limit 1
```

## 2. Set up npm trusted publishing (svgnew npm account)

The package is maintained by the svgnew npm account (`svgnew <contact@svg.new>`).

1. Sign in at [npmjs.com](https://www.npmjs.com/) as svgnew.
2. Open [n8n-nodes-svgnew > Settings](https://www.npmjs.com/package/n8n-nodes-svgnew/access).
3. Under **Trusted Publisher**, choose **GitHub Actions** and enter:
   - Organization or user: `svgnew`
   - Repository: `n8n`
   - Workflow filename: `publish.yml`
   - Environment name: leave empty
   - Allowed actions: tick **npm publish**. (Staged publishing is always allowed. The workflow runs `npm publish`, so it fails without this.)
4. Save.

A new trusted publisher must publish once within 2 days, or it expires. If that happens, delete it and add it again. So do step 3 the same day.

## 3. Push the tag that publishes

```sh
cd ~/Develop/gologo/n8n-nodes-svgnew
gh auth switch -u svgnew
git tag v0.2.0
git -c credential.helper='!gh auth git-credential' push origin v0.2.0
gh auth switch -u dber1
gh run list -R svgnew/n8n --workflow publish.yml --limit 1
```

The workflow checks that the tag matches `package.json`, runs the tests, lint and build, and publishes with provenance.

If the publish step fails with E401, E403 or E404, the trusted publisher fields from step 2 don't match, or **npm publish** isn't allowed. Fix them, then re-run the job as svgnew (`gh run rerun <run id> -R svgnew/n8n`).

## 4. Check the published package

```sh
npm view n8n-nodes-svgnew version                         # 0.2.0
npm view n8n-nodes-svgnew@0.2.0 dist.attestations         # has a provenance entry
npx @n8n/scan-community-package n8n-nodes-svgnew          # "has passed all security checks"
```

The scanner reads the source at the commit named in the provenance, so this is the same check n8n runs. 0.1.2 failed it on a missing credential icon and node subtitle; 0.2.0 fixes both.

Optional, once 0.2.0 is out: on npm, set **Publishing access** to "Require two-factor authentication and disallow tokens". Then delete the `NPM_TOKEN` secret in svgnew/n8n (Settings > Secrets and variables > Actions) and revoke that token on npm.

## 5. Submit in the n8n Creator Portal

1. Go to [creators.n8n.io/nodes](https://creators.n8n.io/nodes) and sign up or sign in. Use contact@svg.new so the portal account matches the npm maintainer and the package author.
2. Submit a node with the text below. The form wasn't visible without signing in, so the field names may differ.

**npm package name**

```
n8n-nodes-svgnew
```

**Version**

```
0.2.0
```

**GitHub repository**

```
https://github.com/svgnew/n8n
```

**Node name**

```
SVG.new
```

**Short description**

```
Remove background and vectorize images, then recolor or simplify the SVG.
```

**Description**

```
SVG.new removes backgrounds from images and converts PNG, JPEG and WebP images to SVG. The node has four operations:

- Remove Background: returns an SVG without the background and a transparent PNG. By default it vectorizes the image first.
- Vectorize Image: converts an image to an SVG.
- Recolor SVG: replaces colors in an SVG.
- Simplify SVG Colors: reduces an SVG to a set number of colors.

Images can come from a binary field, a public URL or a data URL. Results come back as SVG text and as binary files. The node works with the AI Agent node as a tool.

Authentication is an SVG.new API key. Vectorizing and removing backgrounds use SVG.new credits; recoloring and simplifying are free. A free account gets 1 credit a day.
```

**Category**

```
Utility
```

**Documentation URL**

```
https://github.com/svgnew/n8n#readme
```

**API documentation**

```
https://svg.new/developers
```

**Website**

```
https://svg.new
```

**Support email**

```
contact@svg.new
```

**How to test (notes for the reviewer)**

```
Create a free account at https://svg.new and an API key under "API keys" at https://svg.new/account. The free plan gives 1 credit a day. The credential test lists past vectorizations and uses no credits. Recolor SVG and Simplify SVG Colors use no credits; Vectorize Image uses 1 credit and Remove Background uses 2 (1 if given an existing SVG). If you need more credits to test, email contact@svg.new.
```

**Does it compete with an n8n paid feature?**

```
No. It calls the SVG.new API for image vectorization and background removal.
```

3. If the portal asks for an icon file, use `icons/svgnew.svg` from the repo.

## 6. After you submit

The portal shows "Under Review" and says reviews usually take up to 7 days. Forum posts report anything from a week to several months.

When n8n verifies the node, update [svg.new/n8n](https://svg.new/n8n). It currently says the node isn't verified and that n8n Cloud should use the HTTP Request node instead.

## Later releases

Change the code, bump `version` in `package.json`, add a line to `CHANGELOG.md`, commit as svgnew, push main, then push a `v<version>` tag as in step 3. `npm run release` also works: it bumps the version, tags and pushes with release-it, so run `gh auth switch -u svgnew` first.
