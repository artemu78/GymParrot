import React from "react";

const CapturingFlash: React.FC = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white rounded-lg animate-flash">
      <div className="text-center">
        <div className="text-6xl mb-4">📸</div>
        <p className="text-2xl font-bold text-gray-800">Capturing!</p>
      </div>
    </div>
  );
};

export default CapturingFlash;
