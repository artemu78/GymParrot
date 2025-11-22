import React, { useState, useEffect, useCallback } from "react";
import { activityService } from "../services";
import type { Activity, ActivityType } from "../types";
import { ActivityCard } from "./activity-browser/ActivityCard";
import { EmptyState } from "./activity-browser/EmptyState";
import { LoadingState } from "./activity-browser/LoadingState";

interface ActivityBrowserProps {
  initialType?: ActivityType | "all";
  initialDifficulty?: string;
  onActivitySelect?: (activity: Activity) => void;
  onFilterChange?: (newType?: string, newDifficulty?: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

interface FilterState {
  type: ActivityType | "all";
  search: string;
}

const ActivityBrowser: React.FC<ActivityBrowserProps> = ({
  initialType = "all",
  onActivitySelect,
  onFilterChange,
  onError,
  className = "",
}) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    type: initialType || "all",
    search: "",
  });

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback(
    (errorMessage: string) => {
      setError(errorMessage);
      setLoading(false);
      onError?.(errorMessage);
    },
    [onError]
  );

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      clearError();

      const loadedActivities = await activityService.getActivities();
      setActivities(loadedActivities);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load activities";
      handleError(message);
    } finally {
      setLoading(false);
    }
  }, [clearError, handleError]);

  // Filter activities based on current filters
  const applyFilters = useCallback(() => {
    let filtered = activities;

    // Filter by type
    if (filters.type !== "all") {
      filtered = filtered.filter((activity) => activity.type === filters.type);
    }

    // Filter by search term
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase().trim();
      filtered = filtered.filter(
        (activity) =>
          activity.name.toLowerCase().includes(searchTerm) ||
          activity.createdBy.toLowerCase().includes(searchTerm)
      );
    }

    setFilteredActivities(filtered);
  }, [activities, filters]);

  // Load activities on mount
  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Apply filters when activities or filters change
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleActivitySelect = useCallback(
    (activity: Activity) => {
      onActivitySelect?.(activity);
    },
    [onActivitySelect]
  );

  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    setFilters((prev) => {
        const updated = { ...prev, ...newFilters };
        if (newFilters.type && onFilterChange) {
             onFilterChange(newFilters.type === "all" ? undefined : newFilters.type);
        }
        return updated;
    });
  }, [onFilterChange]);

  const hasActiveFilters =
    filters.type !== "all" || filters.search.trim().length > 0;

  return (
    <div className={`max-w-7xl mx-auto p-6 ${className}`}>
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Browse Activities
              </h2>
              <p className="text-gray-600 mt-1">
                Choose an activity to practice
              </p>
            </div>
            <div className="mt-4 sm:mt-0">
              <button
                onClick={loadActivities}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Filters */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <label htmlFor="search" className="sr-only">
                Search activities
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  id="search"
                  type="text"
                  placeholder="Search activities..."
                  value={filters.search}
                  onChange={(e) =>
                    handleFilterChange({ search: e.target.value })
                  }
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Type Filter */}
            <div className="sm:w-48">
              <label htmlFor="type-filter" className="sr-only">
                Filter by type
              </label>
              <select
                id="type-filter"
                value={filters.type}
                onChange={(e) =>
                  handleFilterChange({
                    type: e.target.value as FilterState["type"],
                  })
                }
                className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types</option>
                <option value="pose">Poses</option>
                <option value="movement">Movements</option>
              </select>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={() => setFilters({ type: "all", search: "" })}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    onClick={clearError}
                    className="text-red-400 hover:text-red-600"
                  >
                    <span className="sr-only">Dismiss</span>
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Results Count */}
          {!loading && !error && (
            <div className="mb-4 text-sm text-gray-600">
              {hasActiveFilters ? (
                <>
                  Showing {filteredActivities.length} of {activities.length}{" "}
                  activities
                </>
              ) : (
                <>{activities.length} activities available</>
              )}
            </div>
          )}

          {/* Activities Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {loading && <LoadingState />}

            {!loading && !error && filteredActivities.length === 0 && (
              <EmptyState hasFilters={hasActiveFilters} />
            )}

            {!loading &&
              !error &&
              filteredActivities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onSelect={handleActivitySelect}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityBrowser;
