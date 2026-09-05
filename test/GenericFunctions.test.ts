import { describe, expect, it } from 'vitest';
import type { IExecuteSingleFunctions, IN8nHttpFullResponse, INodeExecutionData } from 'n8n-workflow';
import {
	flattenRouteMatrixResponse,
	handleGeocodingResponse,
	handleTimezoneResponse,
	omitUnsupportedTravelModeOptions,
	setRouteTimes,
	validateRouteMatrixSize,
	validateWaypointCount,
} from '../nodes/GoogleMapsPlatform/GenericFunctions';

function createMockContext(options: {
	parameters?: Record<string, unknown>;
	continueOnFail?: boolean;
}): IExecuteSingleFunctions {
	const parameters = options.parameters ?? {};
	return {
		getNodeParameter: (name: string, fallback?: unknown) => parameters[name] ?? fallback,
		getNode: () => ({ name: 'Google Maps Platform', type: 'test', typeVersion: 1, position: [0, 0], parameters: {} }),
		continueOnFail: () => options.continueOnFail ?? false,
	} as unknown as IExecuteSingleFunctions;
}

const dummyItems: INodeExecutionData[] = [{ json: {}, pairedItem: { item: 0 } }];

function mockResponse(body: unknown): IN8nHttpFullResponse {
	return { body, headers: {}, statusCode: 200 } as IN8nHttpFullResponse;
}

describe('omitUnsupportedTravelModeOptions', () => {
	it.each(['BICYCLE', 'TRANSIT', 'WALK'])(
		'omits routingPreference for %s requests',
		async (travelMode) => {
			const ctx = createMockContext({ parameters: { travelMode } });
			const requestOptions = {
				url: 'https://routes.googleapis.com',
				body: { travelMode, routingPreference: 'TRAFFIC_UNAWARE' },
			};

			await omitUnsupportedTravelModeOptions.call(ctx, requestOptions);

			expect(requestOptions.body).toEqual({ travelMode });
		},
	);

	it.each(['DRIVE', 'TWO_WHEELER'])(
		'keeps routingPreference for %s requests',
		async (travelMode) => {
			const ctx = createMockContext({ parameters: { travelMode } });
			const requestOptions = {
				url: 'https://routes.googleapis.com',
				body: { travelMode, routingPreference: 'TRAFFIC_UNAWARE' },
			};

			await omitUnsupportedTravelModeOptions.call(ctx, requestOptions);

			expect(requestOptions.body).toEqual({ travelMode, routingPreference: 'TRAFFIC_UNAWARE' });
		},
	);

	it('omits intermediate waypoints for transit requests', async () => {
		const ctx = createMockContext({ parameters: { travelMode: 'TRANSIT' } });
		const requestOptions = {
			url: 'https://routes.googleapis.com',
			body: {
				travelMode: 'TRANSIT',
				routingPreference: 'TRAFFIC_UNAWARE',
				intermediates: [{ address: 'Stale waypoint' }],
			},
		};

		await omitUnsupportedTravelModeOptions.call(ctx, requestOptions);

		expect(requestOptions.body).toEqual({ travelMode: 'TRANSIT' });
	});
});

describe('setRouteTimes', () => {
	it('omits route times when they are blank', async () => {
		const ctx = createMockContext({ parameters: { departureTime: '', arrivalTime: '' } });
		const requestOptions = {
			url: 'https://routes.googleapis.com',
			body: { departureTime: '', arrivalTime: '' },
		};

		await setRouteTimes.call(ctx, requestOptions);

		expect(requestOptions.body).toEqual({});
	});

	it('converts departureTime to RFC 3339 UTC format', async () => {
		const ctx = createMockContext({
			parameters: { departureTime: '2026-09-04T09:30:00+02:00' },
		});
		const requestOptions = {
			url: 'https://routes.googleapis.com',
			body: { departureTime: '2026-09-04T09:30:00+02:00' },
		};

		await setRouteTimes.call(ctx, requestOptions);

		expect(requestOptions.body.departureTime).toBe('2026-09-04T07:30:00.000Z');
	});

	it('converts arrivalTime for transit requests to RFC 3339 UTC format', async () => {
		const ctx = createMockContext({
			parameters: { travelMode: 'TRANSIT', arrivalTime: '2026-09-04T09:30:00+02:00' },
		});
		const requestOptions = {
			url: 'https://routes.googleapis.com',
			body: { travelMode: 'TRANSIT', arrivalTime: '2026-09-04T09:30:00+02:00' },
		};

		await setRouteTimes.call(ctx, requestOptions);

		expect(requestOptions.body.arrivalTime).toBe('2026-09-04T07:30:00.000Z');
	});

	it('omits a stale arrivalTime for non-transit requests', async () => {
		const ctx = createMockContext({
			parameters: { travelMode: 'DRIVE', arrivalTime: '2026-09-04T09:30:00+02:00' },
		});
		const requestOptions = {
			url: 'https://routes.googleapis.com',
			body: { travelMode: 'DRIVE', arrivalTime: '2026-09-04T09:30:00+02:00' },
		};

		await setRouteTimes.call(ctx, requestOptions);

		expect(requestOptions.body).toEqual({ travelMode: 'DRIVE' });
	});

	it('rejects setting both departureTime and arrivalTime for transit', async () => {
		const ctx = createMockContext({
			parameters: {
				travelMode: 'TRANSIT',
				departureTime: '2026-09-04T08:30:00Z',
				arrivalTime: '2026-09-04T09:30:00Z',
			},
		});
		const requestOptions = {
			url: 'https://routes.googleapis.com',
			body: {
				travelMode: 'TRANSIT',
				departureTime: '2026-09-04T08:30:00Z',
				arrivalTime: '2026-09-04T09:30:00Z',
			},
		};

		await expect(setRouteTimes.call(ctx, requestOptions)).rejects.toThrow(
			/Set either Departure Time or Arrival Time, not both/,
		);
	});

	it('rejects an invalid departureTime', async () => {
		const ctx = createMockContext({ parameters: { departureTime: 'not-a-date' } });
		const requestOptions = {
			url: 'https://routes.googleapis.com',
			body: { departureTime: 'not-a-date' },
		};

		await expect(setRouteTimes.call(ctx, requestOptions)).rejects.toThrow(
			/Departure Time must be a valid date and time/,
		);
	});
});

describe('validateWaypointCount', () => {
	it('passes through when under the limit', async () => {
		const ctx = createMockContext({ parameters: { waypoints: Array(10).fill('addr') } });
		const requestOptions = { url: 'https://routes.googleapis.com' };
		await expect(validateWaypointCount.call(ctx, requestOptions)).resolves.toBe(requestOptions);
	});

	it('throws when over 25 waypoints', async () => {
		const ctx = createMockContext({ parameters: { waypoints: Array(26).fill('addr') } });
		await expect(
			validateWaypointCount.call(ctx, { url: 'https://routes.googleapis.com' }),
		).rejects.toThrow(/25 intermediate waypoints/);
	});
});

describe('validateRouteMatrixSize', () => {
	const baseParams = { travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE' };

	it('passes under the 625-element limit', async () => {
		const ctx = createMockContext({
			parameters: { ...baseParams, origins: Array(20).fill('a'), destinations: Array(20).fill('b') },
		});
		await expect(
			validateRouteMatrixSize.call(ctx, { url: 'https://routes.googleapis.com' }),
		).resolves.toBeDefined();
	});

	it('throws over the 625-element limit', async () => {
		const ctx = createMockContext({
			parameters: { ...baseParams, origins: Array(26).fill('a'), destinations: Array(25).fill('b') },
		});
		await expect(
			validateRouteMatrixSize.call(ctx, { url: 'https://routes.googleapis.com' }),
		).rejects.toThrow(/625-element limit/);
	});

	it('throws over the 100-element limit when travelMode is TRANSIT', async () => {
		const ctx = createMockContext({
			parameters: {
				...baseParams,
				travelMode: 'TRANSIT',
				origins: Array(11).fill('a'),
				destinations: Array(10).fill('b'),
			},
		});
		await expect(
			validateRouteMatrixSize.call(ctx, { url: 'https://routes.googleapis.com' }),
		).rejects.toThrow(/100-element limit/);
	});

	it('throws over the 100-element limit when routingPreference is TRAFFIC_AWARE_OPTIMAL', async () => {
		const ctx = createMockContext({
			parameters: {
				...baseParams,
				routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
				origins: Array(11).fill('a'),
				destinations: Array(10).fill('b'),
			},
		});
		await expect(
			validateRouteMatrixSize.call(ctx, { url: 'https://routes.googleapis.com' }),
		).rejects.toThrow(/100-element limit/);
	});

	it('allows exactly 100 elements under TRANSIT', async () => {
		const ctx = createMockContext({
			parameters: {
				...baseParams,
				travelMode: 'TRANSIT',
				origins: Array(10).fill('a'),
				destinations: Array(10).fill('b'),
			},
		});
		await expect(
			validateRouteMatrixSize.call(ctx, { url: 'https://routes.googleapis.com' }),
		).resolves.toBeDefined();
	});
});

describe('handleGeocodingResponse', () => {
	it('returns only the first match by default', async () => {
		const ctx = createMockContext({ parameters: { returnAllMatches: false } });
		const body = { status: 'OK', results: [{ formatted_address: 'A' }, { formatted_address: 'B' }] };
		const items = await handleGeocodingResponse.call(ctx, dummyItems, mockResponse(body));
		expect(items).toHaveLength(1);
		expect(items[0].json).toEqual({ formatted_address: 'A' });
	});

	it('returns every match when Return All Matches is on', async () => {
		const ctx = createMockContext({ parameters: { returnAllMatches: true } });
		const body = { status: 'OK', results: [{ formatted_address: 'A' }, { formatted_address: 'B' }] };
		const items = await handleGeocodingResponse.call(ctx, dummyItems, mockResponse(body));
		expect(items).toHaveLength(2);
	});

	it('returns one flagged item for ZERO_RESULTS instead of throwing or dropping it', async () => {
		const ctx = createMockContext({});
		const body = { status: 'ZERO_RESULTS', results: [] };
		const items = await handleGeocodingResponse.call(ctx, dummyItems, mockResponse(body));
		expect(items).toHaveLength(1);
		expect(items[0].json).toMatchObject({ status: 'ZERO_RESULTS' });
	});

	it('throws NodeApiError for REQUEST_DENIED when Continue On Fail is off', async () => {
		const ctx = createMockContext({ continueOnFail: false });
		const body = { status: 'REQUEST_DENIED', error_message: 'Invalid key' };
		await expect(handleGeocodingResponse.call(ctx, dummyItems, mockResponse(body))).rejects.toThrow(
			/Invalid key/,
		);
	});

	it('returns a flagged error item for REQUEST_DENIED when Continue On Fail is on', async () => {
		const ctx = createMockContext({ continueOnFail: true });
		const body = { status: 'REQUEST_DENIED', error_message: 'Invalid key' };
		const items = await handleGeocodingResponse.call(ctx, dummyItems, mockResponse(body));
		expect(items).toHaveLength(1);
		expect(items[0].json).toMatchObject({ error: 'Invalid key', status: 'REQUEST_DENIED' });
	});
});

describe('handleTimezoneResponse', () => {
	it('passes the body through on OK', async () => {
		const ctx = createMockContext({});
		const body = { status: 'OK', timeZoneId: 'Europe/Berlin' };
		const items = await handleTimezoneResponse.call(ctx, dummyItems, mockResponse(body));
		expect(items[0].json).toEqual(body);
	});

	it('returns a flagged item on non-OK status when Continue On Fail is on', async () => {
		const ctx = createMockContext({ continueOnFail: true });
		const body = { status: 'INVALID_REQUEST' };
		const items = await handleTimezoneResponse.call(ctx, dummyItems, mockResponse(body));
		expect(items[0].json).toMatchObject({ status: 'INVALID_REQUEST' });
	});

	it('throws when Continue On Fail is off', async () => {
		const ctx = createMockContext({ continueOnFail: false });
		const body = { status: 'INVALID_REQUEST' };
		await expect(handleTimezoneResponse.call(ctx, dummyItems, mockResponse(body))).rejects.toThrow();
	});
});

describe('flattenRouteMatrixResponse', () => {
	it('re-labels elements by address instead of index', async () => {
		const ctx = createMockContext({
			parameters: { origins: ['Origin A', 'Origin B'], destinations: ['Dest A', 'Dest B'] },
		});
		const body = [
			{ originIndex: 0, destinationIndex: 1, status: {}, condition: 'ROUTE_EXISTS', distanceMeters: 100, duration: '10s' },
			{ originIndex: 1, destinationIndex: 0, status: {}, condition: 'ROUTE_EXISTS', distanceMeters: 200, duration: '20s' },
		];
		const items = await flattenRouteMatrixResponse.call(ctx, dummyItems, mockResponse(body));
		expect(items).toHaveLength(2);
		expect(items[0].json).toMatchObject({ origin: 'Origin A', destination: 'Dest B', distanceMeters: 100 });
		expect(items[1].json).toMatchObject({ origin: 'Origin B', destination: 'Dest A', distanceMeters: 200 });
	});

	it('handles originIndex/destinationIndex of 0 correctly (not falsy-skipped)', async () => {
		const ctx = createMockContext({ parameters: { origins: ['Only Origin'], destinations: ['Only Dest'] } });
		const body = [{ originIndex: 0, destinationIndex: 0, status: {}, distanceMeters: 5, duration: '1s' }];
		const items = await flattenRouteMatrixResponse.call(ctx, dummyItems, mockResponse(body));
		expect(items[0].json.origin).toBe('Only Origin');
		expect(items[0].json.destination).toBe('Only Dest');
	});

	it('surfaces a per-element error without throwing or dropping other elements', async () => {
		const ctx = createMockContext({ parameters: { origins: ['A', 'C'], destinations: ['B'] } });
		const body = [
			{ originIndex: 0, destinationIndex: 0, status: { code: 5, message: 'Address not found.' } },
			{ originIndex: 1, destinationIndex: 0, status: {}, distanceMeters: 10, duration: '1s' },
		];
		const items = await flattenRouteMatrixResponse.call(ctx, dummyItems, mockResponse(body));
		expect(items).toHaveLength(2);
		expect(items[0].json).toMatchObject({ error: 'Address not found.', errorCode: 5 });
		expect(items[1].json).toMatchObject({ origin: 'C', distanceMeters: 10 });
		expect(items[1].json.error).toBeUndefined();
	});
});
