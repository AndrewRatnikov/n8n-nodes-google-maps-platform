import type { INodeProperties } from 'n8n-workflow';
import { flattenRouteMatrixResponse } from '../../GenericFunctions';
import { getDistanceDurationFieldsDescription } from './getDistanceDuration';

const showOnlyForDistanceMatrix = {
	resource: ['distanceMatrix'],
};

export const distanceMatrixDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForDistanceMatrix },
		options: [
			{
				name: 'Get Distance & Duration',
				value: 'getDistanceDuration',
				action: 'Get distance and duration for a matrix of origins and destinations',
				description:
					'Compute travel distance and time for every combination of the given origins and destinations, via the Routes API',
				routing: {
					request: {
						method: 'POST',
						baseURL: 'https://routes.googleapis.com',
						url: '/distanceMatrix/v2:computeRouteMatrix',
						headers: {
							'X-Goog-FieldMask':
								'originIndex,destinationIndex,status,condition,distanceMeters,duration',
						},
					},
					output: { postReceive: [flattenRouteMatrixResponse] },
				},
			},
		],
		default: 'getDistanceDuration',
	},
	...getDistanceDurationFieldsDescription,
];
