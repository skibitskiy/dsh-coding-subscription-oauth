import { describe, expect, it } from "vitest";
import { sanitizeGrokToolParameters, sanitizeGrokToolSchemas } from "../src/grok-tool-schema.ts";

/** Real MCP schema that Grok rejected with 400 INVALID_REQUEST. */
const CUA_BROWSER_PREPARE = {
	type: "object",
	properties: {
		pid: { type: "integer" },
		allow_launch: { type: "boolean" },
	},
	required: [],
	additionalProperties: true,
	anyOf: [{ required: ["pid"] }, { required: ["allow_launch"], properties: { allow_launch: { const: true } } }],
} as const;

describe("sanitizeGrokToolParameters", () => {
	it("gives object type to anyOf branches that only set required", () => {
		const sanitized = sanitizeGrokToolParameters({ ...CUA_BROWSER_PREPARE });
		expect(sanitized["type"]).toBe("object");
		const anyOf = sanitized["anyOf"];
		expect(Array.isArray(anyOf)).toBe(true);
		if (!Array.isArray(anyOf)) return;
		expect(anyOf).toHaveLength(2);
		for (const branch of anyOf) {
			expect(branch).toMatchObject({ type: "object" });
		}
		expect(anyOf[0]).toMatchObject({ required: ["pid"] });
	});

	it("drops a root union that still has a non-object branch", () => {
		const sanitized = sanitizeGrokToolParameters({
			type: "object",
			properties: { name: { type: "string" } },
			anyOf: [{ type: "string" }, { type: "object", required: ["name"] }],
		});
		expect(sanitized["anyOf"]).toBeUndefined();
		expect(sanitized["type"]).toBe("object");
		expect(sanitized["properties"]).toEqual({ name: { type: "string" } });
	});

	it("does not mutate the input document", () => {
		const input = { ...CUA_BROWSER_PREPARE, anyOf: CUA_BROWSER_PREPARE.anyOf.map((branch) => ({ ...branch })) };
		sanitizeGrokToolParameters(input);
		expect(input.anyOf[0]).toEqual({ required: ["pid"] });
	});
});

describe("sanitizeGrokToolSchemas", () => {
	it("returns undefined when the request has no tools", () => {
		expect(sanitizeGrokToolSchemas(undefined)).toBeUndefined();
	});

	it("clones each tool and sanitizes parameters", () => {
		const tools = [
			{
				name: "mcp__cua__browser_prepare",
				description: "prepare",
				parameters: { ...CUA_BROWSER_PREPARE },
			},
		];
		const sanitized = sanitizeGrokToolSchemas(tools);
		expect(sanitized).toHaveLength(1);
		expect(sanitized?.[0]?.name).toBe("mcp__cua__browser_prepare");
		expect(sanitized?.[0]).not.toBe(tools[0]);
		const anyOf = sanitized?.[0]?.parameters["anyOf"];
		expect(Array.isArray(anyOf) && anyOf[0]).toMatchObject({ type: "object", required: ["pid"] });
	});
});
