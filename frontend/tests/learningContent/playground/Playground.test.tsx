import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../src/i18n";
import LearningContentPlayground from "../../../src/features/learningContent/playground/LearningContentPlayground";
import { keit } from "../fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function open() {
  return render(<MemoryRouter><I18nProvider><LearningContentPlayground /></I18nProvider></MemoryRouter>);
}

it("loads the catalog read-only, previews it and changes languages without changing app preferences", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ definitions: [keit] }));
  vi.stubGlobal("fetch", fetch);
  localStorage.setItem("app_language", "en");
  localStorage.setItem("smart-language-learning-auth-token", "admin-token");
  open();
  expect(screen.getByRole("status")).toHaveTextContent("Loading definitions");
  expect(await screen.findByText("posible → posibilidad")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, request] = fetch.mock.calls[0];
  expect(url).toMatch(/\/api\/admin\/learning-content$/);
  expect(request.method).toBeUndefined();
  expect(request.cache).toBe("no-store");
  expect(request.headers.get("Authorization")).toBe("Bearer admin-token");
  fireEvent.change(screen.getByLabelText("Preview interface language"), { target: { value: "es" } });
  expect(screen.getByText("Expresa una cualidad o un estado.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Translation language"), { target: { value: "english" } });
  expect(screen.getByText("possible → possibility")).toBeInTheDocument();
  expect(localStorage.getItem("app_language")).toBe("en");
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByLabelText("Narrow preview"));
  expect(screen.getByRole("region", { name: "Item view preview" })).toHaveClass("learning-content-playground__preview--narrow");
});

it("switches definitions and reloads the actual catalog", async () => {
  const second = { ...keit, key: "second", display: { en: { title: "Second", explanation: "Another definition" } } };
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ definitions: [keit, second] }))
    .mockResolvedValueOnce(Response.json({ definitions: [{ ...second, display: { en: { title: "Updated", explanation: "Fresh data" } } }] }));
  vi.stubGlobal("fetch", fetch);
  open();
  await screen.findByRole("heading", { name: "-keit" });
  fireEvent.change(screen.getByLabelText("Definition"), { target: { value: "second" } });
  expect(screen.getByRole("heading", { name: "Second" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reload definitions" }));
  expect(await screen.findByRole("heading", { name: "Updated" })).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("closes and reopens the item without refetching or losing preview language settings", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ definitions: [keit] }));
  vi.stubGlobal("fetch", fetch);
  open();
  await screen.findByRole("heading", { name: "-keit" });
  fireEvent.change(screen.getByLabelText("Preview interface language"), { target: { value: "es" } });
  fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
  expect(screen.queryByRole("region", { name: "Item view preview" })).not.toBeInTheDocument();
  const reopen = screen.getByRole("button", { name: "Open item view" });
  expect(reopen).toHaveFocus();
  fireEvent.click(reopen);
  expect(screen.getByRole("heading", { name: "-keit" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledOnce();
});

it.each([
  [401, "The backend denied access"],
  [403, "The backend denied access"],
  [404, "The backend does not have the definitions endpoint"],
  [500, "The backend could not load the definitions"],
] as const)("shows request errors (%s) and can retry", async (status, message) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status }))
    .mockResolvedValueOnce(Response.json({ definitions: [keit] })));
  open();
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(screen.getByRole("alert")).toHaveTextContent(`HTTP ${status}`);
  fireEvent.click(screen.getByRole("button", { name: "Reload definitions" }));
  expect(await screen.findByRole("heading", { name: "-keit" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("shows an explicit empty state", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ definitions: [] })));
  open();
  expect(await screen.findByText("No definitions have been registered yet.")).toBeInTheDocument();
});

it("shows an error for an invalid catalog instead of inventing sample content", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));
  open();
  expect(await screen.findByRole("alert")).toHaveTextContent("unexpected response");
  expect(screen.queryByRole("heading", { name: "-keit" })).not.toBeInTheDocument();
});

it("reports a connection failure without blaming administrator permissions", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  localStorage.setItem("app_language", "es");
  open();
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo conectar con el backend");
  expect(screen.getByRole("alert")).not.toHaveTextContent("administración");
});

it("reports HTML responses as invalid catalog data", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Not the API</html>")));
  open();
  expect(await screen.findByRole("alert")).toHaveTextContent("unexpected response");
});

it("aborts loading when leaving the playground", async () => {
  const fetch = vi.fn(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetch);
  const view = open();
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  const [, options] = (fetch.mock.calls as unknown as [string, RequestInit][])[0];
  view.unmount();
  expect(options.signal?.aborted).toBe(true);
});
