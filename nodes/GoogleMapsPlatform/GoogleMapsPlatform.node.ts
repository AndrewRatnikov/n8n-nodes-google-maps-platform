import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { userDescription } from './resources/user';
import { companyDescription } from './resources/company';

export class GoogleMapsPlatform implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Google Maps Platform',
		name: 'googleMapsPlatform',
		icon: { light: 'file:googleMapsPlatform.svg', dark: 'file:googleMapsPlatform.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with the Google Maps Platform API',
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
					{
						name: 'User',
						value: 'user',
					},
					{
						name: 'Company',
						value: 'company',
					},
				],
				default: 'user',
			},
			...userDescription,
			...companyDescription,
		],
	};
}
