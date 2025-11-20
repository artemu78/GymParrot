import { describe, expect, test } from "vitest";
import { render } from "@testing-library/react";
import App from "./App.tsx";

describe("App", () => {
  test("renders without crashing", () => {
    const { container } = render(<App />);
    expect(container).toBeDefined();
  });
});
