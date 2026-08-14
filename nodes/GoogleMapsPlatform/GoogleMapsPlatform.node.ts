import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { geocodingDescription } from './resources/geocoding';
import { timezoneDescription } from './resources/timezone';

export class GoogleMapsPlatform implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Google Maps Platform',
		name: 'googleMapsPlatform',
		icon: { light: 'file:googleMapsPlatform.svg', dark: 'file:googleMapsPlatform.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Geocode addresses, compute routes and distance matrices, and look up timezones via the Google Maps Platform APIs',
		defaults: {
			name: 'Google Maps Platform',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'googleMapsPlatformApi', required: true }],
		requestDefaults: {
			baseURL: 'https://maps.googleapis.com/maps/api',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Geocoding', value: 'geocoding' },
					{ name: 'Timezone', value: 'timezone' },
				],
				default: 'geocoding',
			},
			...geocodingDescription,
			...timezoneDescription,
		],
	};
}
