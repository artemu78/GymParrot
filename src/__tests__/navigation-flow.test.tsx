import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "../routeTree.gen";

// Mock the services and components for integration testing
vi.mock("../services/ActivityService");
vi.mock("../services/MediaPipeService");
vi.mock("../services/WebcamService");
vi.mock("../services/ComparisonService");

// Mock components with more realistic behavior
vi.mock("../components/ActivityBrowser", () => ({
  default: ({
    onActivitySelect,
    onFilterChange,
    initialType,
    initialDifficulty,
  }: any) => (
    <div data-testid="activity-browser">
      <div>
        Current filters: {initialType || "all"} / {initialDifficulty || "all"}
      </div>
      <button onClick={() => onFilterChange("pose", "hard")}>
        Filter Pose Hard
      </button>
      <button onClick={() => onFilterChange(undefined, undefined)}>
        Clear Filters
      </button>
      <div data-testid="activity-list">
        <button
          onClick={() =>
            onActivitySelect({
              id: "pose-activity-1",
              name: "Basic Pose",
              type: "pose",
            })
          }
        >
          Basic Pose (Pose)
        </button>
        <button
          onClick={() =>
            onActivitySelect({
              id: "movement-activity-1",
              name: "Dance Sequence",
              type: "movement",
            })
          }
        >
          Dance Sequence (Movement)
        </button>
      </div>
    </div>
  ),
}));

vi.mock("../components/ActivityCreator", () => ({
  default: ({ onActivityCreated, onTypeChange, initialType }: any) => (
    <div data-testid="activity-creator">
      <div>Creating: {initialType || "select type"}</div>
      <button onClick={() => onTypeChange("pose")}>Create Pose</button>
      <button onClick={() => onTypeChange("movement")}>Create Movement</button>
      <button
        onClick={() => onActivityCreated("newly-created-activity")}
        disabled={!initialType}
      >
        Record Activity
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
    onError,
    onDifficultyChange,
  }: any) => (
    <div data-testid="practice-interface">
      <div>Practicing: {activityId}</div>
      <div>Difficulty: {initialDifficulty || "medium"}</div>
      <div>Mode: {mode || "practice"}</div>
      <button onClick={() => onDifficultyChange("soft")}>Easy</button>
      <button onClick={() => onDifficultyChange("medium")}>Medium</button>
      <button onClick={() => onDifficultyChange("hard")}>Hard</button>
      <button onClick={() => onComplete(92)}>Complete Successfully</button>
      <button onClick={() => onError("Camera failed")}>Simulate Error</button>
    </div>
  ),
}));

const mockActivityService = {
  getActivityById: vi.fn().mockImplementation((id: string) => {
    const activities: Record<string, any> = {
      "pose-activity-1": {
        id: "pose-activity-1",
        name: "Basic Pose",
        type: "pose",
        createdAt: new Date().toISOString(),
      },
      "movement-activity-1": {
        id: "movement-activity-1",
        name: "Dance Sequence",
        type: "movement",
        duration: 30,
        createdAt: new Date().toISOString(),
      },
      "newly-created-activity": {
        id: "newly-created-activity",
        name: "New Activity",
        type: "pose",
        createdAt: new Date().toISOString(),
      },
    };
    return Promise.resolve(activities[id] || null);
  }),
};

vi.mock("../services/ActivityService", () => ({
  ActivityService: vi.fn(() => mockActivityService),
}));

describe("Complete Navigation Flow", () => {
  let router: any;

  beforeEach(() => {
    router = createRouter({ routeTree });
    vi.clearAllMocks();
  });

  const renderWithRouter = (initialLocation = "/") => {
    router.navigate({ to: initialLocation });
    return render(<RouterProvider router={router} />);
  };

  describe("Trainer Workflow", () => {
    it("should complete full trainer workflow: home → create → practice demo", async () => {
      const user = userEvent.setup();

      // Start at home page
      renderWithRouter("/");
      expect(screen.getByText(/Welcome to/)).toBeInTheDocument();

      // Navigate to create page
      await user.click(screen.getByText("Create Activity"));
      await waitFor(() => {
        expect(screen.getByTestId("activity-creator")).toBeInTheDocument();
        expect(router.state.location.pathname).toBe("/create");
      });

      // Select activity type
      await user.click(screen.getByText("Create Pose"));
      await waitFor(() => {
        expect(screen.getByText("Creating: pose")).toBeInTheDocument();
        expect(router.state.location.search).toContain("type=pose");
      });

      // Record activity
      await user.click(screen.getByText("Record Activity"));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(
          "/practice/newly-created-activity"
        );
        expect(router.state.location.search).toContain("mode=demo");
      });

      // Verify demo mode
      expect(
        screen.getByText("Practicing: newly-created-activity")
      ).toBeInTheDocument();
      expect(screen.getByText("Mode: demo")).toBeInTheDocument();
    });

    it("should handle trainer workflow with movement creation", async () => {
      const user = userEvent.setup();

      // Start with movement type pre-selected
      renderWithRouter("/create?type=movement");

      await waitFor(() => {
        expect(screen.getByText("Creating: movement")).toBeInTheDocument();
      });

      // Record movement activity
      await user.click(screen.getByText("Record Activity"));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(
          "/practice/newly-created-activity"
        );
        expect(router.state.location.search).toContain("mode=demo");
      });
    });
  });

  describe("Trainee Workflow", () => {
    it("should complete full trainee workflow: home → browse → activity detail → practice", async () => {
      const user = userEvent.setup();

      // Start at home page
      renderWithRouter("/");

      // Navigate to activities
      await user.click(screen.getByText("Browse Activities"));
      await waitFor(() => {
        expect(screen.getByTestId("activity-browser")).toBeInTheDocument();
        expect(router.state.location.pathname).toBe("/activities");
      });

      // Select an activity
      await user.click(screen.getByText("Basic Pose (Pose)"));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(
          "/practice/pose-activity-1"
        );
        expect(router.state.location.search).toContain("difficulty=medium");
      });

      // Verify practice interface
      expect(
        screen.getByText("Practicing: pose-activity-1")
      ).toBeInTheDocument();
      expect(screen.getByText("Mode: practice")).toBeInTheDocument();
    });

    it("should handle trainee workflow with filtering", async () => {
      const user = userEvent.setup();

      // Start with filtered activities
      renderWithRouter("/activities?type=pose");

      await waitFor(() => {
        expect(
          screen.getByText("Current filters: pose / all")
        ).toBeInTheDocument();
      });

      // Apply additional filter
      await user.click(screen.getByText("Filter Pose Hard"));
      await waitFor(() => {
        expect(router.state.location.search).toContain("type=pose");
        expect(router.state.location.search).toContain("difficulty=hard");
      });

      // Select activity with filters applied
      await user.click(screen.getByText("Basic Pose (Pose)"));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(
          "/practice/pose-activity-1"
        );
        expect(router.state.location.search).toContain("difficulty=hard");
      });
    });

    it("should handle difficulty changes during practice", async () => {
      const user = userEvent.setup();

      renderWithRouter("/practice/pose-activity-1?difficulty=medium");

      await waitFor(() => {
        expect(screen.getByText("Difficulty: medium")).toBeInTheDocument();
      });

      // Change to hard difficulty
      await user.click(screen.getByText("Hard"));
      await waitFor(() => {
        expect(router.state.location.search).toContain("difficulty=hard");
      });

      // Change to easy difficulty
      await user.click(screen.getByText("Easy"));
      await waitFor(() => {
        expect(router.state.location.search).toContain("difficulty=soft");
      });
    });
  });

  describe("Activity Detail Workflow", () => {
    it("should navigate through activity detail page", async () => {
      const user = userEvent.setup();

      renderWithRouter("/activity/pose-activity-1");

      await waitFor(() => {
        expect(screen.getByText("Basic Pose")).toBeInTheDocument();
        expect(screen.getByText("Preview Activity")).toBeInTheDocument();
      });

      // Test preview functionality
      await user.click(screen.getByText("Preview Activity"));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(
          "/practice/pose-activity-1"
        );
        expect(router.state.location.search).toContain("mode=demo");
      });
    });

    it("should handle different difficulty selections from activity detail", async () => {
      const user = userEvent.setup();

      renderWithRouter("/activity/movement-activity-1");

      await waitFor(() => {
        expect(screen.getByText("Dance Sequence")).toBeInTheDocument();
      });

      // Test hard difficulty selection
      await user.click(screen.getByText("Practice (Hard)"));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(
          "/practice/movement-activity-1"
        );
        expect(router.state.location.search).toContain("difficulty=hard");
        expect(router.state.location.search).toContain("mode=practice");
      });
    });
  });

  describe("Success and Error Flow", () => {
    it("should handle successful practice completion", async () => {
      const user = userEvent.setup();

      renderWithRouter("/practice/pose-activity-1");

      await waitFor(() => {
        expect(screen.getByTestId("practice-interface")).toBeInTheDocument();
      });

      // Complete practice successfully
      await user.click(screen.getByText("Complete Successfully"));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/activities");
        expect(router.state.location.search).toContain(
          "completed=pose-activity-1"
        );
        expect(router.state.location.search).toContain("score=92");
      });

      // Should show success notification
      await waitFor(() => {
        expect(
          screen.getByText(/Activity completed with score: 92%/)
        ).toBeInTheDocument();
      });
    });

    it("should handle practice errors", async () => {
      const user = userEvent.setup();

      renderWithRouter("/practice/pose-activity-1");

      await waitFor(() => {
        expect(screen.getByTestId("practice-interface")).toBeInTheDocument();
      });

      // Simulate error
      await user.click(screen.getByText("Simulate Error"));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/activities");
        expect(router.state.location.search).toContain("error=practice-failed");
      });

      // Should show error notification
      await waitFor(() => {
        expect(screen.getByText(/Practice session failed/)).toBeInTheDocument();
      });
    });
  });

  describe("Quick Navigation Links", () => {
    it("should handle quick navigation from home page", async () => {
      const user = userEvent.setup();

      renderWithRouter("/");

      // Test pose browsing quick link
      await user.click(screen.getByText("Browse Poses →"));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/activities");
        expect(router.state.location.search).toContain("type=pose");
      });

      // Navigate back to home
      await user.click(screen.getByText("🦜 GymParrot"));

      // Test movement creation quick link
      await user.click(screen.getByText("Create Movement →"));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/create");
        expect(router.state.location.search).toContain("type=movement");
      });
    });
  });

  describe("Breadcrumb Navigation", () => {
    it("should handle breadcrumb navigation in activity detail", async () => {
      const user = userEvent.setup();

      renderWithRouter("/activity/pose-activity-1");

      await waitFor(() => {
        expect(screen.getByText("Activities")).toBeInTheDocument();
        expect(screen.getByText("Basic Pose")).toBeInTheDocument();
      });

      // Click breadcrumb to go back to activities
      await user.click(screen.getByText("Activities"));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/activities");
      });
    });

    it("should handle back button in practice interface", async () => {
      const user = userEvent.setup();

      renderWithRouter("/practice/pose-activity-1");

      await waitFor(() => {
        expect(screen.getByText("Back to Activities")).toBeInTheDocument();
      });

      // Click back button
      await user.click(screen.getByText("Back to Activities"));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/activities");
      });
    });
  });

  describe("State Persistence", () => {
    it("should maintain filter state across navigation", async () => {
      const user = userEvent.setup();

      // Start with filters
      renderWithRouter("/activities?type=movement&difficulty=hard");

      await waitFor(() => {
        expect(
          screen.getByText("Current filters: movement / hard")
        ).toBeInTheDocument();
      });

      // Navigate to practice
      await user.click(screen.getByText("Dance Sequence (Movement)"));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(
          "/practice/movement-activity-1"
        );
        expect(router.state.location.search).toContain("difficulty=hard");
      });

      // Navigate back
      await user.click(screen.getByText("Back to Activities"));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/activities");
        // Component should remember the filters
      });
    });
  });
});
