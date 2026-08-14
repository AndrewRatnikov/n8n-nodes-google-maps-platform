import type {
	IDataObject,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

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

// Geocoding and Timezone wrap failures in a `status` field inside an HTTP 200
// response instead of using HTTP error codes -- n8n's declarative routing only
// auto-detects errors from status codes, so without this a bad key or an
// exceeded quota would silently look like success. The Routes API (Directions,
// Distance Matrix) uses real HTTP status codes, so it doesn't need this.
function extractGoogleApiErrorMessage(body: IDataObject, status: string): string {
	return (
		(body.error_message as string | undefined) ??
		(body.errorMessage as string | undefined) ??
		`Google Maps API returned status "${status}"`
	);
}

export async function handleGeocodingResponse(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const body = response.body as IDataObject;
	const status = body.status as string;
	const pairedItem = items[0]?.pairedItem;

	if (status === 'ZERO_RESULTS') {
		return [{ json: { status, results: [] }, pairedItem }];
	}

	if (status !== 'OK') {
		const message = extractGoogleApiErrorMessage(body, status);
		if (this.continueOnFail()) {
			return [{ json: { error: message, status }, pairedItem }];
		}
		throw new NodeApiError(this.getNode(), body as unknown as JsonObject, { message });
	}

	const results = (body.results as IDataObject[]) ?? [];
	const returnAllMatches = this.getNodeParameter('returnAllMatches', false) as boolean;
	const matches = returnAllMatches ? results : results.slice(0, 1);

	return matches.map((result) => ({ json: result, pairedItem }));
}

export async function handleTimezoneResponse(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const body = response.body as IDataObject;
	const status = body.status as string;
	const pairedItem = items[0]?.pairedItem;

	if (status !== 'OK') {
		const message = extractGoogleApiErrorMessage(body, status);
		if (this.continueOnFail()) {
			return [{ json: { error: message, status }, pairedItem }];
		}
		throw new NodeApiError(this.getNode(), body as unknown as JsonObject, { message });
	}

	return [{ json: body, pairedItem }];
}
