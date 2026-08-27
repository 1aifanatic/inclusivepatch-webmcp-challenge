import type { SiteToolDefinition } from "./toolDefinitions";

declare global {
  interface ModelContextRegistrationOptions {
    signal?: AbortSignal;
    exposedTo?: string[];
  }

  interface ModelContext {
    registerTool(tool: SiteToolDefinition, options?: ModelContextRegistrationOptions): Promise<void> | void;
    getTools?(): Promise<SiteToolDefinition[]>;
    executeTool?(tool: SiteToolDefinition, input: string, options?: { signal?: AbortSignal }): Promise<unknown>;
  }

  interface Document {
    modelContext?: ModelContext;
  }
}

export {};
