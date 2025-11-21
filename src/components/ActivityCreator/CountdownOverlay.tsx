import React from "react";

interface CountdownOverlayProps {
  countdownValue: number;
}

const CountdownOverlay: React.FC<CountdownOverlayProps> = ({ countdownValue }) => {
  return (
    <div className="absolute top-0 left-0 right-0 flex flex-col items-center pt-8 pointer-events-none">
      <div className="text-center bg-black bg-opacity-70 px-8 py-6 rounded-lg shadow-2xl">
        {countdownValue > 0 ? (
          <>
            <div className="text-8xl font-bold text-white mb-2 animate-pulse">
              {countdownValue}
            </div>
            <p className="text-xl text-white font-semibold">Get ready to pose!</p>
          </>
        ) : (
          <>
            <div className="text-8xl font-bold text-green-400 mb-2 animate-bounce">
              POSE!
            </div>
            <p className="text-xl text-green-400 font-semibold">Hold your position!</p>
          </>
        )}
      </div>
      <div className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
        <p className="text-sm font-medium">📹 Camera active - Adjust your position</p>
      </div>
    </div>
  );
};

export default CountdownOverlay;
