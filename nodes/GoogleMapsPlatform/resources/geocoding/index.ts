import type { INodeProperties } from 'n8n-workflow';
import { handleGeocodingResponse } from '../../GenericFunctions';
import { geocodeFieldsDescription } from './geocode';
import { reverseGeocodeFieldsDescription } from './reverseGeocode';

const showOnlyForGeocoding = {
	resource: ['geocoding'],
};

export const geocodingDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForGeocoding },
		options: [
			{
				name: 'Geocode',
				value: 'geocode',
				action: 'Geocode an address',
				description: 'Convert an address into geographic coordinates',
				routing: {
					request: { method: 'GET', url: '/geocode/json' },
					output: { postReceive: [handleGeocodingResponse] },
				},
			},
			{
				name: 'Reverse Geocode',
				value: 'reverseGeocode',
				action: 'Reverse geocode coordinates',
				description: 'Convert geographic coordinates into a human-readable address',
				routing: {
					request: { method: 'GET', url: '/geocode/json' },
					output: { postReceive: [handleGeocodingResponse] },
				},
			},
		],
		default: 'geocode',
	},
	...geocodeFieldsDescription,
	...reverseGeocodeFieldsDescription,
];
