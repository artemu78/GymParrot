import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App.tsx";

describe("App", () => {
  test("renders", () => {
    render(<App />);
    const browseActivitiesElements = screen.queryAllByText("Browse Activities");
    expect(browseActivitiesElements.length).toBeGreaterThan(0);

    const createActivityElements = screen.queryAllByText("Create Activity");
    expect(createActivityElements.length).toBeGreaterThan(0);
  });

  test("Create Activity button calls setCurrentView"),
    () => {
      render(<App />);
      const createActivityButton = screen.getByText("Create Activity");
      createActivityButton.click();
      expect(screen.getByText("Activity Creator")).toBeDefined();
    };
});
