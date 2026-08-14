import type { INodeProperties } from 'n8n-workflow';

const showOnlyForReverseGeocode = {
	resource: ['geocoding'],
	operation: ['reverseGeocode'],
};

export const reverseGeocodeFieldsDescription: INodeProperties[] = [
	{
		displayName: 'Latitude',
		name: 'latitude',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: { show: showOnlyForReverseGeocode },
		description: 'Latitude of the location to reverse geocode',
		routing: {
			send: {
				type: 'query',
				property: 'latlng',
				value: '={{$parameter.latitude + "," + $parameter.longitude}}',
			},
		},
	},
	{
		displayName: 'Longitude',
		name: 'longitude',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: { show: showOnlyForReverseGeocode },
		description: 'Longitude of the location to reverse geocode',
	},
	{
		displayName: 'Return All Matches',
		name: 'returnAllMatches',
		type: 'boolean',
		default: false,
		displayOptions: { show: showOnlyForReverseGeocode },
		description:
			'Whether to return every match Google finds as a separate item. When off, only the first (most specific) match is returned.',
	},
];
