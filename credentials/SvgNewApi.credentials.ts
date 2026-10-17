import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SvgNewApi implements ICredentialType {
	name = 'svgNewApi';

	displayName = 'SVG.new API';

	icon: Icon = { light: 'file:../icons/svgnew.svg', dark: 'file:../icons/svgnew.dark.svg' };

	documentationUrl = 'https://github.com/svgnew/n8n#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Create a key under API keys at https://svg.new/account. Keys start with svk_.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// Lists one past vectorization: it needs a valid key and uses no credits.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://svg.new',
			url: '/api/vectorizations',
			method: 'GET',
			qs: { limit: 1 },
		},
	};
}
