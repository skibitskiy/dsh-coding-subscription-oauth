/**
 * xAI Grok Build rejects tool parameters whose root (or a union branch) is not
 * an object schema. MCP servers often emit `anyOf`/`oneOf` branches that only
 * set `required` — Grok answers 400 INVALID_REQUEST and never starts the turn.
 * @module dsh-coding-subscription-oauth/grok-tool-schema
 */

import type { ToolSchema } from "@deepseek-ai/dsh-llm";

const UNION_KEYS = ["anyOf", "oneOf"] as const;
const NEST_KEYS = ["allOf", "not", "if", "then", "else"] as const;
const MAX_DEPTH = 32;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function schemaType(value: Record<string, unknown>): unknown {
	return value["type"];
}

function typeIncludesObject(type: unknown): boolean {
	if (type === "object") return true;
	return Array.isArray(type) && type.includes("object");
}

function looksNonObjectBranch(branch: unknown): boolean {
	if (!isRecord(branch)) return true;
	const type = schemaType(branch);
	if (type === undefined) return false;
	if (typeof type === "string") return type !== "object";
	if (Array.isArray(type)) return !type.includes("object");
	return true;
}

function coerceUnionBranch(branch: unknown, depth: number): unknown {
	if (!isRecord(branch)) return branch;
	const next: Record<string, unknown> = { ...branch };
	if (schemaType(next) === undefined) next["type"] = "object";
	return sanitizeNode(next, depth + 1);
}

function sanitizeNode(schema: Record<string, unknown>, depth: number): Record<string, unknown> {
	if (depth > MAX_DEPTH) return schema;
	const next: Record<string, unknown> = { ...schema };
	for (const key of UNION_KEYS) {
		const union = next[key];
		if (!Array.isArray(union)) continue;
		next[key] = union.map((branch) => coerceUnionBranch(branch, depth));
	}
	for (const key of NEST_KEYS) {
		const nested = next[key];
		if (isRecord(nested)) next[key] = sanitizeNode(nested, depth + 1);
		else if (Array.isArray(nested)) {
			next[key] = nested.map((item) => (isRecord(item) ? sanitizeNode(item, depth + 1) : item));
		}
	}
	if (isRecord(next["properties"])) {
		const properties: Record<string, unknown> = {};
		for (const [name, value] of Object.entries(next["properties"])) {
			properties[name] = isRecord(value) ? sanitizeNode(value, depth + 1) : value;
		}
		next["properties"] = properties;
	}
	if (isRecord(next["patternProperties"])) {
		const patternProperties: Record<string, unknown> = {};
		for (const [name, value] of Object.entries(next["patternProperties"])) {
			patternProperties[name] = isRecord(value) ? sanitizeNode(value, depth + 1) : value;
		}
		next["patternProperties"] = patternProperties;
	}
	if (isRecord(next["additionalProperties"])) {
		next["additionalProperties"] = sanitizeNode(next["additionalProperties"], depth + 1);
	}
	if (isRecord(next["items"])) next["items"] = sanitizeNode(next["items"], depth + 1);
	else if (Array.isArray(next["items"])) {
		next["items"] = next["items"].map((item) => (isRecord(item) ? sanitizeNode(item, depth + 1) : item));
	}
	if (isRecord(next["$defs"])) {
		const defs: Record<string, unknown> = {};
		for (const [name, value] of Object.entries(next["$defs"])) {
			defs[name] = isRecord(value) ? sanitizeNode(value, depth + 1) : value;
		}
		next["$defs"] = defs;
	}
	if (isRecord(next["definitions"])) {
		const definitions: Record<string, unknown> = {};
		for (const [name, value] of Object.entries(next["definitions"])) {
			definitions[name] = isRecord(value) ? sanitizeNode(value, depth + 1) : value;
		}
		next["definitions"] = definitions;
	}
	return next;
}

function dropNonObjectRootUnions(schema: Record<string, unknown>): Record<string, unknown> {
	const next: Record<string, unknown> = { ...schema };
	const rootIsObject = typeIncludesObject(schemaType(next)) || isRecord(next["properties"]);
	if (!rootIsObject) return next;
	for (const key of UNION_KEYS) {
		const union = next[key];
		if (!Array.isArray(union)) continue;
		if (union.some(looksNonObjectBranch)) delete next[key];
	}
	if (schemaType(next) === undefined) next["type"] = "object";
	return next;
}

/** Clone and make a tool JSON Schema acceptable as Grok function parameters. */
export function sanitizeGrokToolParameters(parameters: Record<string, unknown>): Record<string, unknown> {
	return dropNonObjectRootUnions(sanitizeNode(structuredClone(parameters), 0));
}

export function sanitizeGrokToolSchema(tool: ToolSchema): ToolSchema {
	return { ...tool, parameters: sanitizeGrokToolParameters(tool.parameters) };
}

export function sanitizeGrokToolSchemas(tools: readonly ToolSchema[] | undefined): ToolSchema[] | undefined {
	if (tools === undefined) return undefined;
	return tools.map(sanitizeGrokToolSchema);
}
