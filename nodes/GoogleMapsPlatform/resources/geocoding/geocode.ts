import type { INodeProperties } from 'n8n-workflow';
import { setGeocodeAdditionalFields } from '../../GenericFunctions';

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
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showOnlyForGeocode },
		options: [
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: '',
				description:
					'The language code (e.g. "en", "es") in which to return results, per Google\'s list of supported languages',
			},
			{
				displayName: 'Region',
				name: 'region',
				type: 'string',
				default: '',
				description:
					'CcTLD (top-level domain) biasing results toward this region, e.g. "de" for Germany',
			},
			{
				displayName: 'Components',
				name: 'components',
				type: 'string',
				default: '',
				description:
					'Component filter as pipe-separated key:value pairs, e.g. "country:US|postal_code:94043". See Google\'s Geocoding API docs for valid component types.',
			},
		],
		routing: {
			send: { preSend: [setGeocodeAdditionalFields] },
		},
	},
];
