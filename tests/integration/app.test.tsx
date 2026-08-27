import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../../src/App";

describe("human fallback workspace", () => {
  it("works without document.modelContext and exposes all six findings", async () => {
    render(<App />);
    expect(document.querySelector(".webmcp-pill")).toHaveTextContent(/WebMCP unavailable/i);
    fireEvent.click(screen.getByRole("button", { name: /Run accessibility scan/i }));
    await waitFor(() => expect(screen.getByText("6 open · 0 fixed")).toBeInTheDocument());
    expect(screen.getAllByText(/A11Y-00[1-6]/)).toHaveLength(6);
  });

  it("reset returns the workspace to the exact baseline", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Run accessibility scan/i }));
    await screen.findByText("6 open · 0 fixed");
    fireEvent.click(screen.getByRole("button", { name: /Reset demo/i }));
    expect(screen.getByText("No scan recorded")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
  });
});
