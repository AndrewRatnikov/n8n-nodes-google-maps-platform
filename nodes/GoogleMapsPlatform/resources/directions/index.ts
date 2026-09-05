import type { INodeProperties } from 'n8n-workflow';
import { getRouteFieldsDescription } from './getRoute';

const showOnlyForDirections = {
	resource: ['directions'],
};

export const directionsDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForDirections },
		options: [
			{
				name: 'Get Route',
				value: 'getRoute',
				action: 'Get a route between two points',
				description:
					'Compute a route between an origin and a destination, with optional waypoints, via the Routes API',
				routing: {
					request: {
						method: 'POST',
						baseURL: 'https://routes.googleapis.com',
						url: '/directions/v2:computeRoutes',
						headers: {
							'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
						},
					},
				},
			},
		],
		default: 'getRoute',
	},
	...getRouteFieldsDescription,
];
