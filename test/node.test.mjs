// Runs the built node against a fake n8n context. No network calls: every request the node makes
// is recorded and answered here, so these tests use no SVG.new credits.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { SvgNew } = require('../dist/nodes/SvgNew/SvgNew.node.js');
const { SvgNewApi } = require('../dist/credentials/SvgNewApi.credentials.js');
const { NodeApiError, NodeOperationError } = require('n8n-workflow');

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z" fill="#ff0000"/></svg>';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function context({ params, binary, respond, download, continueOnFail = false }) {
	const requests = [];
	const node = { name: 'SVG.new', type: 'n8n-nodes-svgnew.svgNew', typeVersion: 1, parameters: {} };
	const ctx = {
		requests,
		getInputData: () => [{ json: {}, binary }],
		getNode: () => node,
		continueOnFail: () => continueOnFail,
		getNodeParameter(name, _i, fallback) {
			const value = name.split('.').reduce((v, key) => (v == null ? v : v[key]), params);
			if (value === undefined) {
				if (fallback !== undefined) return fallback;
				throw new Error(`Missing parameter ${name}`);
			}
			return value;
		},
		helpers: {
			assertBinaryData(_i, field) {
				const data = binary?.[field];
				if (!data) throw new NodeOperationError(node, `No binary field "${field}"`);
				return data;
			},
			getBinaryDataBuffer: async (_i, field) => Buffer.from(binary[field].data, 'base64'),
			prepareBinaryData: async (buffer, fileName, mimeType) => ({
				data: buffer.toString('base64'),
				fileName,
				mimeType,
			}),
			async httpRequestWithAuthentication(credential, options) {
				assert.equal(credential, 'svgNewApi');
				requests.push(options);
				return respond(options);
			},
			async httpRequest(options) {
				requests.push(options);
				return download(options);
			},
		},
	};
	return ctx;
}

const run = (ctx) => new SvgNew().execute.call(ctx);
const imageBinary = (bytes = PNG) => ({
	data: { data: bytes.toString('base64'), mimeType: 'image/png', fileName: 'logo.png' },
});

test('vectorize sends a binary image as a data URL and returns the SVG as JSON and a file', async () => {
	const ctx = context({
		params: { operation: 'vectorize', inputType: 'binary', binaryProperty: 'data' },
		binary: imageBinary(),
		respond: () => ({ id: 'p1', svg: SVG, metadata: { credits_remaining: 9 } }),
	});
	const [[item]] = await run(ctx);
	assert.equal(ctx.requests.length, 1);
	assert.equal(ctx.requests[0].method, 'POST');
	assert.equal(ctx.requests[0].url, 'https://svg.new/api/agent/vectorize');
	assert.deepEqual(ctx.requests[0].body, { image: `data:image/png;base64,${PNG.toString('base64')}` });
	assert.deepEqual(item.json, { id: 'p1', metadata: { credits_remaining: 9 }, svg: SVG });
	assert.equal(item.binary.data.fileName, 'logo.svg');
	assert.equal(item.binary.data.mimeType, 'image/svg+xml');
	assert.equal(Buffer.from(item.binary.data.data, 'base64').toString(), SVG);
	assert.deepEqual(item.pairedItem, { item: 0 });
});

test('vectorize passes an image URL through and downloads an SVG that came back as a link', async () => {
	const ctx = context({
		params: { operation: 'vectorize', inputType: 'url', imageUrl: 'https://example.com/a/cat.webp?x=1' },
		respond: () => ({ id: 'p2', svg_url: 'https://storage.example/p2.svg', metadata: {} }),
		download: () => Buffer.from(SVG),
	});
	const [[item]] = await run(ctx);
	assert.deepEqual(ctx.requests[0].body, { image_url: 'https://example.com/a/cat.webp?x=1' });
	assert.equal(ctx.requests[1].url, 'https://storage.example/p2.svg');
	assert.equal(ctx.requests[1].encoding, 'arraybuffer');
	assert.equal(item.json.svg, SVG);
	assert.equal(item.binary.data.fileName, 'cat.svg');
});

test('version 0.1 parameters (no operation, base64 input) still vectorize', async () => {
	const dataUrl = `data:image/png;base64,${PNG.toString('base64')}`;
	const ctx = context({
		params: { operation: 'vectorize', inputType: 'base64', base64Data: dataUrl },
		respond: () => ({ id: 'p3', svg: SVG, metadata: {} }),
	});
	await run(ctx);
	assert.deepEqual(ctx.requests[0].body, { image: dataUrl });
	const operation = new SvgNew().description.properties.find((p) => p.name === 'operation');
	assert.equal(operation.default, 'vectorize');
});

test('remove background vectorizes first, then sends the SVG link and the image', async () => {
	const ctx = context({
		params: { operation: 'removeBackground', inputType: 'binary', binaryProperty: 'data', svgInput: 'vectorize' },
		binary: imageBinary(),
		respond: (options) =>
			options.url.endsWith('/api/agent/vectorize')
				? { id: 'p4', svg_url: 'https://storage.example/p4.svg', metadata: { credits_remaining: 5 } }
				: { svg: SVG, svg_bytes: SVG.length, paths: 1, transparent_image: `data:image/png;base64,${PNG.toString('base64')}` },
	});
	const [[item]] = await run(ctx);
	const image = `data:image/png;base64,${PNG.toString('base64')}`;
	assert.deepEqual(ctx.requests[0].body, { image, output: 'url' });
	assert.equal(ctx.requests[1].url, 'https://svg.new/api/agent/edit/remove-background');
	assert.deepEqual(ctx.requests[1].body, { svg_url: 'https://storage.example/p4.svg', image });
	assert.deepEqual(item.json, { id: 'p4', metadata: { credits_remaining: 5 }, svg: SVG });
	assert.equal(item.binary.data.fileName, 'logo-no-background.svg');
	assert.equal(item.binary.transparentImage.fileName, 'logo-no-background.png');
	assert.equal(item.binary.transparentImage.mimeType, 'image/png');
	assert.deepEqual(Buffer.from(item.binary.transparentImage.data, 'base64'), PNG);
});

test('remove background on an existing SVG makes one call and downloads linked results', async () => {
	const ctx = context({
		params: {
			operation: 'removeBackground',
			inputType: 'url',
			imageUrl: 'https://example.com/photo.jpg',
			svgInput: 'text',
			svgText: SVG,
		},
		respond: () => ({ svg_url: 'https://storage.example/e.svg', png_url: 'https://storage.example/e.png' }),
		download: (options) => (options.url.endsWith('.svg') ? Buffer.from(SVG) : PNG),
	});
	const [[item]] = await run(ctx);
	assert.equal(ctx.requests.filter((r) => r.method === 'POST').length, 1);
	assert.deepEqual(ctx.requests[0].body, { svg: SVG, image_url: 'https://example.com/photo.jpg' });
	assert.equal(item.json.svg, SVG);
	assert.deepEqual(Buffer.from(item.binary.transparentImage.data, 'base64'), PNG);
});

test('recolor sends a color map built from the color changes', async () => {
	const ctx = context({
		params: {
			operation: 'recolor',
			svgInput: 'url',
			svgUrl: 'https://example.com/art.svg',
			colorMap: { colors: [{ from: '#ff0000', to: '#00ff00' }, { from: '#000000', to: '#ffffff' }] },
		},
		respond: () => ({ svg: SVG }),
	});
	const [[item]] = await run(ctx);
	assert.equal(ctx.requests[0].url, 'https://svg.new/api/agent/edit/recolor');
	assert.deepEqual(ctx.requests[0].body, {
		svg_url: 'https://example.com/art.svg',
		color_map: { '#ff0000': '#00ff00', '#000000': '#ffffff' },
	});
	assert.equal(item.binary.data.fileName, 'art-recolored.svg');
});

test('simplify sends max colors and returns the color counts', async () => {
	const ctx = context({
		params: { operation: 'simplify', svgInput: 'binary', svgBinaryProperty: 'data', maxColors: 4 },
		binary: { data: { data: Buffer.from(SVG).toString('base64'), mimeType: 'image/svg+xml', fileName: 'art.svg' } },
		respond: () => ({ svg: SVG, colors_before: 12, colors_after: 4 }),
	});
	const [[item]] = await run(ctx);
	assert.deepEqual(ctx.requests[0].body, { svg: SVG, max_colors: 4 });
	assert.deepEqual(item.json, { colorsBefore: 12, colorsAfter: 4, svg: SVG });
	assert.equal(item.binary.data.fileName, 'art-simplified.svg');
});

test('an image over 3 MB is refused before any request', async () => {
	const ctx = context({
		params: { operation: 'vectorize', inputType: 'binary', binaryProperty: 'data' },
		binary: imageBinary(Buffer.alloc(3_000_001)),
		respond: () => assert.fail('no request expected'),
	});
	await assert.rejects(run(ctx), (error) => {
		assert.ok(error instanceof NodeOperationError);
		assert.match(error.message, /larger than 3 MB/);
		assert.match(error.description, /Image URL/);
		return true;
	});
	assert.equal(ctx.requests.length, 0);
});

test('a credit error keeps the API message, adds a next step, and respects Continue On Fail', async () => {
	const failing = (continueOnFail) =>
		context({
			params: { operation: 'vectorize', inputType: 'url', imageUrl: 'https://example.com/a.png' },
			continueOnFail,
			respond: () => {
				const error = new Error('Request failed with status code 402');
				error.httpCode = '402';
				error.description = 'This account has no credits left today.';
				throw error;
			},
		});
	await assert.rejects(run(failing(false)), (error) => {
		assert.ok(error instanceof NodeApiError);
		assert.match(error.description, /no credits left today/);
		assert.match(error.description, /svg\.new\/account/);
		return true;
	});
	const [[item]] = await run(failing(true));
	assert.ok(typeof item.json.error === 'string');
	assert.deepEqual(item.pairedItem, { item: 0 });
});

test('the credential test lists one past vectorization with the API key as a Bearer token', () => {
	const credential = new SvgNewApi();
	assert.deepEqual(credential.test.request, {
		baseURL: 'https://svg.new',
		url: '/api/vectorizations',
		method: 'GET',
		qs: { limit: 1 },
	});
	assert.equal(credential.authenticate.properties.headers.Authorization, '=Bearer {{$credentials.apiKey}}');
});
