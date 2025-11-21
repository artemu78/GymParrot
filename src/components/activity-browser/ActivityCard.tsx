import React from "react";
import type { Activity } from "../../types";

interface ActivityCardProps {
  activity: Activity;
  onSelect: (activity: Activity) => void;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  onSelect,
}) => {
  const formatDuration = (duration?: number) => {
    if (!duration) return "Single pose";
    return `${Math.round(duration / 1000)}s`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
      {/* Activity Preview */}
      <div className="aspect-video bg-gray-100 flex items-center justify-center relative">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-2 bg-blue-100 rounded-full flex items-center justify-center">
            {activity.type === "pose" ? (
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            ) : (
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            )}
          </div>
          <p className="text-sm text-gray-500 capitalize">{activity.type}</p>
        </div>

        {/* Type Badge */}
        <div className="absolute top-2 left-2">
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              activity.type === "pose"
                ? "bg-green-100 text-green-800"
                : "bg-blue-100 text-blue-800"
            }`}
          >
            {activity.type === "pose" ? "Pose" : "Movement"}
          </span>
        </div>

        {/* Duration Badge */}
        <div className="absolute top-2 right-2">
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
            {formatDuration(activity.duration)}
          </span>
        </div>
      </div>

      {/* Activity Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
          {activity.name}
        </h3>

        <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
          <span>By {activity.createdBy}</span>
          <span>{formatDate(activity.createdAt)}</span>
        </div>

        {/* Action Button */}
        <button
          onClick={() => onSelect(activity)}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 font-medium"
        >
          Practice Activity
        </button>
      </div>
    </div>
  );
};
