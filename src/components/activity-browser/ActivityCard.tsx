import { MoreVertical, Trash2 } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { Activity } from "../../types";

interface ActivityCardProps {
  /** The activity data to display */
  activity: Activity;
  /** Called when the user clicks "Practice Activity" */
  onSelect: (activity: Activity) => void;
  /** Called when the user confirms deletion from the three-dots menu */
  onDelete?: (activity: Activity, trigger: HTMLButtonElement) => void;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  onSelect,
  onDelete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

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

  const handleDeleteClick = () => {
    setMenuOpen(false);
    if (menuButtonRef.current) {
      onDelete?.(activity, menuButtonRef.current);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
      {/* Activity Preview */}
      <div className="aspect-video bg-gray-100 flex items-center justify-center relative">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-2 bg-blue-100 rounded-full flex items-center justify-center">
            {activity.type === "pose" ? (
              <svg
                aria-hidden="true"
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
                aria-hidden="true"
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
        {/* Title row with three-dots menu */}
        <div className="flex items-start justify-between mb-2 gap-2">
          <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">
            {activity.name}
          </h3>

          {/* Three-dots menu (only rendered when onDelete is provided) */}
          {onDelete && (
            <div className="relative flex-shrink-0" ref={menuRef}>
              <button
                type="button"
                ref={menuButtonRef}
                onClick={() => setMenuOpen((prev) => !prev)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="More options"
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-md shadow-lg z-10"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleDeleteClick}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
          <span>By {activity.createdBy}</span>
          <span>{formatDate(activity.createdAt)}</span>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => onSelect(activity)}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 font-medium"
        >
          Practice Activity
        </button>
      </div>
    </div>
  );
};
