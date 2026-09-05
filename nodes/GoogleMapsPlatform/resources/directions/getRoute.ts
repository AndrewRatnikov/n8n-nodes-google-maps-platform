import type { INodeProperties } from 'n8n-workflow';
import {
	omitUnsupportedTravelModeOptions,
	setRouteTimes,
	validateWaypointCount,
} from '../../GenericFunctions';

const showOnlyForGetRoute = {
	resource: ['directions'],
	operation: ['getRoute'],
};

export const getRouteFieldsDescription: INodeProperties[] = [
	{
		displayName: 'Origin Address',
		name: 'originAddress',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: showOnlyForGetRoute },
		description: 'Starting address, e.g. "Brandenburg Gate, Berlin"',
		routing: {
			send: { type: 'body', property: 'origin.address', propertyInDotNotation: true },
		},
	},
	{
		displayName: 'Destination Address',
		name: 'destinationAddress',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: showOnlyForGetRoute },
		description: 'Destination address, e.g. "Berlin Hauptbahnhof, Berlin"',
		routing: {
			send: { type: 'body', property: 'destination.address', propertyInDotNotation: true },
		},
	},
	{
		displayName: 'Travel Mode',
		name: 'travelMode',
		type: 'options',
		default: 'DRIVE',
		displayOptions: { show: showOnlyForGetRoute },
		options: [
			{ name: 'Bicycle', value: 'BICYCLE' },
			{ name: 'Drive', value: 'DRIVE' },
			{ name: 'Transit', value: 'TRANSIT' },
			{ name: 'Two Wheeler (Enterprise Pricing)', value: 'TWO_WHEELER' },
			{ name: 'Walk', value: 'WALK' },
		],
		description:
			'How to travel between origin and destination. Two Wheeler bills at Google\'s Enterprise SKU tier, which has the smallest free tier of the three (1,000 events/month) -- see the README before enabling for high-volume workflows.',
		routing: {
			send: {
				type: 'body',
				property: 'travelMode',
				preSend: [omitUnsupportedTravelModeOptions, setRouteTimes],
			},
		},
	},
	{
		displayName: 'Departure Time',
		name: 'departureTime',
		type: 'dateTime',
		default: '',
		displayOptions: { show: showOnlyForGetRoute },
		description:
			'Optional trip start time used for traffic and transit calculations. When omitted, Google uses the time of the request. Past departure times are supported only for transit routes. Cannot be used together with Arrival Time.',
		routing: {
			send: { type: 'body', property: 'departureTime' },
		},
	},
	{
		displayName: 'Arrival Time',
		name: 'arrivalTime',
		type: 'dateTime',
		default: '',
		displayOptions: {
			show: { ...showOnlyForGetRoute, travelMode: ['TRANSIT'] },
		},
		description:
			'Optional desired arrival time for transit routes. Cannot be used together with Departure Time.',
		routing: {
			send: { type: 'body', property: 'arrivalTime' },
		},
	},
	{
		displayName: 'Routing Preference',
		name: 'routingPreference',
		type: 'options',
		default: 'TRAFFIC_UNAWARE',
		displayOptions: {
			show: { ...showOnlyForGetRoute, travelMode: ['DRIVE', 'TWO_WHEELER'] },
		},
		options: [
			{ name: 'Traffic Unaware (Essentials Pricing)', value: 'TRAFFIC_UNAWARE' },
			{ name: 'Traffic Aware (Pro Pricing)', value: 'TRAFFIC_AWARE' },
			{ name: 'Traffic Aware Optimal (Pro Pricing)', value: 'TRAFFIC_AWARE_OPTIMAL' },
		],
		description:
			'Traffic Aware and Traffic Aware Optimal use live traffic data but bill at Google\'s higher Pro SKU tier instead of Essentials -- see the README before enabling for high-volume workflows',
		routing: {
			send: { type: 'body', property: 'routingPreference' },
		},
	},
	{
		displayName: 'Waypoints',
		name: 'waypoints',
		type: 'string',
		typeOptions: { multipleValues: true, multipleValueButtonText: 'Add Waypoint' },
		default: [],
		displayOptions: {
			show: {
				...showOnlyForGetRoute,
				travelMode: ['BICYCLE', 'DRIVE', 'TWO_WHEELER', 'WALK'],
			},
		},
		description:
			'Optional intermediate addresses the route must pass through, in order. Up to 25 total; using more than 10 moves the request to Google\'s Pro pricing tier. Transit routes do not support intermediate waypoints.',
		routing: {
			send: {
				type: 'body',
				property: 'intermediates',
				value: '={{$value.map((address) => ({ address })) }}',
				preSend: [validateWaypointCount],
			},
		},
	},
];
