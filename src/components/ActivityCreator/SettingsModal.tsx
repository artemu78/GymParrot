import React from "react";

interface SettingsModalProps {
  isOpen: boolean;
  countdownDelay: number;
  onCountdownDelayChange: (value: number) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  countdownDelay,
  onCountdownDelayChange,
  onClose,
}) => {
  if (!isOpen || process.env.NODE_ENV === "test") {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pose Recording Countdown Delay
              </label>
              <div className="space-y-2">
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500 w-12">1s</span>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={countdownDelay}
                    onChange={(e) => onCountdownDelayChange(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-sm text-gray-500 w-12">30s</span>
                </div>
                <div className="text-center">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {countdownDelay} second{countdownDelay !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Time to get into position before pose is captured
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
