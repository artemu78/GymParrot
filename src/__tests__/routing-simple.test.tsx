import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "../routeTree.gen";

// Mock the services to avoid complex dependencies
vi.mock("../services/ActivityService");
vi.mock("../services/MediaPipeService");
vi.mock("../services/WebcamService");
vi.mock("../services/ComparisonService");

describe("Routing Configuration", () => {
  let router: any;

  beforeEach(() => {
    router = createRouter({ routeTree });
    vi.clearAllMocks();
  });

  describe("Route Definitions", () => {
    it("should have all required routes defined", () => {
      const routes = router.routeTree.children;
      const routePaths = routes.map((route: any) => route.path);

      expect(routePaths).toContain("/");
      expect(routePaths).toContain("/activities");
      expect(routePaths).toContain("/create");
      expect(routePaths).toContain("/practice/$activityId");
      expect(routePaths).toContain("/activity/$activityId");
    });

    it("should handle parameterized routes", () => {
      const practiceRoute = router.routeTree.children.find(
        (route: any) => route.path === "/practice/$activityId"
      );
      const activityRoute = router.routeTree.children.find(
        (route: any) => route.path === "/activity/$activityId"
      );

      expect(practiceRoute).toBeDefined();
      expect(activityRoute).toBeDefined();
    });
  });

  describe("Route Navigation", () => {
    it("should navigate to home route", async () => {
      await router.navigate({ to: "/" });
      expect(router.state.location.pathname).toBe("/");
    });

    it("should navigate to activities route", async () => {
      await router.navigate({ to: "/activities" });
      expect(router.state.location.pathname).toBe("/activities");
    });

    it("should navigate to create route", async () => {
      await router.navigate({ to: "/create" });
      expect(router.state.location.pathname).toBe("/create");
    });

    it("should navigate to practice route with activity ID", async () => {
      await router.navigate({
        to: "/practice/$activityId",
        params: { activityId: "test-activity-1" },
      });
      expect(router.state.location.pathname).toBe("/practice/test-activity-1");
    });

    it("should navigate to activity detail route", async () => {
      await router.navigate({
        to: "/activity/$activityId",
        params: { activityId: "test-activity-1" },
      });
      expect(router.state.location.pathname).toBe("/activity/test-activity-1");
    });
  });

  describe("Search Parameters", () => {
    it("should handle search parameters in activities route", async () => {
      await router.navigate({
        to: "/activities",
        search: { type: "pose", difficulty: "hard" },
      });

      expect(router.state.location.pathname).toBe("/activities");
      expect(router.state.location.search).toContain("type=pose");
      expect(router.state.location.search).toContain("difficulty=hard");
    });

    it("should handle search parameters in practice route", async () => {
      await router.navigate({
        to: "/practice/$activityId",
        params: { activityId: "test-activity-1" },
        search: { difficulty: "medium", mode: "practice" },
      });

      expect(router.state.location.pathname).toBe("/practice/test-activity-1");
      expect(router.state.location.search).toContain("difficulty=medium");
      expect(router.state.location.search).toContain("mode=practice");
    });

    it("should handle search parameters in create route", async () => {
      await router.navigate({
        to: "/create",
        search: { type: "movement" },
      });

      expect(router.state.location.pathname).toBe("/create");
      expect(router.state.location.search).toContain("type=movement");
    });
  });

  describe("Deep Linking", () => {
    it("should support direct navigation to filtered activities", async () => {
      await router.navigate({
        to: "/activities",
        search: { type: "pose", difficulty: "soft" },
      });

      expect(router.state.location.pathname).toBe("/activities");
      expect(router.state.location.search).toContain("type=pose");
      expect(router.state.location.search).toContain("difficulty=soft");
    });

    it("should support direct navigation to practice with difficulty", async () => {
      await router.navigate({
        to: "/practice/$activityId",
        params: { activityId: "pose-activity-1" },
        search: { difficulty: "hard", mode: "demo" },
      });

      expect(router.state.location.pathname).toBe("/practice/pose-activity-1");
      expect(router.state.location.search).toContain("difficulty=hard");
      expect(router.state.location.search).toContain("mode=demo");
    });

    it("should support direct navigation to create with type", async () => {
      await router.navigate({
        to: "/create",
        search: { type: "pose" },
      });

      expect(router.state.location.pathname).toBe("/create");
      expect(router.state.location.search).toContain("type=pose");
    });
  });

  describe("Route State Management", () => {
    it("should maintain search parameters across navigation", async () => {
      // Navigate to activities with filters
      await router.navigate({
        to: "/activities",
        search: { type: "movement", difficulty: "medium" },
      });

      expect(router.state.location.search).toContain("type=movement");
      expect(router.state.location.search).toContain("difficulty=medium");

      // Navigate to practice
      await router.navigate({
        to: "/practice/$activityId",
        params: { activityId: "test-activity" },
        search: { difficulty: "medium" },
      });

      expect(router.state.location.pathname).toBe("/practice/test-activity");
      expect(router.state.location.search).toContain("difficulty=medium");
    });

    it("should handle URL updates for difficulty changes", async () => {
      await router.navigate({
        to: "/practice/$activityId",
        params: { activityId: "test-activity" },
        search: { difficulty: "soft", mode: "practice" },
      });

      // Simulate difficulty change
      await router.navigate({
        to: "/practice/$activityId",
        params: { activityId: "test-activity" },
        search: { difficulty: "hard", mode: "practice" },
        replace: true,
      });

      expect(router.state.location.search).toContain("difficulty=hard");
      expect(router.state.location.search).toContain("mode=practice");
    });

    it("should handle completion state navigation", async () => {
      await router.navigate({
        to: "/activities",
        search: { completed: "test-activity", score: "92" },
      });

      expect(router.state.location.pathname).toBe("/activities");
      expect(router.state.location.search).toContain("completed=test-activity");
      expect(router.state.location.search).toContain("score=92");
    });

    it("should handle error state navigation", async () => {
      await router.navigate({
        to: "/activities",
        search: { error: "practice-failed" },
      });

      expect(router.state.location.pathname).toBe("/activities");
      expect(router.state.location.search).toContain("error=practice-failed");
    });
  });

  describe("Route Validation", () => {
    it("should validate required parameters", async () => {
      // This should work with valid activity ID
      await router.navigate({
        to: "/practice/$activityId",
        params: { activityId: "valid-activity-id" },
      });

      expect(router.state.location.pathname).toBe(
        "/practice/valid-activity-id"
      );
    });

    it("should handle activity detail route parameters", async () => {
      await router.navigate({
        to: "/activity/$activityId",
        params: { activityId: "activity-detail-id" },
      });

      expect(router.state.location.pathname).toBe(
        "/activity/activity-detail-id"
      );
    });
  });

  describe("Navigation History", () => {
    it("should maintain navigation history", async () => {
      // Navigate through multiple routes
      await router.navigate({ to: "/" });
      await router.navigate({ to: "/activities" });
      await router.navigate({
        to: "/practice/$activityId",
        params: { activityId: "test-activity" },
      });

      expect(router.state.location.pathname).toBe("/practice/test-activity");

      // Navigate back
      await router.navigate({ to: "/activities" });
      expect(router.state.location.pathname).toBe("/activities");
    });

    it("should handle replace navigation", async () => {
      await router.navigate({ to: "/activities" });

      // Replace current route
      await router.navigate({
        to: "/activities",
        search: { type: "pose" },
        replace: true,
      });

      expect(router.state.location.pathname).toBe("/activities");
      expect(router.state.location.search).toContain("type=pose");
    });
  });

  describe("Route Matching", () => {
    it("should match exact routes", async () => {
      await router.navigate({ to: "/" });
      expect(router.state.matches[0].routeId).toBe("/");

      await router.navigate({ to: "/activities" });
      expect(
        router.state.matches.some(
          (match: any) => match.routeId === "/activities"
        )
      ).toBe(true);

      await router.navigate({ to: "/create" });
      expect(
        router.state.matches.some((match: any) => match.routeId === "/create")
      ).toBe(true);
    });

    it("should match parameterized routes", async () => {
      await router.navigate({
        to: "/practice/$activityId",
        params: { activityId: "test-activity" },
      });

      expect(
        router.state.matches.some(
          (match: any) => match.routeId === "/practice/$activityId"
        )
      ).toBe(true);
    });
  });
});
