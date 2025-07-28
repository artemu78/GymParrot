import { createFileRoute, useNavigate } from "@tanstack/react-router";
import ActivityBrowser from "../components/ActivityBrowser";
import { z } from "zod";
import { useEffect, useState } from "react";

const activitiesSearchSchema = z.object({
  type: z.enum(["pose", "movement"]).optional(),
  difficulty: z.enum(["soft", "medium", "hard"]).optional(),
  completed: z.string().optional(),
  score: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/activities")({
  component: Activities,
  validateSearch: activitiesSearchSchema,
});

function Activities() {
  const navigate = useNavigate();
  const { type, difficulty, completed, score, error } = Route.useSearch();
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Handle route-based notifications
  useEffect(() => {
    if (completed && score) {
      setNotification({
        type: "success",
        message: `Activity completed with score: ${score}%`,
      });
      // Clear the search params after showing notification
      setTimeout(() => {
        navigate({
          to: "/activities",
          search: {},
          replace: true,
        });
      }, 3000);
    } else if (error === "practice-failed") {
      setNotification({
        type: "error",
        message: "Practice session failed. Please try again.",
      });
      // Clear the search params after showing notification
      setTimeout(() => {
        navigate({
          to: "/activities",
          search: {},
          replace: true,
        });
      }, 3000);
    }
  }, [completed, score, error, navigate]);

  const handleActivitySelect = (activity: any) => {
    navigate({
      to: "/practice/$activityId",
      params: { activityId: activity.id },
      search: { difficulty: difficulty || "medium" },
    });
  };

  const handleFilterChange = (newType?: string, newDifficulty?: string) => {
    navigate({
      to: "/activities",
      search: {
        type: newType as "pose" | "movement" | undefined,
        difficulty: newDifficulty as "soft" | "medium" | "hard" | undefined,
      },
      replace: true,
    });
  };

  const handleError = (error: string) => {
    console.error("Activities error:", error);
    setNotification({
      type: "error",
      message: "Failed to load activities. Please try again.",
    });
  };

  return (
    <div className="py-8">
      {notification && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div
            className={`rounded-md p-4 ${
              notification.type === "success"
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <div className="flex">
              <div className="flex-shrink-0">
                {notification.type === "success" ? (
                  <svg
                    className="h-5 w-5 text-green-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5 text-red-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p
                  className={`text-sm font-medium ${
                    notification.type === "success"
                      ? "text-green-800"
                      : "text-red-800"
                  }`}
                >
                  {notification.message}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <ActivityBrowser
        initialType={type}
        initialDifficulty={difficulty}
        onActivitySelect={handleActivitySelect}
        onFilterChange={handleFilterChange}
        onError={handleError}
      />
    </div>
  );
}
