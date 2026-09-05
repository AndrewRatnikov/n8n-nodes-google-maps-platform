import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { directionsDescription } from './resources/directions';
import { distanceMatrixDescription } from './resources/distanceMatrix';
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
					{ name: 'Distance Matrix', value: 'distanceMatrix' },
					{ name: 'Geocoding', value: 'geocoding' },
					{ name: 'Route', value: 'directions' },
					{ name: 'Timezone', value: 'timezone' },
				],
				default: 'geocoding',
			},
			...distanceMatrixDescription,
			...geocodingDescription,
			...directionsDescription,
			...timezoneDescription,
			{
				displayName: 'Request Options',
				name: 'requestOptions',
				type: 'collection',
				isNodeSetting: true,
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Batching',
						name: 'batching',
						placeholder: 'Add Batching',
						type: 'fixedCollection',
						typeOptions: { multipleValues: false },
						default: {
							batch: {},
						},
						options: [
							{
								displayName: 'Batching',
								name: 'batch',
								values: [
									{
										displayName: 'Items per Batch',
										name: 'batchSize',
										type: 'number',
										typeOptions: { minValue: -1 },
										default: 10,
										description:
											'Input will be split in batches to throttle requests. -1 for disabled. 0 will be treated as 1.',
									},
									{
										displayName: 'Batch Interval (Ms)',
										name: 'batchInterval',
										type: 'number',
										typeOptions: { minValue: 0 },
										default: 1000,
										description:
											'Time (in milliseconds) between each batch of requests. 0 for disabled.',
									},
								],
							},
						],
					},
				],
			},
		],
	};
}
