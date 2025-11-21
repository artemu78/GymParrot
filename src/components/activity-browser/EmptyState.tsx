import React from "react";

interface EmptyStateProps {
  hasFilters: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ hasFilters }) => (
  <div className="col-span-full flex flex-col items-center justify-center py-12">
    <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
      <svg
        className="w-12 h-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      </svg>
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">
      {hasFilters
        ? "No activities match your filters"
        : "No activities available"}
    </h3>
    <p className="text-gray-500 text-center max-w-md">
      {hasFilters
        ? "Try adjusting your search or filter criteria to find activities."
        : "Activities created by trainers will appear here. Check back later or create your own!"}
    </p>
  </div>
);
