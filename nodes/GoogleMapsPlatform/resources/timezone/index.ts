import type { INodeProperties } from 'n8n-workflow';
import { handleTimezoneResponse } from '../../GenericFunctions';
import { getTimezoneFieldsDescription } from './getTimezone';

const showOnlyForTimezone = {
	resource: ['timezone'],
};

export const timezoneDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForTimezone },
		options: [
			{
				name: 'Get Timezone',
				value: 'getTimezone',
				action: 'Get the timezone for a location',
				description: 'Look up the IANA timezone ID and UTC offset for a location and point in time',
				routing: {
					request: { method: 'GET', url: '/timezone/json' },
					output: { postReceive: [handleTimezoneResponse] },
				},
			},
		],
		default: 'getTimezone',
	},
	...getTimezoneFieldsDescription,
];
