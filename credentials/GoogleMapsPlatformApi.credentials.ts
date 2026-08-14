import type {
	IAuthenticate,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestOptions,
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
		{
			displayName:
				'Geocoding, Timezone, Directions, and Distance Matrix are enabled and billed independently on Google Cloud. A successful test below only confirms the key works for Geocoding -- enable the other APIs separately on the same project or requests to those resources will fail even with a valid key.',
			name: 'apiEnablementNotice',
			type: 'notice',
			default: '',
		},
	];

	// Geocoding and Timezone expect the key as a `?key=` query parameter; the
	// Routes API (Directions, Distance Matrix) expects it in an
	// `X-Goog-Api-Key` header instead. Branching on the request host matches
	// Google's documented auth method for each API exactly, rather than
	// relying on routes.googleapis.com's undocumented (but curl-confirmed)
	// acceptance of `?key=` too.
	authenticate: IAuthenticate = async (
		credentials,
		requestOptions,
	): Promise<IHttpRequestOptions> => {
		const apiKey = credentials.apiKey as string;
		const isRoutesApi = (requestOptions.baseURL ?? '').includes('routes.googleapis.com');

		if (isRoutesApi) {
			requestOptions.headers = { ...requestOptions.headers, 'X-Goog-Api-Key': apiKey };
		} else {
			requestOptions.qs = { ...requestOptions.qs, key: apiKey };
		}

		return requestOptions;
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://maps.googleapis.com/maps/api',
			url: '/geocode/json',
			qs: { address: 'Brandenburg Gate, Berlin' },
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'status',
					value: 'REQUEST_DENIED',
					message:
						'Invalid API key, or the Geocoding API is not enabled for this project. Restrict the key by API, not by referrer/IP -- this is a server-side call.',
				},
			},
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'status',
					value: 'OVER_QUERY_LIMIT',
					message: 'This key has exceeded its Geocoding API quota.',
				},
			},
		],
	};
}
