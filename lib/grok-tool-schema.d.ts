/**
 * xAI Grok Build rejects tool parameters whose root (or a union branch) is not
 * an object schema. MCP servers often emit `anyOf`/`oneOf` branches that only
 * set `required` — Grok answers 400 INVALID_REQUEST and never starts the turn.
 * @module dsh-coding-subscription-oauth/grok-tool-schema
 */
import type { ToolSchema } from "@deepseek-ai/dsh-llm";
/** Clone and make a tool JSON Schema acceptable as Grok function parameters. */
export declare function sanitizeGrokToolParameters(parameters: Record<string, unknown>): Record<string, unknown>;
export declare function sanitizeGrokToolSchema(tool: ToolSchema): ToolSchema;
export declare function sanitizeGrokToolSchemas(tools: readonly ToolSchema[] | undefined): ToolSchema[] | undefined;
//# sourceMappingURL=grok-tool-schema.d.ts.map