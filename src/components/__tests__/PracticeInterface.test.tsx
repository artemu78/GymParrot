import React from "react";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import PracticeInterface from "../PracticeInterface";
import {
  mediaPipeService,
  webcamService,
  comparisonService,
  activityService,
} from "../../services";
import type { Activity, ComparisonResult } from "../../types";

// Mock services
vi.mock("../../services", () => ({
  mediaPipeService: {
    initializePoseLandmarker: vi.fn(),
    startMovementTracking: vi.fn(),
  },
  webcamService: {
    startVideoStream: vi.fn(),
    stopVideoStream: vi.fn(),
  },
  comparisonService: {
    comparePoses: vi.fn(),
    compareMovementSequence: vi.fn(),
  },
  activityService: {
    getActivityById: vi.fn(),
  },
}));

// Mock WebcamPreview component
vi.mock("../WebcamPreview", () => ({
  default: React.forwardRef<HTMLVideoElement, any>((props, ref) => {
    React.useEffect(() => {
      if (ref && 'current' in ref && ref.current && props.onVideoReady) {
        // Call onVideoReady after a short delay to simulate video loading
        setTimeout(() => props.onVideoReady?.(ref.current!), 0);
      }
    }, [ref, props]);
    
    return (
      <div data-testid="webcam-preview">
        <video ref={ref} />
      </div>
    );
  }),
}));

const mockPoseActivity: Activity = {
  id: "pose-1",
  name: "Test Pose",
  type: "pose",
  createdBy: "trainer1",
  createdAt: new Date(),
  isPublic: true,
  landmarks: [
    { x: 0.5, y: 0.5, z: 0, visibility: 1 },
    { x: 0.6, y: 0.6, z: 0, visibility: 1 },
  ],
  poseData: [
    { x: 0.5, y: 0.5, z: 0, visibility: 1 },
    { x: 0.6, y: 0.6, z: 0, visibility: 1 },
  ],
};

const mockMovementActivity: Activity = {
  id: "movement-1",
  name: "Test Movement",
  type: "movement",
  createdBy: "trainer1",
  createdAt: new Date(),
  isPublic: true,
  duration: 10000,
  landmarks: [
    {
      timestamp: 0,
      landmarks: [
        { x: 0.5, y: 0.5, z: 0, visibility: 1 },
        { x: 0.6, y: 0.6, z: 0, visibility: 1 },
      ],
    },
  ],
  movementData: [
    {
      timestamp: 0,
      landmarks: [
        { x: 0.5, y: 0.5, z: 0, visibility: 1 },
        { x: 0.6, y: 0.6, z: 0, visibility: 1 },
      ],
    },
  ],
};

const mockComparisonResult: ComparisonResult = {
  score: 0.85,
  isMatch: true,
  feedback: ["Great pose alignment!"],
  suggestions: ["Keep it up!"],
};

describe("PracticeInterface", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set default video dimensions
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
      configurable: true,
      get() { return 640; }
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
      configurable: true,
      get() { return 480; }
    });

    // Default successful mocks
    vi.mocked(mediaPipeService.initializePoseLandmarker).mockResolvedValue(
      {} as any
    );
    vi.mocked(webcamService.startVideoStream).mockResolvedValue(undefined);
    vi.mocked(comparisonService.comparePoses).mockResolvedValue(
      mockComparisonResult
    );
    vi.mocked(comparisonService.compareMovementSequence).mockResolvedValue(
      mockComparisonResult
    );
  });

  describe("Loading and Error States", () => {
    it("should show loading state initially", () => {
      vi.mocked(activityService.getActivityById).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<PracticeInterface activityId="pose-1" />);

      expect(screen.getByText("Loading activity...")).toBeInTheDocument();
      expect(screen.getByRole("status", { hidden: true })).toBeInTheDocument(); // Loading spinner
    });

    it("should show error state when activity not found", async () => {
      vi.mocked(activityService.getActivityById).mockResolvedValue(null as any);

      render(<PracticeInterface activityId="nonexistent" />);

      await waitFor(() => {
        expect(screen.getByText("Activity not found")).toBeDefined();
      });
    });

    it("should show error state when activity loading fails", async () => {
      vi.mocked(activityService.getActivityById).mockRejectedValue(
        new Error("Network error")
      );

      render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });

    it("should call onError callback when loading fails", async () => {
      const onError = vi.fn();
      vi.mocked(activityService.getActivityById).mockRejectedValue(
        new Error("Network error")
      );

      render(<PracticeInterface activityId="pose-1" onError={onError} />);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith("Network error");
      });
    });
  });

  describe("Activity Loading", () => {
    it("should load and display pose activity", async () => {
      vi.mocked(activityService.getActivityById).mockResolvedValue(
        mockPoseActivity
      );

      render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        expect(screen.getByText("Practice: Test Pose")).toBeInTheDocument();
        expect(screen.getByText("Hold the target pose")).toBeInTheDocument();
      });
    });

    it("should load and display movement activity", async () => {
      vi.mocked(activityService.getActivityById).mockResolvedValue(
        mockMovementActivity
      );

      render(<PracticeInterface activityId="movement-1" />);

      await waitFor(() => {
        expect(screen.getByText("Practice: Test Movement")).toBeInTheDocument();
        expect(
          screen.getByText("Follow the movement sequence")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Difficulty Selection", () => {
    beforeEach(async () => {
      vi.mocked(activityService.getActivityById).mockResolvedValue(
        mockPoseActivity
      );
    });

    it("should render difficulty level buttons", async () => {
      render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        expect(screen.getByText("Easy")).toBeInTheDocument();
        expect(screen.getByText("Medium")).toBeInTheDocument();
        expect(screen.getByText("Hard")).toBeInTheDocument();
      });
    });

    it("should have medium difficulty selected by default", async () => {
      render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        const mediumButton = screen.getByText("Medium");
        expect(mediumButton).toHaveClass("text-yellow-600", "bg-yellow-100");
      });
    });

    it("should change difficulty when button is clicked", async () => {
      render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        const easyButton = screen.getByText("Easy");
        fireEvent.click(easyButton);
        expect(easyButton).toHaveClass("text-green-600", "bg-green-100");
      });
    });

    it("should disable difficulty buttons during practice", async () => {
      vi.mocked(mediaPipeService.startMovementTracking).mockImplementation(
        (video, onLandmarks, options) => {
          // Simulate ongoing tracking
          return Promise.resolve(() => {});
        }
      );

      render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        const startButton = screen.getByText("Start Practice");
        fireEvent.click(startButton);
      });

      await waitFor(() => {
        const easyButton = screen.getByText("Easy");
        expect(easyButton).toBeDisabled();
      });
    });
  });

  describe("Practice Controls", () => {
    beforeEach(async () => {
      vi.mocked(activityService.getActivityById).mockResolvedValue(
        mockPoseActivity
      );
    });

    it("should show start practice button when ready", async () => {
      render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        expect(screen.getByText("Start Practice")).toBeInTheDocument();
      });
    });

    it("should start practice when start button is clicked", async () => {
      const mockStopTracking = vi.fn();
      vi.mocked(mediaPipeService.startMovementTracking).mockResolvedValue(
        mockStopTracking
      );

      const { container } = render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        expect(screen.getByText("Start Practice")).toBeInTheDocument();
      });

      // Mock video element with valid dimensions
      const video = container.querySelector("video");
      if (video) {
        Object.defineProperty(video, "videoWidth", {
          value: 640,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(video, "videoHeight", {
          value: 480,
          writable: true,
          configurable: true,
        });
      }

      const startButton = screen.getByText("Start Practice");
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mediaPipeService.startMovementTracking).toHaveBeenCalled();
      });
    });

    it("should show stop and reset buttons during practice", async () => {
      vi.mocked(mediaPipeService.startMovementTracking).mockImplementation(
        (video, onLandmarks, options) => {
          return Promise.resolve(() => {});
        }
      );

      render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        const startButton = screen.getByText("Start Practice");
        fireEvent.click(startButton);
      });

      await waitFor(() => {
        expect(screen.getByText("Stop Practice")).toBeInTheDocument();
        expect(screen.getByText("Reset Session")).toBeInTheDocument();
      });
    });

    it("should stop practice when stop button is clicked", async () => {
      const mockStopTracking = vi.fn();
      vi.mocked(mediaPipeService.startMovementTracking).mockResolvedValue(
        mockStopTracking
      );

      const { container } = render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        expect(screen.getByText("Start Practice")).toBeInTheDocument();
      });

      // Mock video element with valid dimensions
      const video = container.querySelector("video");
      if (video) {
        Object.defineProperty(video, "videoWidth", {
          value: 640,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(video, "videoHeight", {
          value: 480,
          writable: true,
          configurable: true,
        });
      }

      const startButton = screen.getByText("Start Practice");
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText("Stop Practice")).toBeInTheDocument();
      });

      // Wait for tracking to actually start
      await waitFor(() => {
        expect(mediaPipeService.startMovementTracking).toHaveBeenCalled();
      });

      const stopButton = screen.getByText("Stop Practice");
      fireEvent.click(stopButton);

      await waitFor(() => {
        expect(mockStopTracking).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText("Start Practice")).toBeInTheDocument();
      });
    });
  });

  describe("Pose Comparison Feedback", () => {
    beforeEach(async () => {
      vi.mocked(activityService.getActivityById).mockResolvedValue(
        mockPoseActivity
      );
    });

    it("should show positive feedback for successful match", async () => {
      const successResult: ComparisonResult = {
        score: 0.9,
        isMatch: true,
        feedback: ["Perfect alignment!"],
        suggestions: ["Keep it up!"],
      };

      vi.mocked(comparisonService.comparePoses).mockResolvedValue(
        successResult
      );
      vi.mocked(mediaPipeService.startMovementTracking).mockImplementation(
        (video, onLandmarks, options) => {
          // Simulate pose detection
          setTimeout(() => {
            onLandmarks([{ x: 0.5, y: 0.5, z: 0, visibility: 1 }], Date.now());
          }, 100);
          return Promise.resolve(() => {});
        }
      );

      render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        const startButton = screen.getByText("Start Practice");
        fireEvent.click(startButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Great match!/)).toBeInTheDocument();
        expect(screen.getByText(/Score: 90%/)).toBeInTheDocument();
      });
    });

    it("should show improvement feedback for unsuccessful match", async () => {
      const failResult: ComparisonResult = {
        score: 0.6,
        isMatch: false,
        feedback: ["Adjust your left arm", "Lower your stance"],
        suggestions: ["Try moving your arm higher", "Bend your knees more"],
      };

      vi.mocked(comparisonService.comparePoses).mockResolvedValue(failResult);
      vi.mocked(mediaPipeService.startMovementTracking).mockImplementation(
        (video, onLandmarks, options) => {
          setTimeout(() => {
            onLandmarks([{ x: 0.5, y: 0.5, z: 0, visibility: 1 }], Date.now());
          }, 100);
          return Promise.resolve(() => {});
        }
      );

      render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        const startButton = screen.getByText("Start Practice");
        fireEvent.click(startButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Keep trying!/)).toBeInTheDocument();
        expect(screen.getByText(/Score: 60%/)).toBeInTheDocument();
        expect(screen.getByText("Adjust your left arm")).toBeInTheDocument();
        expect(screen.getByText("Lower your stance")).toBeInTheDocument();
      });
    });
  });

  describe("Session Statistics", () => {
    beforeEach(async () => {
      vi.mocked(activityService.getActivityById).mockResolvedValue(
        mockPoseActivity
      );
    });

    it("should display initial session statistics", async () => {
      render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        const successRates = screen.getAllByText("Success Rate:");
        expect(successRates.length).toBeGreaterThan(0);

        const bestScores = screen.getAllByText("Best Score:");
        expect(bestScores.length).toBeGreaterThan(0);

        const percentages = screen.getAllByText("0%");
        expect(percentages.length).toBeGreaterThan(0);
      });
    });

    it("should update statistics during practice", async () => {
      const successResult: ComparisonResult = {
        score: 0.8,
        isMatch: true,
        feedback: [],
        suggestions: [],
      };

      vi.mocked(comparisonService.comparePoses).mockResolvedValue(
        successResult
      );
      vi.mocked(mediaPipeService.startMovementTracking).mockImplementation(
        (video, onLandmarks, options) => {
          setTimeout(() => {
            onLandmarks([{ x: 0.5, y: 0.5, z: 0, visibility: 1 }], Date.now());
          }, 100);
          return Promise.resolve(() => {});
        }
      );

      render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        const startButton = screen.getByText("Start Practice");
        fireEvent.click(startButton);
      });

      await waitFor(() => {
        // Check that at least one Best Score: 80% element exists (could be in header or stats)
        // Since "Best Score: 80%" is not exact text because of the span structure
        // We look for the value "80%" near "Best Score:"
        const bestScoreLabels = screen.getAllByText("Best Score:");
        const bestScoreValue = screen.getAllByText("80%");
        expect(bestScoreValue.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Movement Activity Practice", () => {
    beforeEach(async () => {
      vi.mocked(activityService.getActivityById).mockResolvedValue(
        mockMovementActivity
      );
    });

    it("should handle movement sequence practice", async () => {
      vi.mocked(mediaPipeService.startMovementTracking).mockImplementation(
        (video, onLandmarks, options = {}) => {
          // Simulate movement completion
          setTimeout(() => {
            options.onComplete?.();
          }, 100);
          return Promise.resolve(() => {});
        }
      );

      render(<PracticeInterface activityId="movement-1" />);

      await waitFor(() => {
        const startButton = screen.getByText("Start Practice");
        fireEvent.click(startButton);
      });

      await waitFor(() => {
        expect(screen.getByText("Practice Complete!")).toBeInTheDocument();
      });
    });

    it("should call onComplete callback with final score", async () => {
      const onComplete = vi.fn();
      const finalResult: ComparisonResult = {
        score: 0.75,
        isMatch: true,
        feedback: [],
        suggestions: [],
      };

      vi.mocked(comparisonService.compareMovementSequence).mockResolvedValue(
        finalResult
      );
      vi.mocked(mediaPipeService.startMovementTracking).mockImplementation(
        (video, onLandmarks, options = {}) => {
          setTimeout(() => {
            options.onComplete?.();
          }, 100);
          return Promise.resolve(() => {});
        }
      );

      render(
        <PracticeInterface activityId="movement-1" onComplete={onComplete} />
      );

      await waitFor(() => {
        const startButton = screen.getByText("Start Practice");
        fireEvent.click(startButton);
      });

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith(0.75);
      });
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      vi.mocked(activityService.getActivityById).mockResolvedValue(
        mockPoseActivity
      );
    });

    it("should handle camera initialization errors", async () => {
      vi.mocked(mediaPipeService.initializePoseLandmarker).mockRejectedValue(
        new Error("Camera access denied")
      );

      render(<PracticeInterface activityId="pose-1" />);

      // Simulate video ready event
      await waitFor(() => {
        const webcamPreview = screen.getByTestId("webcam-preview");
        const video = webcamPreview.querySelector("video");
        if (video) {
          fireEvent.loadedData(video);
        }
      });

      await waitFor(() => {
        expect(screen.getByText("Camera access denied")).toBeInTheDocument();
      });
    });

    it("should handle practice start errors", async () => {
      vi.mocked(mediaPipeService.startMovementTracking).mockRejectedValue(
        new Error("Tracking failed")
      );

      render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        const startButton = screen.getByText("Start Practice");
        fireEvent.click(startButton);
      });

      await waitFor(() => {
        expect(screen.getByText("Tracking failed")).toBeInTheDocument();
      });
    });

    it("should prevent practice start when video dimensions are invalid", async () => {
      const { container } = render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        const startButton = screen.getByText("Start Practice");
        // Set invalid dimensions
        const video = container.querySelector("video");
        if (video) {
          Object.defineProperty(video, "videoWidth", {
            value: 0,
            writable: true,
          });
          Object.defineProperty(video, "videoHeight", {
            value: 0,
            writable: true,
          });
        }
        fireEvent.click(startButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Video stream not ready/)
        ).toBeInTheDocument();
      });

      // Verify tracking was not started
      expect(mediaPipeService.startMovementTracking).not.toHaveBeenCalled();
    });

    it("should prevent camera test when video dimensions are invalid", async () => {
      const { container } = render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        const testButton = screen.getByText("Test Camera");
        // Set invalid dimensions
        const video = container.querySelector("video");
        if (video) {
          Object.defineProperty(video, "videoWidth", {
            value: 0,
            writable: true,
          });
          Object.defineProperty(video, "videoHeight", {
            value: 0,
            writable: true,
          });
        }
        fireEvent.click(testButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Video stream not ready/)
        ).toBeInTheDocument();
      });

      // Verify tracking was not started
      expect(mediaPipeService.startMovementTracking).not.toHaveBeenCalled();
    });

    it("should allow practice start when video has valid dimensions", async () => {
      const mockStopTracking = vi.fn();
      vi.mocked(mediaPipeService.startMovementTracking).mockResolvedValue(
        mockStopTracking
      );

      const { container } = render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        // Mock video element with valid dimensions
        const video = container.querySelector("video");
        if (video) {
          Object.defineProperty(video, "videoWidth", {
            value: 640,
            writable: true,
          });
          Object.defineProperty(video, "videoHeight", {
            value: 480,
            writable: true,
          });
        }

        const startButton = screen.getByText("Start Practice");
        fireEvent.click(startButton);
      });

      await waitFor(() => {
        expect(mediaPipeService.startMovementTracking).toHaveBeenCalled();
      });
    });

    it("should allow error dismissal", async () => {
      vi.mocked(mediaPipeService.startMovementTracking).mockRejectedValue(
        new Error("Tracking failed")
      );

      render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        const startButton = screen.getByText("Start Practice");
        fireEvent.click(startButton);
      });

      await waitFor(() => {
        const dismissButton = screen.getByRole("button", { name: /dismiss/i });
        fireEvent.click(dismissButton);
      });

      expect(screen.queryByText("Tracking failed")).not.toBeInTheDocument();
    });
  });

  describe("Completion State", () => {
    beforeEach(async () => {
      vi.mocked(activityService.getActivityById).mockResolvedValue(
        mockPoseActivity
      );
    });

    it("should show completion summary", async () => {
      let completeCallback: (() => void) | null = null;
      
      vi.mocked(mediaPipeService.startMovementTracking).mockImplementation(
        (video, onLandmarks, options = {}) => {
          // Store the complete callback to call it manually
          completeCallback = options.onComplete || null;
          return Promise.resolve(() => {});
        }
      );

      const { container } = render(<PracticeInterface activityId="pose-1" />);

      // Wait for activity to load
      await waitFor(() => {
        expect(screen.getByText("Start Practice")).toBeInTheDocument();
      });

      // Mock video element with valid dimensions
      const video = container.querySelector("video");
      if (video) {
        Object.defineProperty(video, "videoWidth", {
          value: 640,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(video, "videoHeight", {
          value: 480,
          writable: true,
          configurable: true,
        });
      }

      // Start practice
      const startButton = screen.getByText("Start Practice");
      fireEvent.click(startButton);

      // Wait for tracking to start
      await waitFor(() => {
        expect(completeCallback).not.toBeNull();
      });

      // Manually trigger completion
      if (completeCallback) {
        // Wrap in act to avoid warnings as this updates state
        const callback = completeCallback;
        await React.act(async () => {
          callback();
        });
      }

      // Wait for completion and verify summary
      await waitFor(() => {
        expect(screen.getByText("Practice Complete!")).toBeInTheDocument();
      });

      expect(screen.getByText(/Final Score:/)).toBeInTheDocument();
      expect(screen.getByText(/Total Attempts:/)).toBeInTheDocument();
      // Use getAllByText for Success Rate as it appears in header too
      expect(screen.getAllByText(/Success Rate:/).length).toBeGreaterThan(0);
      expect(screen.getByText("Practice Again")).toBeInTheDocument();
    });

    it("should allow restarting practice", async () => {
      vi.mocked(mediaPipeService.startMovementTracking).mockImplementation(
        (video, onLandmarks, options = {}) => {
          setTimeout(() => {
            options.onComplete?.();
          }, 100);
          return Promise.resolve(() => {});
        }
      );

      const { container } = render(<PracticeInterface activityId="pose-1" />);

      // Wait for activity to load
      await waitFor(() => {
        expect(screen.getByText("Start Practice")).toBeInTheDocument();
      });

      // Mock video element with valid dimensions
      const video = container.querySelector("video");
      if (video) {
        Object.defineProperty(video, "videoWidth", {
          value: 640,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(video, "videoHeight", {
          value: 480,
          writable: true,
          configurable: true,
        });
      }

      // Start and complete first practice
      const startButton = screen.getByText("Start Practice");
      fireEvent.click(startButton);

      // Wait for practice to complete
      await waitFor(() => {
        expect(screen.getByText("Practice Complete!")).toBeInTheDocument();
      });

      // Click practice again
      const practiceAgainButton = screen.getByText("Practice Again");
      fireEvent.click(practiceAgainButton);

      // Should return to ready state
      await waitFor(() => {
        expect(screen.getByText("Start Practice")).toBeInTheDocument();
      });
    });
  });

  describe("Camera Test", () => {
    beforeEach(async () => {
      vi.mocked(activityService.getActivityById).mockResolvedValue(
        mockPoseActivity
      );
    });

    it("should show test camera button when ready", async () => {
      render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        expect(screen.getByText("Test Camera")).toBeInTheDocument();
      });
    });

    it("should start camera test when button is clicked", async () => {
      const mockStopTracking = vi.fn();
      vi.mocked(mediaPipeService.startMovementTracking).mockResolvedValue(
        mockStopTracking
      );

      const { container } = render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        // Mock video element with valid dimensions
        const video = container.querySelector("video");
        if (video) {
          Object.defineProperty(video, "videoWidth", {
            value: 640,
            writable: true,
          });
          Object.defineProperty(video, "videoHeight", {
            value: 480,
            writable: true,
          });
        }

        const testButton = screen.getByText("Test Camera");
        fireEvent.click(testButton);
      });

      await waitFor(() => {
        expect(mediaPipeService.initializePoseLandmarker).toHaveBeenCalled();
        expect(webcamService.startVideoStream).toHaveBeenCalled();
        expect(mediaPipeService.startMovementTracking).toHaveBeenCalled();
      });
    });

    it("should show camera test in progress message", async () => {
      vi.mocked(mediaPipeService.startMovementTracking).mockImplementation(
        (video, onLandmarks, options) => {
          return Promise.resolve(() => {});
        }
      );

      const { container } = render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        const video = container.querySelector("video");
        if (video) {
          Object.defineProperty(video, "videoWidth", {
            value: 640,
            writable: true,
          });
          Object.defineProperty(video, "videoHeight", {
            value: 480,
            writable: true,
          });
        }

        const testButton = screen.getByText("Test Camera");
        fireEvent.click(testButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Camera test in progress/)
        ).toBeInTheDocument();
        expect(screen.getByText("Stop Test")).toBeInTheDocument();
      });
    });

    it("should stop camera test when stop button is clicked", async () => {
      const mockStopTracking = vi.fn();
      vi.mocked(mediaPipeService.startMovementTracking).mockResolvedValue(
        mockStopTracking
      );

      const { container } = render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        const video = container.querySelector("video");
        if (video) {
          Object.defineProperty(video, "videoWidth", {
            value: 640,
            writable: true,
          });
          Object.defineProperty(video, "videoHeight", {
            value: 480,
            writable: true,
          });
        }

        const testButton = screen.getByText("Test Camera");
        fireEvent.click(testButton);
      });

      // Wait for tracking to actually start
      await waitFor(() => {
        expect(mediaPipeService.startMovementTracking).toHaveBeenCalled();
      });

      await waitFor(() => {
        const stopButton = screen.getByText("Stop Test");
        fireEvent.click(stopButton);
      });

      await waitFor(() => {
        expect(mockStopTracking).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText("Test Camera")).toBeInTheDocument();
      });
    });

    it("should disable difficulty buttons during camera test", async () => {
      vi.mocked(mediaPipeService.startMovementTracking).mockImplementation(
        (video, onLandmarks, options) => {
          return Promise.resolve(() => {});
        }
      );

      const { container } = render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        const video = container.querySelector("video");
        if (video) {
          Object.defineProperty(video, "videoWidth", {
            value: 640,
            writable: true,
          });
          Object.defineProperty(video, "videoHeight", {
            value: 480,
            writable: true,
          });
        }

        const testButton = screen.getByText("Test Camera");
        fireEvent.click(testButton);
      });

      await waitFor(() => {
        const easyButton = screen.getByText("Easy");
        expect(easyButton).toBeDisabled();
      });
    });

    it("should handle camera test errors", async () => {
      vi.mocked(mediaPipeService.initializePoseLandmarker).mockRejectedValue(
        new Error("Camera initialization failed")
      );

      const { container } = render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        const video = container.querySelector("video");
        if (video) {
          Object.defineProperty(video, "videoWidth", {
            value: 640,
            writable: true,
          });
          Object.defineProperty(video, "videoHeight", {
            value: 480,
            writable: true,
          });
        }

        const testButton = screen.getByText("Test Camera");
        fireEvent.click(testButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText("Camera initialization failed")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Instructions", () => {
    it("should show pose-specific instructions", async () => {
      vi.mocked(activityService.getActivityById).mockResolvedValue(
        mockPoseActivity
      );

      render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        expect(
          screen.getByText(/Position yourself to match the target pose/)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/Try to maintain the pose for consistent matches/)
        ).toBeInTheDocument();
      });
    });

    it("should show movement-specific instructions", async () => {
      vi.mocked(activityService.getActivityById).mockResolvedValue(
        mockMovementActivity
      );

      render(<PracticeInterface activityId="movement-1" />);

      await waitFor(() => {
        expect(
          screen.getByText(
            /Follow the movement sequence as closely as possible/
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText(/Complete the full sequence within the time limit/)
        ).toBeInTheDocument();
      });
    });
  });
});
