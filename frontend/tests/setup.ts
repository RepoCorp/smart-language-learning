import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";

configure({ asyncUtilTimeout: 4000 });

Object.defineProperty(window, "confirm", {
  configurable: true,
  value: () => true,
});
