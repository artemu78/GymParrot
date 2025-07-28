import { createFileRoute, useNavigate } from "@tanstack/react-router";
import PracticeInterface from "../components/PracticeInterface";
import { z } from "zod";

const practiceSearchSchema = z.object({
  difficulty: z.enum(["soft", "medium", "hard"]).optional(),
  mode: z.enum(["practice", "demo"]).optional().default("practice"),
});

export const Route = createFileRoute("/practice/$activityId")({
  component: Practice,
  validateSearch: practiceSearchSchema,
  beforeLoad: ({ params }) => {
    // Validate that activityId is provided
    if (!params.activityId) {
      throw new Error("Activity ID is required");
    }
  },
});

function Practice() {
  const { activityId } = Route.useParams();
  const { difficulty, mode } = Route.useSearch();
  const navigate = useNavigate();

  const handleComplete = (score: number) => {
    console.log("Practice completed with score:", score);
    // Navigate back to activities with success state
    navigate({
      to: "/activities",
      search: { completed: activityId, score: score.toString() },
    });
  };

  const handleError = (error: string) => {
    console.error("Practice error:", error);
    // Navigate back to activities with error state
    navigate({
      to: "/activities",
      search: { error: "practice-failed" },
    });
  };

  const handleBackToActivities = () => {
    navigate({ to: "/activities" });
  };

  const handleDifficultyChange = (
    newDifficulty: "soft" | "medium" | "hard"
  ) => {
    navigate({
      to: "/practice/$activityId",
      params: { activityId },
      search: { difficulty: newDifficulty, mode },
      replace: true,
    });
  };

  return (
    <div className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <button
          onClick={handleBackToActivities}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg
            className="mr-2 h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Activities
        </button>
      </div>

      <PracticeInterface
        activityId={activityId}
        initialDifficulty={difficulty}
        mode={mode}
        onComplete={handleComplete}
        onError={handleError}
        onDifficultyChange={handleDifficultyChange}
      />
    </div>
  );
}
