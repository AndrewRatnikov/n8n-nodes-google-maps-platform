import type { INodeProperties } from 'n8n-workflow';
import { setReverseGeocodeAdditionalFields } from '../../GenericFunctions';

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
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showOnlyForReverseGeocode },
		options: [
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: '',
				description:
					'The language code (e.g. "en", "es") in which to return results, per Google\'s list of supported languages',
			},
		],
		routing: {
			send: { preSend: [setReverseGeocodeAdditionalFields] },
		},
	},
];
