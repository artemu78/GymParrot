import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ActivityBrowser from "../ActivityBrowser";
import { activityService } from "../../services";
import type { Activity } from "../../types";

// Mock the activity service
vi.mock("../../services", () => ({
  activityService: {
    getActivities: vi.fn(),
  },
}));

describe("ActivityBrowser", () => {
  const mockActivities: Activity[] = [
    {
      id: "pose-1",
      type: "pose",
      name: "Warrior Pose",
      createdBy: "yoga_instructor",
      createdAt: new Date("2024-01-15"),
      isPublic: true,
      landmarks: [],
    },
    {
      id: "movement-1",
      type: "movement",
      name: "Push-up Exercise",
      createdBy: "fitness_trainer",
      createdAt: new Date("2024-01-20"),
      duration: 30000,
      isPublic: true,
      landmarks: [],
    },
    {
      id: "pose-2",
      type: "pose",
      name: "Tree Pose",
      createdBy: "yoga_instructor",
      createdAt: new Date("2024-01-25"),
      isPublic: true,
      landmarks: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(activityService.getActivities).mockResolvedValue(mockActivities);
  });

  it("should render header correctly", async () => {
    const { container } = render(<ActivityBrowser />);

    expect(container.textContent).toContain("Browse Activities");
    expect(container.textContent).toContain("Choose an activity to practice");

    await waitFor(() => {
      expect(container.textContent).toContain("3 activities available");
    });
  });

  it("should load and display activities", async () => {
    const { container } = render(<ActivityBrowser />);

    await waitFor(() => {
      expect(container.textContent).toContain("Warrior Pose");
      expect(container.textContent).toContain("Push-up Exercise");
      expect(container.textContent).toContain("Tree Pose");
    });

    expect(activityService.getActivities).toHaveBeenCalledTimes(1);
  });

  it("should show loading state initially", () => {
    const { container } = render(<ActivityBrowser />);

    expect(container.textContent).toContain("Loading activities...");
  });

  it("should handle activity selection", async () => {
    const onActivitySelect = vi.fn();
    const { container } = render(
      <ActivityBrowser onActivitySelect={onActivitySelect} />
    );

    await waitFor(() => {
      expect(container.textContent).toContain("Warrior Pose");
    });

    // Click on the first activity's practice button
    const practiceButtons = Array.from(
      container.querySelectorAll("button")
    ).filter((btn) => btn.textContent?.includes("Practice Activity"));

    fireEvent.click(practiceButtons[0]);

    expect(onActivitySelect).toHaveBeenCalledWith(mockActivities[0]);
  });

  it("should filter activities by type", async () => {
    const { container } = render(<ActivityBrowser />);

    await waitFor(() => {
      expect(container.textContent).toContain("3 activities available");
    });

    // Filter by pose type
    const typeFilter = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(typeFilter, { target: { value: "pose" } });

    await waitFor(() => {
      expect(container.textContent).toContain("Showing 2 of 3 activities");
      expect(container.textContent).toContain("Warrior Pose");
      expect(container.textContent).toContain("Tree Pose");
      expect(container.textContent).not.toContain("Push-up Exercise");
    });
  });

  it("should filter activities by search term", async () => {
    const { container } = render(<ActivityBrowser />);

    await waitFor(() => {
      expect(container.textContent).toContain("3 activities available");
    });

    // Search for "warrior"
    const searchInput = container.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "warrior" } });

    await waitFor(() => {
      expect(container.textContent).toContain("Showing 1 of 3 activities");
      expect(container.textContent).toContain("Warrior Pose");
      expect(container.textContent).not.toContain("Push-up Exercise");
      expect(container.textContent).not.toContain("Tree Pose");
    });
  });

  it("should search by creator name", async () => {
    const { container } = render(<ActivityBrowser />);

    await waitFor(() => {
      expect(container.textContent).toContain("3 activities available");
    });

    // Search for "fitness"
    const searchInput = container.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "fitness" } });

    await waitFor(() => {
      expect(container.textContent).toContain("Showing 1 of 3 activities");
      expect(container.textContent).toContain("Push-up Exercise");
      expect(container.textContent).not.toContain("Warrior Pose");
    });
  });

  it("should clear filters", async () => {
    const { container } = render(<ActivityBrowser />);

    await waitFor(() => {
      expect(container.textContent).toContain("3 activities available");
    });

    // Apply filters
    const typeFilter = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(typeFilter, { target: { value: "pose" } });

    const searchInput = container.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "warrior" } });

    await waitFor(() => {
      expect(container.textContent).toContain("Clear Filters");
    });

    // Clear filters
    const clearButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Clear Filters")
    ) as HTMLButtonElement;
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(container.textContent).toContain("3 activities available");
      expect(searchInput.value).toBe("");
      expect(typeFilter.value).toBe("all");
    });
  });

  it("should show empty state when no activities match filters", async () => {
    const { container } = render(<ActivityBrowser />);

    await waitFor(() => {
      expect(container.textContent).toContain("3 activities available");
    });

    // Search for something that doesn't exist
    const searchInput = container.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    await waitFor(() => {
      expect(container.textContent).toContain(
        "No activities match your filters"
      );
      expect(container.textContent).toContain(
        "Try adjusting your search or filter criteria"
      );
    });
  });

  it("should show empty state when no activities available", async () => {
    vi.mocked(activityService.getActivities).mockResolvedValue([]);

    const { container } = render(<ActivityBrowser />);

    await waitFor(() => {
      expect(container.textContent).toContain("No activities available");
      expect(container.textContent).toContain(
        "Activities created by trainers will appear here"
      );
    });
  });

  it("should handle loading errors", async () => {
    const onError = vi.fn();
    vi.mocked(activityService.getActivities).mockRejectedValue(
      new Error("Network error")
    );

    const { container } = render(<ActivityBrowser onError={onError} />);

    await waitFor(() => {
      expect(container.textContent).toContain("Network error");
      expect(onError).toHaveBeenCalledWith("Network error");
    });
  });

  it("should allow error dismissal", async () => {
    vi.mocked(activityService.getActivities).mockRejectedValue(
      new Error("Network error")
    );

    const { container } = render(<ActivityBrowser />);

    await waitFor(() => {
      expect(container.textContent).toContain("Network error");
    });

    // Find and click dismiss button
    const dismissButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.querySelector(".sr-only")?.textContent === "Dismiss"
    ) as HTMLButtonElement;
    fireEvent.click(dismissButton);

    await waitFor(() => {
      expect(container.textContent).not.toContain("Network error");
    });
  });

  it("should refresh activities", async () => {
    const { container } = render(<ActivityBrowser />);

    await waitFor(() => {
      expect(container.textContent).toContain("3 activities available");
    });

    // Clear the mock and set new data
    vi.clearAllMocks();
    vi.mocked(activityService.getActivities).mockResolvedValue([
      mockActivities[0],
    ]);

    // Click refresh button
    const refreshButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Refresh")
    ) as HTMLButtonElement;
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(activityService.getActivities).toHaveBeenCalledTimes(1);
      expect(container.textContent).toContain("1 activities available");
    });
  });

  it("should display activity metadata correctly", async () => {
    const { container } = render(<ActivityBrowser />);

    await waitFor(() => {
      expect(container.textContent).toContain("Warrior Pose");
      expect(container.textContent).toContain("By yoga_instructor");
      expect(container.textContent).toContain("Jan 15, 2024");
      expect(container.textContent).toContain("Single pose");

      expect(container.textContent).toContain("Push-up Exercise");
      expect(container.textContent).toContain("By fitness_trainer");
      expect(container.textContent).toContain("30s");
    });
  });

  it("should show correct type badges", async () => {
    const { container } = render(<ActivityBrowser />);

    await waitFor(() => {
      const badges = container.querySelectorAll(".bg-green-100, .bg-blue-100");
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it("should disable refresh button while loading", async () => {
    // Make the service call hang
    vi.mocked(activityService.getActivities).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 1000))
    );

    const { container } = render(<ActivityBrowser />);

    const refreshButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Refresh")
    ) as HTMLButtonElement;

    expect(refreshButton.disabled).toBe(true);
  });

  it("should handle case-insensitive search", async () => {
    const { container } = render(<ActivityBrowser />);

    await waitFor(() => {
      expect(container.textContent).toContain("3 activities available");
    });

    // Search with different case
    const searchInput = container.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "WARRIOR" } });

    await waitFor(() => {
      expect(container.textContent).toContain("Showing 1 of 3 activities");
      expect(container.textContent).toContain("Warrior Pose");
    });
  });

  it("should combine type and search filters", async () => {
    const { container } = render(<ActivityBrowser />);

    await waitFor(() => {
      expect(container.textContent).toContain("3 activities available");
    });

    // Filter by pose type and search for "tree"
    const typeFilter = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(typeFilter, { target: { value: "pose" } });

    const searchInput = container.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "tree" } });

    await waitFor(() => {
      expect(container.textContent).toContain("Showing 1 of 3 activities");
      expect(container.textContent).toContain("Tree Pose");
      expect(container.textContent).not.toContain("Warrior Pose");
      expect(container.textContent).not.toContain("Push-up Exercise");
    });
  });
});
