import React from "react";

export const LoadingState: React.FC = () => (
  <div className="col-span-full flex items-center justify-center py-12">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-500">Loading activities...</p>
    </div>
  </div>
);
