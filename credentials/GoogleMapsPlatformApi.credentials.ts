import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class GoogleMapsPlatformApi implements ICredentialType {
	name = 'googleMapsPlatformApi';

	displayName = 'Google Maps Platform API';

	icon = { light: 'file:googleMapsPlatform.svg', dark: 'file:googleMapsPlatform.dark.svg' } as const;

	documentationUrl = 'https://github.com/AndrewRatnikov/n8n-nodes-google-maps-platform#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://maps.googleapis.com/maps/api',
			url: '/v1/user',
		},
	};
}
