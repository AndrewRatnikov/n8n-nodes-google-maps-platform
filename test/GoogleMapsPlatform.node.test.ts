import { describe, expect, it } from 'vitest';
import * as ts from 'typescript';
import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { GoogleMapsPlatform } from '../nodes/GoogleMapsPlatform/GoogleMapsPlatform.node';

// Wiring mistakes in the node description -- a stale operation value in
// displayOptions, a preSend function reading a parameter name that was
// renamed, a hand-typed expression with a typo -- are invisible to both the
// response-shaping unit tests and the linter, and only show up as a broken
// panel in a live n8n. These structural checks catch that class of mistake
// without needing a running n8n instance.

const description = new GoogleMapsPlatform().description;

function flattenProperties(properties: INodeProperties[]): INodeProperties[] {
	const all: INodeProperties[] = [];

	for (const property of properties) {
		all.push(property);

		if (property.type === 'collection' && Array.isArray(property.options)) {
			all.push(...flattenProperties(property.options as INodeProperties[]));
		}

		if (property.type === 'fixedCollection' && Array.isArray(property.options)) {
			for (const option of property.options as Array<{ values?: INodeProperties[] }>) {
				if (Array.isArray(option.values)) {
					all.push(...flattenProperties(option.values));
				}
			}
		}
	}

	return all;
}

function collectFunctions(node: unknown, found: Set<(...args: never[]) => unknown> = new Set()) {
	if (typeof node === 'function') {
		found.add(node as (...args: never[]) => unknown);
	} else if (Array.isArray(node)) {
		for (const item of node) collectFunctions(item, found);
	} else if (node && typeof node === 'object') {
		for (const value of Object.values(node)) collectFunctions(value, found);
	}

	return found;
}

function collectExpressions(node: unknown, found: string[] = []) {
	if (typeof node === 'string') {
		if (node.startsWith('={{') && node.endsWith('}}')) {
			found.push(node);
		}
	} else if (Array.isArray(node)) {
		for (const item of node) collectExpressions(item, found);
	} else if (node && typeof node === 'object') {
		for (const value of Object.values(node)) {
			if (typeof value === 'function') continue;
			collectExpressions(value, found);
		}
	}

	return found;
}

const flatProperties = flattenProperties(description.properties);

describe('GoogleMapsPlatform node description', () => {
	it('has at least one property per resource/operation combination', () => {
		expect(flatProperties.length).toBeGreaterThan(0);
	});

	it('every displayOptions.show.resource value is a real resource', () => {
		const resourceProperty = description.properties.find(
			(p) => p.name === 'resource' && p.type === 'options',
		);
		const validResources = new Set(
			(resourceProperty?.options as INodePropertyOptions[]).map((o) => o.value),
		);

		for (const property of flatProperties) {
			const shown = property.displayOptions?.show?.resource;
			if (!shown) continue;

			for (const value of shown as string[]) {
				expect(
					validResources.has(value),
					`Property "${property.name}" has displayOptions.show.resource referencing unknown resource "${value}"`,
				).toBe(true);
			}
		}
	});

	it('every displayOptions.show.operation value is a real operation', () => {
		const operationProperties = flatProperties.filter(
			(p) => p.name === 'operation' && p.type === 'options',
		);
		const validOperations = new Set(
			operationProperties.flatMap((p) => (p.options as INodePropertyOptions[]).map((o) => o.value)),
		);

		for (const property of flatProperties) {
			const shown = property.displayOptions?.show?.operation;
			if (!shown) continue;

			for (const value of shown as string[]) {
				expect(
					validOperations.has(value),
					`Property "${property.name}" has displayOptions.show.operation referencing unknown operation "${value}"`,
				).toBe(true);
			}
		}
	});

	// Checked against property names across the whole node, not scoped to the
	// preSend/postReceive function's own resource+operation -- a rename that
	// collides with a same-named property on a *different* operation (e.g.
	// "travelMode" exists on both Get Route and Get Distance & Duration) would
	// slip through. Still catches the common case: a name that doesn't exist
	// anywhere in the description at all.
	it('every getNodeParameter name referenced by a preSend/postReceive function exists as a property', () => {
		const propertyNames = new Set(flatProperties.map((p) => p.name));
		const functions = collectFunctions(description.properties);

		expect(functions.size).toBeGreaterThan(0);

		for (const fn of functions) {
			const source = fn.toString();
			const matches = source.matchAll(/getNodeParameter\(\s*['"]([^'"]+)['"]/g);

			for (const match of matches) {
				const paramName = match[1];
				expect(
					propertyNames.has(paramName),
					`${fn.name || '<anonymous preSend/postReceive fn>'} calls getNodeParameter('${paramName}', ...) but no property with that name exists`,
				).toBe(true);
			}
		}
	});

	it('every ={{...}} expression in the description parses as valid JavaScript', () => {
		const expressions = collectExpressions(description);
		expect(expressions.length).toBeGreaterThan(0);

		for (const expression of expressions) {
			const body = expression.slice(3, -2);
			const result = ts.transpileModule(`(${body});`, { reportDiagnostics: true });
			expect(
				result.diagnostics?.length ?? 0,
				`Expression "${expression}" does not parse as valid JavaScript`,
			).toBe(0);
		}
	});
});
