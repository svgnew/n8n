import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class SvgNew implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'SVG.new',
    name: 'svgNew',
    icon: 'file:../../icons/svgnew.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Convert images to SVG vectors using svg.new',
    defaults: {
      name: 'SVG.new',
    },
    inputs: ['main' as const],
    outputs: ['main' as const],
    usableAsTool: true,
    credentials: [
      {
        name: 'svgNewApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Vectorize',
            value: 'vectorize',
            action: 'Convert an image to SVG',
            description: 'Convert a raster image (PNG, JPG, WebP) to a clean SVG vector',
          },
          {
            name: 'Recolor',
            value: 'recolor',
            action: 'Recolor an SVG',
            description: 'Change colors in an SVG using a color map',
          },
          {
            name: 'Simplify Colors',
            value: 'simplify',
            action: 'Reduce colors in an SVG',
            description: 'Reduce the number of colors in an SVG',
          },
        ],
        default: 'vectorize',
      },
      // Vectorize: input type
      {
        displayName: 'Input Type',
        name: 'inputType',
        type: 'options',
        options: [
          { name: 'Binary Data', value: 'binary' },
          { name: 'Base64 Data URL', value: 'base64' },
        ],
        default: 'binary',
        displayOptions: { show: { operation: ['vectorize'] } },
      },
      {
        displayName: 'Binary Property',
        name: 'binaryProperty',
        type: 'string',
        default: 'data',
        displayOptions: { show: { operation: ['vectorize'], inputType: ['binary'] } },
        description: 'Name of the binary property containing the image',
      },
      {
        displayName: 'Image Data URL',
        name: 'base64Data',
        type: 'string',
        default: '',
        displayOptions: { show: { operation: ['vectorize'], inputType: ['base64'] } },
        description: 'Base64 data URL (data:image/png;base64,...)',
      },
      // Recolor / Simplify: SVG input
      {
        displayName: 'SVG Content',
        name: 'svgContent',
        type: 'string',
        typeOptions: { rows: 4 },
        default: '',
        displayOptions: { show: { operation: ['recolor', 'simplify'] } },
        description: 'SVG content as a string',
      },
      // Recolor: color map
      {
        displayName: 'Color Map (JSON)',
        name: 'colorMap',
        type: 'json',
        default: '{"#ff0000": "#0000ff"}',
        displayOptions: { show: { operation: ['recolor'] } },
        description: 'JSON mapping old hex colors to new hex colors',
      },
      // Simplify: max colors
      {
        displayName: 'Max Colors',
        name: 'maxColors',
        type: 'number',
        default: 8,
        typeOptions: { minValue: 1, maxValue: 256 },
        displayOptions: { show: { operation: ['simplify'] } },
        description: 'Maximum number of colors to keep (1-256)',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const operation = this.getNodeParameter('operation', 0) as string;

    for (let i = 0; i < items.length; i++) {
      try {
        if (operation === 'vectorize') {
          const inputType = this.getNodeParameter('inputType', i) as string;
          let imageDataUrl: string;

          if (inputType === 'binary') {
            const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
            const binaryData = this.helpers.assertBinaryData(i, binaryProperty);
            const buffer = await this.helpers.getBinaryDataBuffer(i, binaryProperty);
            const base64 = buffer.toString('base64');
            const mimeType = binaryData.mimeType || 'image/png';
            imageDataUrl = `data:${mimeType};base64,${base64}`;
          } else {
            imageDataUrl = this.getNodeParameter('base64Data', i) as string;
          }

          const response = await this.helpers.httpRequestWithAuthentication.call(
            this,
            'svgNewApi',
            {
              method: 'POST',
              url: 'https://svg.new/api/agent/vectorize',
              body: { image: imageDataUrl },
              headers: { 'Content-Type': 'application/json' },
              json: true,
            },
          );

          const svgString = response.svg as string;
          const svgBuffer = Buffer.from(svgString, 'utf-8');
          const binaryOutput = await this.helpers.prepareBinaryData(
            svgBuffer,
            'output.svg',
            'image/svg+xml',
          );

          returnData.push({
            json: { id: response.id, svg: svgString, metadata: response.metadata },
            binary: { data: binaryOutput },
            pairedItem: { item: i },
          });
        } else if (operation === 'recolor') {
          const svg = this.getNodeParameter('svgContent', i) as string;
          const colorMapStr = this.getNodeParameter('colorMap', i) as string;
          const colorMap = typeof colorMapStr === 'string' ? JSON.parse(colorMapStr) : colorMapStr;

          const response = await this.helpers.httpRequestWithAuthentication.call(
            this,
            'svgNewApi',
            {
              method: 'POST',
              url: 'https://svg.new/api/agent/edit/recolor',
              body: { svg, color_map: colorMap },
              headers: { 'Content-Type': 'application/json' },
              json: true,
            },
          );

          returnData.push({
            json: { svg: response.svg },
            pairedItem: { item: i },
          });
        } else if (operation === 'simplify') {
          const svg = this.getNodeParameter('svgContent', i) as string;
          const maxColors = this.getNodeParameter('maxColors', i) as number;

          const response = await this.helpers.httpRequestWithAuthentication.call(
            this,
            'svgNewApi',
            {
              method: 'POST',
              url: 'https://svg.new/api/agent/edit/simplify',
              body: { svg, max_colors: maxColors },
              headers: { 'Content-Type': 'application/json' },
              json: true,
            },
          );

          returnData.push({
            json: {
              svg: response.svg,
              colors_before: response.colors_before,
              colors_after: response.colors_after,
            },
            pairedItem: { item: i },
          });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: (error as Error).message },
            pairedItem: { item: i },
          });
        } else {
          throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
        }
      }
    }

    return [returnData];
  }
}
