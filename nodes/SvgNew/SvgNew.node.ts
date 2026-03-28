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
        displayName: 'Input Type',
        name: 'inputType',
        type: 'options',
        options: [
          { name: 'Binary Data', value: 'binary' },
          { name: 'Base64 Data URL', value: 'base64' },
        ],
        default: 'binary',
      },
      {
        displayName: 'Binary Property',
        name: 'binaryProperty',
        type: 'string',
        default: 'data',
        displayOptions: { show: { inputType: ['binary'] } },
        description: 'Name of the binary property containing the image',
      },
      {
        displayName: 'Image Data URL',
        name: 'base64Data',
        type: 'string',
        default: '',
        displayOptions: { show: { inputType: ['base64'] } },
        description: 'Base64 data URL (data:image/png;base64,...)',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
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
