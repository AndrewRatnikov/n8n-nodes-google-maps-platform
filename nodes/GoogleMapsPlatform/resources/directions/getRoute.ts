import type { INodeProperties } from 'n8n-workflow';
import { validateWaypointCount } from '../../GenericFunctions';

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
			{ name: 'Two Wheeler', value: 'TWO_WHEELER' },
			{ name: 'Walk', value: 'WALK' },
		],
		description: 'How to travel between origin and destination',
		routing: {
			send: { type: 'body', property: 'travelMode' },
		},
	},
	{
		displayName: 'Routing Preference',
		name: 'routingPreference',
		type: 'options',
		default: 'TRAFFIC_UNAWARE',
		displayOptions: { show: showOnlyForGetRoute },
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
		displayOptions: { show: showOnlyForGetRoute },
		description:
			'Optional intermediate addresses the route must pass through, in order. Up to 25 total; using more than 10 moves the request to Google\'s Pro pricing tier.',
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
