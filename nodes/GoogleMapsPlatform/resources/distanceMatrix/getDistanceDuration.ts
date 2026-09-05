import type { INodeProperties } from 'n8n-workflow';
import {
	omitUnsupportedTravelModeOptions,
	validateRouteMatrixSize,
} from '../../GenericFunctions';

const showOnlyForGetDistanceDuration = {
	resource: ['distanceMatrix'],
	operation: ['getDistanceDuration'],
};

export const getDistanceDurationFieldsDescription: INodeProperties[] = [
	{
		displayName: 'Origins',
		name: 'origins',
		type: 'string',
		typeOptions: { multipleValues: true, multipleValueButtonText: 'Add Origin' },
		required: true,
		default: [],
		displayOptions: { show: showOnlyForGetDistanceDuration },
		description:
			'Starting addresses. The response has one row per origin x destination combination.',
		routing: {
			send: {
				type: 'body',
				property: 'origins',
				value: '={{$value.map((address) => ({ waypoint: { address } })) }}',
			},
		},
	},
	{
		displayName: 'Destinations',
		name: 'destinations',
		type: 'string',
		typeOptions: { multipleValues: true, multipleValueButtonText: 'Add Destination' },
		required: true,
		default: [],
		displayOptions: { show: showOnlyForGetDistanceDuration },
		description:
			'Destination addresses. Billed per element: number of origins x number of destinations -- see the README before running large batches.',
		routing: {
			send: {
				type: 'body',
				property: 'destinations',
				value: '={{$value.map((address) => ({ waypoint: { address } })) }}',
				preSend: [validateRouteMatrixSize],
			},
		},
	},
	{
		displayName: 'Travel Mode',
		name: 'travelMode',
		type: 'options',
		default: 'DRIVE',
		displayOptions: { show: showOnlyForGetDistanceDuration },
		options: [
			{ name: 'Bicycle', value: 'BICYCLE' },
			{ name: 'Drive', value: 'DRIVE' },
			{ name: 'Transit', value: 'TRANSIT' },
			{ name: 'Two Wheeler (Enterprise Pricing)', value: 'TWO_WHEELER' },
			{ name: 'Walk', value: 'WALK' },
		],
		description:
			'How to travel between origins and destinations. Transit mode lowers the max element count from 625 to 100 per request. Two Wheeler bills at Google\'s Enterprise SKU tier, which has the smallest free tier of the three (1,000 events/month) -- see the README before enabling for high-volume workflows.',
		routing: {
			send: {
				type: 'body',
				property: 'travelMode',
				preSend: [omitUnsupportedTravelModeOptions],
			},
		},
	},
	{
		displayName: 'Routing Preference',
		name: 'routingPreference',
		type: 'options',
		default: 'TRAFFIC_UNAWARE',
		displayOptions: {
			show: {
				...showOnlyForGetDistanceDuration,
				travelMode: ['DRIVE', 'TWO_WHEELER'],
			},
		},
		options: [
			{ name: 'Traffic Aware (Pro Pricing)', value: 'TRAFFIC_AWARE' },
			{
				name: 'Traffic Aware Optimal (Pro Pricing, 100-Element Cap)',
				value: 'TRAFFIC_AWARE_OPTIMAL',
			},
			{ name: 'Traffic Unaware (Essentials Pricing)', value: 'TRAFFIC_UNAWARE' },
		],
		description:
			'Traffic Aware and Traffic Aware Optimal use live traffic data but bill at Google\'s higher Pro SKU tier instead of Essentials, and Traffic Aware Optimal also lowers the max element count from 625 to 100 -- see the README before enabling for high-volume workflows',
		routing: {
			send: { type: 'body', property: 'routingPreference' },
		},
	},
];
