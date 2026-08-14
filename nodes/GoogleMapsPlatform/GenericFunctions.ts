import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

const MAX_INTERMEDIATE_WAYPOINTS = 25;

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
