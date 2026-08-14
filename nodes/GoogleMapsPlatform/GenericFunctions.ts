import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

const MAX_INTERMEDIATE_WAYPOINTS = 25;
const MAX_ROUTE_MATRIX_ELEMENTS = 625;
const MAX_ROUTE_MATRIX_ELEMENTS_RESTRICTED = 100;

export async function validateWaypointCount(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const waypoints = this.getNodeParameter('waypoints', []) as string[];

	if (waypoints.length > MAX_INTERMEDIATE_WAYPOINTS) {
		throw new NodeOperationError(
			this.getNode(),
			`Get Route supports at most ${MAX_INTERMEDIATE_WAYPOINTS} intermediate waypoints, but ${waypoints.length} were provided. Reduce the number of waypoints.`,
		);
	}

	return requestOptions;
}

export async function validateRouteMatrixSize(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const origins = this.getNodeParameter('origins', []) as string[];
	const destinations = this.getNodeParameter('destinations', []) as string[];
	const travelMode = this.getNodeParameter('travelMode', 'DRIVE') as string;
	const routingPreference = this.getNodeParameter(
		'routingPreference',
		'TRAFFIC_UNAWARE',
	) as string;

	const elementCount = origins.length * destinations.length;
	const isRestricted = travelMode === 'TRANSIT' || routingPreference === 'TRAFFIC_AWARE_OPTIMAL';
	const maxElements = isRestricted
		? MAX_ROUTE_MATRIX_ELEMENTS_RESTRICTED
		: MAX_ROUTE_MATRIX_ELEMENTS;

	if (elementCount > maxElements) {
		const restrictionNote = isRestricted
			? ' that applies to TRANSIT mode and TRAFFIC_AWARE_OPTIMAL requests'
			: '';
		throw new NodeOperationError(
			this.getNode(),
			`This request has ${elementCount} elements (${origins.length} origins x ${destinations.length} destinations), which exceeds the ${maxElements}-element limit${restrictionNote}. Reduce the number of origins or destinations.`,
		);
	}

	return requestOptions;
}
