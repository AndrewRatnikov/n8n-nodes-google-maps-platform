import type { INodeProperties } from 'n8n-workflow';

const showOnlyForGeocode = {
	resource: ['geocoding'],
	operation: ['geocode'],
};

export const geocodeFieldsDescription: INodeProperties[] = [
	{
		displayName: 'Address',
		name: 'address',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: showOnlyForGeocode },
		description: 'The address to geocode, e.g. "1600 Amphitheatre Parkway, Mountain View, CA"',
		routing: {
			send: { type: 'query', property: 'address' },
		},
	},
	{
		displayName: 'Return All Matches',
		name: 'returnAllMatches',
		type: 'boolean',
		default: false,
		displayOptions: { show: showOnlyForGeocode },
		description:
			'Whether to return every match Google finds as a separate item. When off, only the first (best) match is returned.',
	},
];
