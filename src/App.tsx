import React, { useState } from "react";
import ActivityCreator from "./components/ActivityCreator";
import ActivityBrowser from "./components/ActivityBrowser";
import type { Activity } from "./types";

type AppView = "home" | "create" | "browse" | "practice";

function App() {
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null
  );

  const handleActivityCreated = (activityId: string) => {
    console.log("Activity created:", activityId);
    // In a real app, you might navigate to the activity or show a success message
    setCurrentView("browse");
  };

  const handleActivitySelect = (activity: Activity) => {
    setSelectedActivity(activity);
    setCurrentView("practice");
  };

  const handleError = (error: string) => {
    console.error("App error:", error);
    // In a real app, you might show a toast notification
  };

  const renderNavigation = () => (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <button
              onClick={() => setCurrentView("home")}
              className="text-2xl font-bold text-blue-600 hover:text-blue-700"
            >
              🦜 GymParrot
            </button>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setCurrentView("browse")}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                currentView === "browse"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Browse Activities
            </button>
            <button
              onClick={() => setCurrentView("create")}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                currentView === "create"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Create Activity
            </button>
          </div>
        </div>
      </div>
    </nav>
  );

  const renderHomeView = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
            Welcome to <span className="text-blue-600">GymParrot</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Connect trainers and trainees through AI-powered pose detection.
            Create activities, practice movements, and improve your form with
            real-time feedback.
          </p>
          <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
            <div className="rounded-md shadow">
              <button
                onClick={() => setCurrentView("browse")}
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10"
              >
                Browse Activities
              </button>
            </div>
            <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
              <button
                onClick={() => setCurrentView("create")}
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10"
              >
                Create Activity
              </button>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-16">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white mx-auto">
                <svg
                  className="h-6 w-6"
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
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900 text-center">
                Pose Detection
              </h3>
              <p className="mt-2 text-base text-gray-500 text-center">
                Advanced AI-powered pose detection using Google MediaPipe for
                accurate movement tracking.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white mx-auto">
                <svg
                  className="h-6 w-6"
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
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900 text-center">
                Real-time Feedback
              </h3>
              <p className="mt-2 text-base text-gray-500 text-center">
                Get instant feedback on your form and technique with
                configurable difficulty levels.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-purple-500 text-white mx-auto">
                <svg
                  className="h-6 w-6"
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
              <h3 className="mt-4 text-lg font-medium text-gray-900 text-center">
                Activity Library
              </h3>
              <p className="mt-2 text-base text-gray-500 text-center">
                Browse and practice from a growing library of poses and movement
                sequences.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPracticeView = () => (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Practice: {selectedActivity?.name}
            </h2>
            <button
              onClick={() => setCurrentView("browse")}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Back to Browse
            </button>
          </div>

          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-blue-600"
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
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Practice Interface Coming Soon
            </h3>
            <p className="text-gray-500 mb-4">
              The practice interface will be implemented in the next task. It
              will provide real-time pose comparison and feedback.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 max-w-md mx-auto">
              <p className="text-sm text-blue-800">
                <strong>Selected Activity:</strong> {selectedActivity?.name}
                <br />
                <strong>Type:</strong> {selectedActivity?.type}
                <br />
                <strong>Creator:</strong> {selectedActivity?.createdBy}
                {selectedActivity?.duration && (
                  <>
                    <br />
                    <strong>Duration:</strong>{" "}
                    {Math.round(selectedActivity.duration / 1000)}s
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {renderNavigation()}

      {currentView === "home" && renderHomeView()}

      {currentView === "create" && (
        <div className="py-8">
          <ActivityCreator
            onActivityCreated={handleActivityCreated}
            onError={handleError}
          />
        </div>
      )}

      {currentView === "browse" && (
        <div className="py-8">
          <ActivityBrowser
            onActivitySelect={handleActivitySelect}
            onError={handleError}
          />
        </div>
      )}

      {currentView === "practice" && renderPracticeView()}
    </div>
  );
}

export default App;
