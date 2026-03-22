import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { Search } from "lucide-react";

export const Route = createRootRoute({
  component: () => (
    <>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link
                  to="/"
                  className="text-2xl font-bold text-blue-600 hover:text-blue-700"
                >
                  🦜 GymParrot
                </Link>
              </div>
              <div className="flex items-center space-x-4">
                <Link
                  to="/activities"
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-700 [&.active]:text-blue-600 [&.active]:bg-blue-50 inline-flex items-center gap-2"
                  activeProps={{
                    className: "text-blue-600 bg-blue-50",
                  }}
                >
                  <Search className="size-4 shrink-0" aria-hidden />
                  Browse Activities
                </Link>
                <Link
                  to="/create"
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-700 [&.active]:text-blue-600 [&.active]:bg-blue-50"
                  activeProps={{
                    className: "text-blue-600 bg-blue-50",
                  }}
                >
                  Create Activity
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <main>
          <Outlet />
        </main>
      </div>
      {import.meta.env.MODE !== "test" && <TanStackRouterDevtools />}
    </>
  ),
});
