import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "../routeTree.gen";

// Mock the services
vi.mock("../services/ActivityService");
vi.mock("../services/MediaPipeService");
vi.mock("../services/WebcamService");
vi.mock("../services/ComparisonService");

// Mock components to avoid complex dependencies in routing tests
vi.mock("../components/ActivityBrowser", () => ({
  default: ({ onActivitySelect, initialType, initialDifficulty }: any) => (
    <div data-testid="activity-browser">
      <div>Type: {initialType || "all"}</div>
      <div>Difficulty: {initialDifficulty || "all"}</div>
      <button
        onClick={() =>
          onActivitySelect({ id: "test-activity-1", name: "Test Activity" })
        }
      >
        Select Activity
      </button>
    </div>
  ),
}));

vi.mock("../components/ActivityCreator", () => ({
  default: ({ onActivityCreated, initialType, onTypeChange }: any) => (
    <div data-testid="activity-creator">
      <div>Initial Type: {initialType || "none"}</div>
      <button onClick={() => onTypeChange("pose")}>Set Pose</button>
      <button onClick={() => onTypeChange("movement")}>Set Movement</button>
      <button onClick={() => onActivityCreated("new-activity-id")}>
        Create Activity
      </button>
    </div>
  ),
}));

vi.mock("../components/PracticeInterface", () => ({
  default: ({
    activityId,
    initialDifficulty,
    mode,
    onComplete,
    onDifficultyChange,
  }: any) => (
    <div data-testid="practice-interface">
      <div>Activity ID: {activityId}</div>
      <div>Difficulty: {initialDifficulty || "medium"}</div>
      <div>Mode: {mode || "practice"}</div>
      <button onClick={() => onDifficultyChange("hard")}>Set Hard</button>
      <button onClick={() => onComplete(85)}>Complete Practice</button>
    </div>
  ),
}));

// Mock ActivityService for activity detail route
const mockActivityService = {
  getActivityById: vi.fn().mockResolvedValue({
    id: "test-activity-1",
    name: "Test Activity",
    type: "pose",
    createdAt: new Date().toISOString(),
    duration: 30,
  }),
};

vi.mock("../services/ActivityService", () => ({
  ActivityService: vi.fn(() => mockActivityService),
}));

describe("Routing and Navigation", () => {
  let router: any;

  beforeEach(() => {
    router = createRouter({ routeTree });
    vi.clearAllMocks();
  });

  const renderWithRouter = (initialLocation = "/") => {
    router.navigate({ to: initialLocation });
    return render(<RouterProvider router={router} />);
  };

  describe("Basic Route Navigation", () => {
    it("should render home page by default", async () => {
      renderWithRouter("/");

      expect(screen.getByText(/Welcome to/)).toBeInTheDocument();
      expect(screen.getByText("GymParrot")).toBeInTheDocument();
    });

    it("should navigate to activities page", async () => {
      renderWithRouter("/activities");

      await waitFor(() => {
        expect(screen.getByTestId("activity-browser")).toBeInTheDocument();
      });
    });

    it("should navigate to create page", async () => {
      renderWithRouter("/create");

      await waitFor(() => {
        expect(screen.getByTestId("activity-creator")).toBeInTheDocument();
      });
    });

    it("should navigate to practice page with activity ID", async () => {
      renderWithRouter("/practice/test-activity-1");

      await waitFor(() => {
        expect(screen.getByTestId("practice-interface")).toBeInTheDocument();
        expect(
          screen.getByText("Activity ID: test-activity-1")
        ).toBeInTheDocument();
      });
    });

    it("should navigate to activity detail page", async () => {
      renderWithRouter("/activity/test-activity-1");

      await waitFor(() => {
        expect(screen.getByText("Test Activity")).toBeInTheDocument();
        expect(screen.getByText("Preview Activity")).toBeInTheDocument();
      });
    });
  });

  describe("Deep Linking with Search Parameters", () => {
    it("should handle activities page with type filter", async () => {
      renderWithRouter("/activities?type=pose");

      await waitFor(() => {
        expect(screen.getByText("Type: pose")).toBeInTheDocument();
      });
    });

    it("should handle activities page with difficulty filter", async () => {
      renderWithRouter("/activities?difficulty=hard");

      await waitFor(() => {
        expect(screen.getByText("Difficulty: hard")).toBeInTheDocument();
      });
    });

    it("should handle practice page with difficulty parameter", async () => {
      renderWithRouter("/practice/test-activity-1?difficulty=hard&mode=demo");

      await waitFor(() => {
        expect(screen.getByText("Difficulty: hard")).toBeInTheDocument();
        expect(screen.getByText("Mode: demo")).toBeInTheDocument();
      });
    });

    it("should handle create page with initial type", async () => {
      renderWithRouter("/create?type=movement");

      await waitFor(() => {
        expect(screen.getByText("Initial Type: movement")).toBeInTheDocument();
      });
    });
  });

  describe("Navigation Flow", () => {
    it("should navigate from activities to practice when activity selected", async () => {
      const user = userEvent.setup();
      renderWithRouter("/activities");

      await waitFor(() => {
        expect(screen.getByTestId("activity-browser")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Select Activity"));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(
          "/practice/test-activity-1"
        );
      });
    });

    it("should navigate from create to practice after activity creation", async () => {
      const user = userEvent.setup();
      renderWithRouter("/create");

      await waitFor(() => {
        expect(screen.getByTestId("activity-creator")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Create Activity"));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(
          "/practice/new-activity-id"
        );
        expect(router.state.location.search).toContain("mode=demo");
      });
    });

    it("should update URL when difficulty changes in practice", async () => {
      const user = userEvent.setup();
      renderWithRouter("/practice/test-activity-1");

      await waitFor(() => {
        expect(screen.getByTestId("practice-interface")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Set Hard"));

      await waitFor(() => {
        expect(router.state.location.search).toContain("difficulty=hard");
      });
    });

    it("should navigate back to activities with completion state", async () => {
      const user = userEvent.setup();
      renderWithRouter("/practice/test-activity-1");

      await waitFor(() => {
        expect(screen.getByTestId("practice-interface")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Complete Practice"));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/activities");
        expect(router.state.location.search).toContain(
          "completed=test-activity-1"
        );
        expect(router.state.location.search).toContain("score=85");
      });
    });
  });

  describe("Navigation Links in Header", () => {
    it("should have working navigation links in header", async () => {
      const user = userEvent.setup();
      renderWithRouter("/");

      // Test Activities link
      await user.click(screen.getByText("Browse Activities"));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/activities");
      });

      // Test Create link
      await user.click(screen.getByText("Create Activity"));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/create");
      });

      // Test Home link
      await user.click(screen.getByText("🦜 GymParrot"));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/");
      });
    });
  });

  describe("Quick Action Links", () => {
    it("should have working quick action links on home page", async () => {
      const user = userEvent.setup();
      renderWithRouter("/");

      // Test Browse Poses link
      await user.click(screen.getByText("Browse Poses →"));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/activities");
        expect(router.state.location.search).toContain("type=pose");
      });

      // Navigate back to home
      await user.click(screen.getByText("🦜 GymParrot"));

      // Test Browse Movements link
      await user.click(screen.getByText("Browse Movements →"));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/activities");
        expect(router.state.location.search).toContain("type=movement");
      });

      // Navigate back to home
      await user.click(screen.getByText("🦜 GymParrot"));

      // Test Create Pose link
      await user.click(screen.getByText("Create Pose →"));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/create");
        expect(router.state.location.search).toContain("type=pose");
      });

      // Navigate back to home
      await user.click(screen.getByText("🦜 GymParrot"));

      // Test Create Movement link
      await user.click(screen.getByText("Create Movement →"));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/create");
        expect(router.state.location.search).toContain("type=movement");
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid activity ID in practice route", async () => {
      renderWithRouter("/practice/invalid-id");

      await waitFor(() => {
        expect(screen.getByTestId("practice-interface")).toBeInTheDocument();
        expect(screen.getByText("Activity ID: invalid-id")).toBeInTheDocument();
      });
    });

    it("should handle activity detail page with failed load", async () => {
      mockActivityService.getActivityById.mockRejectedValueOnce(
        new Error("Activity not found")
      );

      renderWithRouter("/activity/invalid-id");

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load activity details")
        ).toBeInTheDocument();
        expect(screen.getByText("Back to Activities")).toBeInTheDocument();
      });
    });
  });

  describe("State Management", () => {
    it("should preserve filter state when navigating back to activities", async () => {
      const user = userEvent.setup();
      renderWithRouter("/activities?type=pose&difficulty=hard");

      await waitFor(() => {
        expect(screen.getByText("Type: pose")).toBeInTheDocument();
        expect(screen.getByText("Difficulty: hard")).toBeInTheDocument();
      });

      // Navigate to practice
      await user.click(screen.getByText("Select Activity"));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(
          "/practice/test-activity-1"
        );
      });

      // Navigate back
      await user.click(screen.getByText("Back to Activities"));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/activities");
        // Filters should be preserved in the component state
      });
    });

    it("should handle type changes in create page", async () => {
      const user = userEvent.setup();
      renderWithRouter("/create");

      await waitFor(() => {
        expect(screen.getByTestId("activity-creator")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Set Pose"));

      await waitFor(() => {
        expect(router.state.location.search).toContain("type=pose");
      });

      await user.click(screen.getByText("Set Movement"));

      await waitFor(() => {
        expect(router.state.location.search).toContain("type=movement");
      });
    });
  });
});
