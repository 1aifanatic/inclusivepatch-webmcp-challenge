import { z } from "zod";

export const emptyInputSchema = z.object({}).strict();
export const scanInputSchema = z
  .object({ scope: z.literal("current-fixture").default("current-fixture") })
  .strict();
export const issueInputSchema = z
  .object({ issueId: z.string().regex(/^A11Y-[0-9]{3}$/) })
  .strict();
export const stageFixInputSchema = z
  .object({
    issueId: z.string().regex(/^A11Y-[0-9]{3}$/),
    optionId: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/),
    proposedText: z.string().min(2).max(120).optional(),
  })
  .strict();
export const applyInputSchema = z
  .object({ proposalIds: z.array(z.string().regex(/^PROP-[0-9]{3}$/)).min(1).max(6) })
  .strict();
export const replayInputSchema = z
  .object({ journeyId: z.literal("checkout-keyboard").default("checkout-keyboard") })
  .strict();
export const compareInputSchema = z
  .object({ baselineVersion: z.literal(1), currentVersion: z.number().int().positive() })
  .strict();
export const exportInputSchema = z.object({ format: z.enum(["json", "markdown"]) }).strict();

export const JSON_SCHEMAS = {
  empty: { type: "object", properties: {}, additionalProperties: false },
  scan: {
    type: "object",
    properties: { scope: { type: "string", enum: ["current-fixture"], description: "Scan the open synthetic checkout." } },
    additionalProperties: false,
  },
  issue: {
    type: "object",
    properties: { issueId: { type: "string", pattern: "^A11Y-[0-9]{3}$", description: "Stable issue ID." } },
    required: ["issueId"],
    additionalProperties: false,
  },
  stage: {
    type: "object",
    properties: {
      issueId: { type: "string", pattern: "^A11Y-[0-9]{3}$", description: "Open issue ID." },
      optionId: { type: "string", minLength: 1, maxLength: 50, description: "Permitted fix option ID." },
      proposedText: { type: "string", minLength: 2, maxLength: 120, description: "Reviewed wording for a text option." },
    },
    required: ["issueId", "optionId"],
    additionalProperties: false,
  },
  apply: {
    type: "object",
    properties: {
      proposalIds: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        uniqueItems: true,
        items: { type: "string", pattern: "^PROP-[0-9]{3}$" },
        description: "Current-version approved proposal IDs.",
      },
    },
    required: ["proposalIds"],
    additionalProperties: false,
  },
  replay: {
    type: "object",
    properties: { journeyId: { type: "string", enum: ["checkout-keyboard"] } },
    additionalProperties: false,
  },
  compare: {
    type: "object",
    properties: {
      baselineVersion: { type: "integer", const: 1 },
      currentVersion: { type: "integer", minimum: 1 },
    },
    required: ["baselineVersion", "currentVersion"],
    additionalProperties: false,
  },
  export: {
    type: "object",
    properties: { format: { type: "string", enum: ["json", "markdown"], description: "Local manifest format." } },
    required: ["format"],
    additionalProperties: false,
  },
} as const;
