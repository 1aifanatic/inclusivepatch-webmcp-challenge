import { useEffect, useMemo, useState } from "react";
import type { WorkspacePhase } from "../domain/types";
import type { WorkspaceApi } from "../state/workspaceStore";
import { toolDefinitionsForPhase } from "./toolDefinitions";

export type WebMcpStatus = "registering" | "available" | "unavailable" | "registration-error";

export function useWebMcpTools(phase: WorkspacePhase, api: WorkspaceApi) {
  const [status, setStatus] = useState<WebMcpStatus>("registering");
  const [error, setError] = useState<string | null>(null);
  const tools = useMemo(() => toolDefinitionsForPhase(phase, api), [phase, api]);

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext || typeof modelContext.registerTool !== "function") {
      setStatus("unavailable");
      setError(null);
      return;
    }
    const controller = new AbortController();
    let live = true;
    setStatus("registering");
    setError(null);
    void Promise.all(
      tools.map((tool) => Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal }))),
    )
      .then(() => {
        if (live) setStatus("available");
      })
      .catch((registrationError: unknown) => {
        if (!live || controller.signal.aborted) return;
        setStatus("registration-error");
        setError(registrationError instanceof Error ? registrationError.message : "Unknown registration error");
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [tools]);

  return { status, error, toolNames: tools.map((tool) => tool.name) };
}
