import "@testing-library/jest-dom";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

configure({ asyncUtilTimeout: 4000 });

Object.defineProperty(window, "confirm", {
  configurable: true,
  value: () => true,
});

Object.defineProperties(HTMLMediaElement.prototype, {
  load: { configurable: true, value: () => undefined },
  pause: { configurable: true, value: () => undefined },
  play: { configurable: true, value: () => Promise.resolve() },
});

afterEach(() => {
  cleanup();
  if (typeof window.localStorage?.clear === "function") {
    window.localStorage.clear();
  }
  if (typeof window.sessionStorage?.clear === "function") {
    window.sessionStorage.clear();
  }
});
