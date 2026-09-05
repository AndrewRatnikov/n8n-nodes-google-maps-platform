import type { INodeProperties } from 'n8n-workflow';
import { setTimezoneAdditionalFields } from '../../GenericFunctions';

const showOnlyForGetTimezone = {
	resource: ['timezone'],
	operation: ['getTimezone'],
};

export const getTimezoneFieldsDescription: INodeProperties[] = [
	{
		displayName: 'Latitude',
		name: 'latitude',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: { show: showOnlyForGetTimezone },
		description: 'Latitude of the location to look up',
		routing: {
			send: {
				type: 'query',
				property: 'location',
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
		displayOptions: { show: showOnlyForGetTimezone },
		description: 'Longitude of the location to look up',
	},
	{
		displayName: 'Timestamp',
		name: 'timestamp',
		type: 'dateTime',
		required: true,
		default: '={{$now}}',
		displayOptions: { show: showOnlyForGetTimezone },
		description:
			'The date and time to get timezone info for (matters for daylight saving). Sent to Google as Unix seconds automatically -- Google requires seconds, not milliseconds.',
		routing: {
			send: {
				type: 'query',
				property: 'timestamp',
				value: '={{Math.floor(new Date($parameter.timestamp).getTime() / 1000)}}',
			},
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showOnlyForGetTimezone },
		options: [
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: '',
				description:
					'The language code (e.g. "en", "es") in which to return the timezone name, per Google\'s list of supported languages',
			},
		],
		routing: {
			send: { preSend: [setTimezoneAdditionalFields] },
		},
	},
];
