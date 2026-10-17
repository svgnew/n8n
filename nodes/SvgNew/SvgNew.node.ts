import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

const BASE_URL = 'https://svg.new';

// svg.new runs on Vercel, which caps a request body at 4.5 MB. Images and SVGs sent inline go
// as text (an image grows by a third as base64), so 3 MB is the most that fits. Bigger files go
// by URL: svg.new downloads those itself, up to 20 MB.
const MAX_INLINE_BYTES = 3_000_000;

const IMAGE_OPERATIONS = ['vectorize', 'removeBackground'];
const SVG_OPERATIONS = ['removeBackground', 'recolor', 'simplify'];

const svgInputOptions = [
	{
		name: 'Binary File',
		value: 'binary',
		description: 'An SVG file from a previous node',
	},
	{
		name: 'SVG Text',
		value: 'text',
		description: 'SVG markup, such as the "svg" field from an earlier SVG.new step',
	},
	{
		name: 'SVG URL',
		value: 'url',
		description: 'A public HTTPS link to an SVG file, up to 20 MB',
	},
];

const properties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Recolor SVG',
				value: 'recolor',
				description: 'Replace colors in an SVG. Uses no credits.',
				action: 'Recolor SVG',
			},
			{
				name: 'Remove Background',
				value: 'removeBackground',
				description:
					'Remove the background from an image and return a background-free SVG and a transparent PNG',
				action: 'Remove background from image',
			},
			{
				name: 'Simplify SVG Colors',
				value: 'simplify',
				description: 'Reduce the number of colors in an SVG. Uses no credits.',
				action: 'Simplify SVG colors',
			},
			{
				name: 'Vectorize Image',
				value: 'vectorize',
				description: 'Convert a PNG, JPEG or WebP image to an SVG. Uses 1 credit.',
				action: 'Vectorize image',
			},
		],
		default: 'vectorize',
	},

	// Image input: Vectorize and Remove Background. The names `inputType`, `binaryProperty` and
	// `base64Data` (and their values) come from version 0.1 and stay as they are so existing
	// workflows keep working.
	{
		displayName: 'Image Input',
		name: 'inputType',
		type: 'options',
		options: [
			{
				name: 'Binary File',
				value: 'binary',
				description:
					'An image from a previous node, such as HTTP Request or Read/Write Files from Disk',
			},
			{
				name: 'Image URL',
				value: 'url',
				description: 'A public HTTPS link. SVG.new downloads the image (up to 20 MB).',
			},
			{
				name: 'Base64 Data URL',
				value: 'base64',
				description: 'A data URL such as data:image/png;base64,…',
			},
		],
		default: 'binary',
		displayOptions: { show: { operation: IMAGE_OPERATIONS } },
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryProperty',
		type: 'string',
		default: 'data',
		required: true,
		displayOptions: { show: { operation: IMAGE_OPERATIONS, inputType: ['binary'] } },
		hint: 'The name of the input binary field containing the image',
		description: 'PNG, JPEG or WebP, up to 3 MB. For bigger images, use an image URL.',
	},
	{
		displayName: 'Image URL',
		name: 'imageUrl',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. https://example.com/image.png',
		displayOptions: { show: { operation: IMAGE_OPERATIONS, inputType: ['url'] } },
		description: 'A public HTTPS link to a PNG, JPEG or WebP image, up to 20 MB',
	},
	{
		displayName: 'Image Data URL',
		name: 'base64Data',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. data:image/png;base64,iVBORw0KGgo…',
		displayOptions: { show: { operation: IMAGE_OPERATIONS, inputType: ['base64'] } },
		description: 'A base64 data URL of a PNG, JPEG or WebP image, up to 3 MB',
	},

	// SVG input. Remove Background can also vectorize the image first.
	{
		displayName: 'SVG Input',
		name: 'svgInput',
		type: 'options',
		options: [
			{
				name: 'Vectorize the Image First',
				value: 'vectorize',
				description: 'Vectorize the image, then remove its background. Uses 2 credits.',
			},
			...svgInputOptions,
		],
		default: 'vectorize',
		displayOptions: { show: { operation: ['removeBackground'] } },
		hint: 'An existing SVG must be made from the image above. Removing the background uses 1 credit.',
	},
	{
		displayName: 'SVG Input',
		name: 'svgInput',
		type: 'options',
		options: svgInputOptions,
		default: 'binary',
		displayOptions: { show: { operation: ['recolor', 'simplify'] } },
	},
	{
		displayName: 'Input SVG Binary Field',
		name: 'svgBinaryProperty',
		type: 'string',
		default: 'data',
		required: true,
		displayOptions: { show: { operation: SVG_OPERATIONS, svgInput: ['binary'] } },
		hint: 'The name of the input binary field containing the SVG',
		description: 'An SVG file up to 3 MB. For bigger files, use an SVG URL.',
	},
	{
		displayName: 'SVG',
		name: 'svgText',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		required: true,
		placeholder: 'e.g. <svg xmlns="http://www.w3.org/2000/svg">…</svg>',
		displayOptions: { show: { operation: SVG_OPERATIONS, svgInput: ['text'] } },
		description:
			'The SVG markup, up to 3 MB. To use an earlier SVG.new result, drag in its "svg" field.',
	},
	{
		displayName: 'SVG URL',
		name: 'svgUrl',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. https://example.com/image.svg',
		displayOptions: { show: { operation: SVG_OPERATIONS, svgInput: ['url'] } },
		description: 'A public HTTPS link to an SVG file, up to 20 MB',
	},

	// Recolor
	{
		displayName: 'Color Changes',
		name: 'colorMap',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Color Change',
		default: {},
		displayOptions: { show: { operation: ['recolor'] } },
		description: 'Each shape filled with a "From" color is filled with its "To" color instead',
		options: [
			{
				displayName: 'Color Change',
				name: 'colors',
				values: [
					{
						displayName: 'From',
						name: 'from',
						type: 'color',
						default: '#000000',
						description: 'A color used in the SVG',
					},
					{
						displayName: 'To',
						name: 'to',
						type: 'color',
						default: '#000000',
						description: 'The color to use instead',
					},
				],
			},
		],
	},

	// Simplify
	{
		displayName: 'Max Colors',
		name: 'maxColors',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 256 },
		default: 8,
		displayOptions: { show: { operation: ['simplify'] } },
		description: 'The most colors the SVG keeps, from 1 to 256. Similar colors are merged.',
	},
];

type Input = { body: IDataObject; baseName: string };

/** "photos/logo.png" or "https://x.com/a/logo.png?x=1" → "logo"; anything else → "image". */
function baseName(name: string | undefined): string {
	const last = (name ?? '').split(/[?#]/)[0].split('/').pop() ?? '';
	const stem = last.replace(/\.[^.]*$/, '');
	return stem || 'image';
}

async function getImageInput(ctx: IExecuteFunctions, i: number): Promise<Input> {
	const inputType = ctx.getNodeParameter('inputType', i) as string;

	if (inputType === 'url') {
		const url = (ctx.getNodeParameter('imageUrl', i) as string).trim();
		if (!/^https:\/\//i.test(url)) {
			throw new NodeOperationError(ctx.getNode(), 'The image URL must start with https://', {
				itemIndex: i,
				description: 'Use a public HTTPS link to a PNG, JPEG or WebP image.',
			});
		}
		return { body: { image_url: url }, baseName: baseName(url) };
	}

	if (inputType === 'base64') {
		const dataUrl = (ctx.getNodeParameter('base64Data', i) as string).trim();
		if (!/^data:image\/[\w.+-]+;base64,/i.test(dataUrl)) {
			throw new NodeOperationError(
				ctx.getNode(),
				'The image data URL is not in the expected format',
				{
					itemIndex: i,
					description:
						'Use a data URL such as data:image/png;base64,… or choose another image input.',
				},
			);
		}
		if (dataUrl.length > (MAX_INLINE_BYTES * 4) / 3) {
			throw tooLarge(ctx, i, 'image');
		}
		return { body: { image: dataUrl }, baseName: 'image' };
	}

	const field = ctx.getNodeParameter('binaryProperty', i) as string;
	const binaryData: IBinaryData = ctx.helpers.assertBinaryData(i, field);
	const mimeType = binaryData.mimeType || 'image/png';
	if (!mimeType.startsWith('image/') || mimeType === 'image/svg+xml') {
		throw new NodeOperationError(
			ctx.getNode(),
			`The file in the "${field}" binary field is not a PNG, JPEG or WebP image`,
			{ itemIndex: i, description: `Its type is ${mimeType}.` },
		);
	}
	const buffer = await ctx.helpers.getBinaryDataBuffer(i, field);
	if (buffer.length > MAX_INLINE_BYTES) {
		throw tooLarge(ctx, i, 'image');
	}
	return {
		body: { image: `data:${mimeType};base64,${buffer.toString('base64')}` },
		baseName: baseName(binaryData.fileName),
	};
}

async function getSvgInput(ctx: IExecuteFunctions, i: number, svgInput: string): Promise<Input> {
	if (svgInput === 'url') {
		const url = (ctx.getNodeParameter('svgUrl', i) as string).trim();
		if (!/^https:\/\//i.test(url)) {
			throw new NodeOperationError(ctx.getNode(), 'The SVG URL must start with https://', {
				itemIndex: i,
				description: 'Use a public HTTPS link to an SVG file.',
			});
		}
		return { body: { svg_url: url }, baseName: baseName(url) };
	}

	let svg: string;
	let name: string | undefined;
	if (svgInput === 'text') {
		svg = ctx.getNodeParameter('svgText', i) as string;
	} else {
		const field = ctx.getNodeParameter('svgBinaryProperty', i) as string;
		const binaryData: IBinaryData = ctx.helpers.assertBinaryData(i, field);
		svg = (await ctx.helpers.getBinaryDataBuffer(i, field)).toString('utf-8');
		name = binaryData.fileName;
	}
	if (!/<svg[\s>]/i.test(svg)) {
		throw new NodeOperationError(ctx.getNode(), 'The SVG input does not contain an <svg> element', {
			itemIndex: i,
			description: 'Check the "SVG Input" setting and the field it reads from.',
		});
	}
	if (Buffer.byteLength(svg) > MAX_INLINE_BYTES) {
		throw tooLarge(ctx, i, 'SVG');
	}
	return { body: { svg }, baseName: baseName(name) };
}

function tooLarge(ctx: IExecuteFunctions, i: number, what: 'image' | 'SVG'): NodeOperationError {
	return new NodeOperationError(ctx.getNode(), `The ${what} is larger than 3 MB`, {
		itemIndex: i,
		description: `Files sent from n8n are limited to 3 MB. Put the ${what} at a public HTTPS link and choose "${
			what === 'image' ? 'Image URL' : 'SVG URL'
		}" instead (up to 20 MB).`,
	});
}

const HINTS: Record<string, string> = {
	'401':
		'Check the API key in the SVG.new credential. Your keys are listed at https://svg.new/account.',
	'402':
		'Vectorizing and removing backgrounds use credits. See your balance at https://svg.new/account.',
	'403':
		'Vectorizing and removing backgrounds use credits. See your balance at https://svg.new/account.',
	'429':
		'SVG.new allows 10 vectorizations a minute per account. Wait a minute, or add a Wait node between batches.',
};

async function callApi(
	ctx: IExecuteFunctions,
	i: number,
	endpoint: string,
	body: IDataObject,
): Promise<IDataObject> {
	try {
		return (await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'svgNewApi', {
			method: 'POST',
			url: `${BASE_URL}${endpoint}`,
			body,
			json: true,
		})) as IDataObject;
	} catch (error) {
		// n8n usually wraps request failures already; keep SVG.new's own message and add a next step.
		const apiError =
			error instanceof NodeApiError
				? error
				: new NodeApiError(ctx.getNode(), error as JsonObject, { itemIndex: i });
		apiError.context.itemIndex ??= i;
		const hint = HINTS[String(apiError.httpCode)];
		if (hint) apiError.description = [apiError.description, hint].filter(Boolean).join(' ');
		throw apiError;
	}
}

/** Results bigger than 3 MB come back as one-hour links instead of inline. */
async function download(ctx: IExecuteFunctions, i: number, url: string): Promise<Buffer> {
	try {
		const data = await ctx.helpers.httpRequest({
			method: 'GET',
			url,
			encoding: 'arraybuffer',
			json: false,
		});
		return Buffer.from(data as ArrayBuffer);
	} catch (error) {
		throw new NodeApiError(ctx.getNode(), error as JsonObject, {
			itemIndex: i,
			message: 'Could not download the result from SVG.new',
		});
	}
}

async function svgFrom(ctx: IExecuteFunctions, i: number, response: IDataObject): Promise<string> {
	if (typeof response.svg === 'string') return response.svg;
	if (typeof response.svg_url === 'string') {
		return (await download(ctx, i, response.svg_url)).toString('utf-8');
	}
	throw new NodeOperationError(ctx.getNode(), 'SVG.new returned no SVG', { itemIndex: i });
}

async function pngFrom(
	ctx: IExecuteFunctions,
	i: number,
	response: IDataObject,
): Promise<Buffer | undefined> {
	const inline = response.transparent_image;
	if (typeof inline === 'string') {
		return Buffer.from(inline.replace(/^data:image\/png;base64,/, ''), 'base64');
	}
	if (typeof response.png_url === 'string') return await download(ctx, i, response.png_url);
	return undefined;
}

async function svgItem(
	ctx: IExecuteFunctions,
	i: number,
	json: IDataObject,
	svg: string,
	fileName: string,
	png?: { data: Buffer; fileName: string },
): Promise<INodeExecutionData> {
	const binary: INodeExecutionData['binary'] = {
		data: await ctx.helpers.prepareBinaryData(Buffer.from(svg, 'utf-8'), fileName, 'image/svg+xml'),
	};
	if (png) {
		binary.transparentImage = await ctx.helpers.prepareBinaryData(
			png.data,
			png.fileName,
			'image/png',
		);
	}
	return { json: { ...json, svg }, binary, pairedItem: { item: i } };
}

export class SvgNew implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SVG.new',
		name: 'svgNew',
		icon: { light: 'file:../../icons/svgnew.svg', dark: 'file:../../icons/svgnew.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle:
			'={{ $parameter["operation"] === "removeBackground" ? "Remove background" : $parameter["operation"] === "recolor" ? "Recolor SVG" : $parameter["operation"] === "simplify" ? "Simplify SVG colors" : "Vectorize image" }}',
		description:
			'Remove background and vectorize images with SVG.new, then recolor or simplify the SVG',
		defaults: {
			name: 'SVG.new',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'svgNewApi',
				required: true,
			},
		],
		properties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;

				if (operation === 'vectorize') {
					const image = await getImageInput(this, i);
					const response = await callApi(this, i, '/api/agent/vectorize', image.body);
					const svg = await svgFrom(this, i, response);
					returnData.push(
						await svgItem(
							this,
							i,
							{ id: response.id, metadata: response.metadata },
							svg,
							`${image.baseName}.svg`,
						),
					);
				} else if (operation === 'removeBackground') {
					const image = await getImageInput(this, i);
					const svgInput = this.getNodeParameter('svgInput', i) as string;
					const json: IDataObject = {};
					let svgBody: IDataObject;
					if (svgInput === 'vectorize') {
						// Ask for a link so the SVG doesn't travel back through n8n before the second call.
						const vectorized = await callApi(this, i, '/api/agent/vectorize', {
							...image.body,
							output: 'url',
						});
						json.id = vectorized.id;
						json.metadata = vectorized.metadata;
						svgBody =
							typeof vectorized.svg_url === 'string'
								? { svg_url: vectorized.svg_url }
								: { svg: await svgFrom(this, i, vectorized) };
					} else {
						svgBody = (await getSvgInput(this, i, svgInput)).body;
					}
					const response = await callApi(this, i, '/api/agent/edit/remove-background', {
						...svgBody,
						...image.body,
					});
					const svg = await svgFrom(this, i, response);
					const png = await pngFrom(this, i, response);
					const name = `${image.baseName}-no-background`;
					returnData.push(
						await svgItem(
							this,
							i,
							json,
							svg,
							`${name}.svg`,
							png ? { data: png, fileName: `${name}.png` } : undefined,
						),
					);
				} else if (operation === 'recolor') {
					const input = await getSvgInput(this, i, this.getNodeParameter('svgInput', i) as string);
					const changes =
						(this.getNodeParameter('colorMap.colors', i, []) as Array<{
							from: string;
							to: string;
						}>) ?? [];
					if (changes.length === 0) {
						throw new NodeOperationError(this.getNode(), 'No color changes are set', {
							itemIndex: i,
							description: 'Add at least one color change under "Color Changes".',
						});
					}
					const colorMap: IDataObject = {};
					for (const { from, to } of changes) colorMap[from] = to;
					const response = await callApi(this, i, '/api/agent/edit/recolor', {
						...input.body,
						color_map: colorMap,
					});
					const svg = await svgFrom(this, i, response);
					returnData.push(await svgItem(this, i, {}, svg, `${input.baseName}-recolored.svg`));
				} else if (operation === 'simplify') {
					const input = await getSvgInput(this, i, this.getNodeParameter('svgInput', i) as string);
					const maxColors = this.getNodeParameter('maxColors', i) as number;
					const response = await callApi(this, i, '/api/agent/edit/simplify', {
						...input.body,
						max_colors: maxColors,
					});
					const svg = await svgFrom(this, i, response);
					returnData.push(
						await svgItem(
							this,
							i,
							{ colorsBefore: response.colors_before, colorsAfter: response.colors_after },
							svg,
							`${input.baseName}-simplified.svg`,
						),
					);
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operation}" is not supported`,
						{
							itemIndex: i,
						},
					);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				// Both constructors hand back an error that is already of their own type unchanged.
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex: i });
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
