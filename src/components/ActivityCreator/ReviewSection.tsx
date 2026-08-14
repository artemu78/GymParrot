import React from "react";

interface ReviewSectionProps {
  onApprove: () => void;
  onRetake: () => void;
  activityType?: "pose" | "movement";
}

const ReviewSection: React.FC<ReviewSectionProps> = ({
  onApprove,
  onRetake,
  activityType = "pose",
}) => {
  const isMovement = activityType === "movement";
  const heading = isMovement ? "Review Your Movement" : "Review Your Pose";
  const description = isMovement
    ? "Watch the recorded video. Approve it to save the activity or retake if needed."
    : "Check if your pose looks good. You can approve it to create the activity or retake if needed.";

  return (
    <div className="flex flex-col items-center space-y-4 w-full max-w-md">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 w-full">
        <div className="flex items-center mb-2">
          <svg
            className="h-5 w-5 text-blue-600 mr-2"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium text-blue-800">{heading}</span>
        </div>
        <p className="text-sm text-blue-700">{description}</p>
      </div>
      <div className="flex space-x-3 w-full">
        <button
          onClick={onApprove}
          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 font-medium"
        >
          ✓ Approve & Create
        </button>
        <button
          onClick={onRetake}
          className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 font-medium"
        >
          ↻ Retake
        </button>
      </div>
    </div>
  );
};

export default ReviewSection;
