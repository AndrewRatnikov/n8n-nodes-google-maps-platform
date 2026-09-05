import type { INodeProperties } from 'n8n-workflow';
import {
	omitUnsupportedTravelModeOptions,
	setRouteAdditionalFields,
	setRouteFieldMask,
	setRouteTimes,
	validateWaypointCount,
} from '../../GenericFunctions';

const showOnlyForGetRoute = {
	resource: ['directions'],
	operation: ['getRoute'],
};

const locationTypeOptions = [
	{ name: 'Address', value: 'address' },
	{ name: 'Coordinates', value: 'coordinates' },
	{ name: 'Place ID', value: 'placeId' },
];

export const getRouteFieldsDescription: INodeProperties[] = [
	{
		displayName: 'Origin Type',
		name: 'originType',
		type: 'options',
		default: 'address',
		displayOptions: { show: showOnlyForGetRoute },
		options: locationTypeOptions,
		description:
			'How the origin is specified. Coordinates and Place ID avoid a second geocoding call when chaining from a Geocode node.',
	},
	{
		displayName: 'Origin Address',
		name: 'originAddress',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { ...showOnlyForGetRoute, originType: ['address'] } },
		description: 'Starting address, e.g. "Brandenburg Gate, Berlin"',
		routing: {
			send: { type: 'body', property: 'origin.address', propertyInDotNotation: true },
		},
	},
	{
		displayName: 'Origin Latitude',
		name: 'originLatitude',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: { show: { ...showOnlyForGetRoute, originType: ['coordinates'] } },
		description: 'Latitude of the starting point',
		routing: {
			send: { type: 'body', property: 'origin.location.latLng.latitude', propertyInDotNotation: true },
		},
	},
	{
		displayName: 'Origin Longitude',
		name: 'originLongitude',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: { show: { ...showOnlyForGetRoute, originType: ['coordinates'] } },
		description: 'Longitude of the starting point',
		routing: {
			send: { type: 'body', property: 'origin.location.latLng.longitude', propertyInDotNotation: true },
		},
	},
	{
		displayName: 'Origin Place ID',
		name: 'originPlaceId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { ...showOnlyForGetRoute, originType: ['placeId'] } },
		description: 'Google Place ID of the starting point',
		routing: {
			send: { type: 'body', property: 'origin.placeId', propertyInDotNotation: true },
		},
	},
	{
		displayName: 'Destination Type',
		name: 'destinationType',
		type: 'options',
		default: 'address',
		displayOptions: { show: showOnlyForGetRoute },
		options: locationTypeOptions,
		description:
			'How the destination is specified. Coordinates and Place ID avoid a second geocoding call when chaining from a Geocode node.',
	},
	{
		displayName: 'Destination Address',
		name: 'destinationAddress',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { ...showOnlyForGetRoute, destinationType: ['address'] } },
		description: 'Destination address, e.g. "Berlin Hauptbahnhof, Berlin"',
		routing: {
			send: { type: 'body', property: 'destination.address', propertyInDotNotation: true },
		},
	},
	{
		displayName: 'Destination Latitude',
		name: 'destinationLatitude',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: { show: { ...showOnlyForGetRoute, destinationType: ['coordinates'] } },
		description: 'Latitude of the destination',
		routing: {
			send: {
				type: 'body',
				property: 'destination.location.latLng.latitude',
				propertyInDotNotation: true,
			},
		},
	},
	{
		displayName: 'Destination Longitude',
		name: 'destinationLongitude',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: { show: { ...showOnlyForGetRoute, destinationType: ['coordinates'] } },
		description: 'Longitude of the destination',
		routing: {
			send: {
				type: 'body',
				property: 'destination.location.latLng.longitude',
				propertyInDotNotation: true,
			},
		},
	},
	{
		displayName: 'Destination Place ID',
		name: 'destinationPlaceId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { ...showOnlyForGetRoute, destinationType: ['placeId'] } },
		description: 'Google Place ID of the destination',
		routing: {
			send: { type: 'body', property: 'destination.placeId', propertyInDotNotation: true },
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
	{
		displayName: 'Include Steps',
		name: 'includeSteps',
		type: 'boolean',
		default: false,
		displayOptions: { show: showOnlyForGetRoute },
		description:
			'Whether to include per-leg, turn-by-turn steps (with instructions and per-step polylines) in the response. Off by default, since the common "how far and how long" use case doesn\'t need them and they meaningfully bloat the stored execution data.',
		routing: {
			send: { preSend: [setRouteFieldMask] },
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showOnlyForGetRoute },
		options: [
			{
				displayName: 'Avoid Ferries',
				name: 'avoidFerries',
				type: 'boolean',
				default: false,
				description: 'Whether to avoid ferries where reasonable',
			},
			{
				displayName: 'Avoid Highways',
				name: 'avoidHighways',
				type: 'boolean',
				default: false,
				description: 'Whether to avoid highways where reasonable',
			},
			{
				displayName: 'Avoid Tolls',
				name: 'avoidTolls',
				type: 'boolean',
				default: false,
				description: 'Whether to avoid toll roads where reasonable',
			},
			{
				displayName: 'Compute Alternative Routes',
				name: 'computeAlternativeRoutes',
				type: 'boolean',
				default: false,
				description: 'Whether to also return alternative routes in addition to the best one',
			},
			{
				displayName: 'Optimize Waypoint Order',
				name: 'optimizeWaypointOrder',
				type: 'boolean',
				default: false,
				description:
					'Whether to let Google reorder the intermediate waypoints to minimize total route cost. Only applies when Waypoints are set. This is a Pro-SKU-billing trigger -- see the README before enabling for high-volume workflows.',
			},
			{
				displayName: 'Units',
				name: 'units',
				type: 'options',
				options: [
					{ name: 'Metric', value: 'METRIC' },
					{ name: 'Imperial', value: 'IMPERIAL' },
				],
				default: 'METRIC',
				description: 'Units to use for displayed distances. Does not affect the raw distanceMeters value.',
			},
		],
		routing: {
			send: { preSend: [setRouteAdditionalFields] },
		},
	},
];
