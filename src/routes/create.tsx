import { createFileRoute, useNavigate } from "@tanstack/react-router";
import ActivityCreator from "../components/ActivityCreator";
import { z } from "zod";

const createSearchSchema = z.object({
  type: z.enum(["pose", "movement"]).optional(),
  success: z.string().optional(),
});

export const Route = createFileRoute("/create")({
  component: Create,
  validateSearch: createSearchSchema,
});

function Create() {
  const navigate = useNavigate();
  const { type, success } = Route.useSearch();

  const handleActivityCreated = (activityId: string) => {
    // Navigate to the practice page for the newly created activity
    navigate({
      to: "/practice/$activityId",
      params: { activityId },
      search: { mode: "demo" },
    });
  };

  const handleError = (error: string) => {
    console.error("Activity creation error:", error);
    // Stay on create page but could show error notification
  };

  const handleTypeChange = (newType: "pose" | "movement") => {
    navigate({
      to: "/create",
      search: { type: newType },
      replace: true,
    });
  };

  return (
    <div className="py-8">
      <ActivityCreator
        initialType={type}
        onActivityCreated={handleActivityCreated}
        onError={handleError}
        onTypeChange={handleTypeChange}
      />
    </div>
  );
}
