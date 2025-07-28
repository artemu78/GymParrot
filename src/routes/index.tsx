import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
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
              <Link
                to="/activities"
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10"
              >
                Browse Activities
              </Link>
            </div>
            <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
              <Link
                to="/create"
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10"
              >
                Create Activity
              </Link>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-12 flex justify-center space-x-6">
            <Link
              to="/activities"
              search={{ type: "pose" }}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Browse Poses →
            </Link>
            <Link
              to="/activities"
              search={{ type: "movement" }}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Browse Movements →
            </Link>
            <Link
              to="/create"
              search={{ type: "pose" }}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Create Pose →
            </Link>
            <Link
              to="/create"
              search={{ type: "movement" }}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Create Movement →
            </Link>
          </div>
        </div>

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
}
