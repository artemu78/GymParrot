import React from "react";
import { render, fireEvent, waitFor, screen, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
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
      // Simulate video ready event
      if (props.onVideoReady && ref && 'current' in ref && ref.current) {
         props.onVideoReady(ref.current);
      }
    }, [props.onVideoReady, ref]);
    
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
  imageData: "data:image/jpeg;base64,test",
  landmarks: [
    { x: 0.5, y: 0.5, z: 0, visibility: 1 },
    { x: 0.6, y: 0.6, z: 0, visibility: 1 },
  ],
  poseData: [
    { x: 0.5, y: 0.5, z: 0, visibility: 1 },
    { x: 0.6, y: 0.6, z: 0, visibility: 1 },
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
    vi.useRealTimers();

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
    vi.mocked(mediaPipeService.startMovementTracking).mockResolvedValue(
       () => {}
    );
    vi.mocked(webcamService.startVideoStream).mockResolvedValue(undefined);
    vi.mocked(comparisonService.comparePoses).mockResolvedValue(
      mockComparisonResult
    );
    vi.mocked(comparisonService.compareMovementSequence).mockResolvedValue(
      mockComparisonResult
    );

    // Mock Canvas API
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
        translate: vi.fn(),
        scale: vi.fn(),
        drawImage: vi.fn(),
    });
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,test");
  });

  afterEach(() => {
      vi.useRealTimers();
  });

  describe("Loading and Error States", () => {
    it("should show loading state initially", () => {
      vi.mocked(activityService.getActivityById).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<PracticeInterface activityId="pose-1" />);

      expect(screen.getByText("Loading activity...")).toBeInTheDocument();
    });

    it("should show error state when activity not found", async () => {
      vi.mocked(activityService.getActivityById).mockResolvedValue(null as any);

      render(<PracticeInterface activityId="nonexistent" />);

      await waitFor(() => {
        expect(screen.getByText("Activity not found")).toBeDefined();
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
        expect(screen.getByText("Test Pose")).toBeInTheDocument();
        expect(screen.getByText("Match the pose")).toBeInTheDocument();
      });
    });
  });

  describe("Difficulty Selector", () => {
    beforeEach(async () => {
      vi.mocked(activityService.getActivityById).mockResolvedValue(
        mockPoseActivity
      );
    });

    it("should handle difficulty changes", async () => {
      const onDifficultyChange = vi.fn();
      render(
        <PracticeInterface
          activityId="pose-1"
          initialDifficulty="medium"
          onDifficultyChange={onDifficultyChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Start Practice")).toBeInTheDocument();
      });

      const hardButton = screen.getByText("Hard");
      fireEvent.click(hardButton);

      expect(onDifficultyChange).toHaveBeenCalledWith("hard");

      expect(hardButton).toHaveClass("bg-white");
      expect(screen.getByText("Medium")).not.toHaveClass("bg-white");
    });
  });

  describe("Camera Test Interactions", () => {
    beforeEach(async () => {
      vi.mocked(activityService.getActivityById).mockResolvedValue(
        mockPoseActivity
      );
    });

    it("should start and stop camera test", async () => {
      const { container } = render(<PracticeInterface activityId="pose-1" />);

      await waitFor(() => {
        expect(screen.getByText("Test Camera")).toBeInTheDocument();
      });

      const videoElement = container.querySelector('video');
      if (videoElement) {
          Object.defineProperty(videoElement, "videoWidth", { value: 640, writable: true });
      }

      fireEvent.click(screen.getByText("Test Camera"));

      await waitFor(() => {
        expect(mediaPipeService.startMovementTracking).toHaveBeenCalled();
        expect(screen.getByText("Stop Camera Test")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Stop Camera Test"));

      expect(webcamService.stopVideoStream).toHaveBeenCalled();
      expect(screen.queryByText("Stop Camera Test")).not.toBeInTheDocument();
      expect(screen.getByText("Test Camera")).toBeInTheDocument();
    });

    it("should handle camera test errors", async () => {
       vi.useFakeTimers();
       vi.mocked(mediaPipeService.startMovementTracking).mockRejectedValueOnce(new Error("Tracking failed"));

       const { container } = render(<PracticeInterface activityId="pose-1" />);

       await act(async () => { await vi.runAllTimersAsync(); });
       expect(screen.getByText("Test Camera")).toBeInTheDocument();

       const videoElement = container.querySelector('video');
       if (videoElement) {
          Object.defineProperty(videoElement, "videoWidth", { value: 640, writable: true });
       }

       await act(async () => {
           fireEvent.click(screen.getByText("Test Camera"));
           await vi.advanceTimersByTimeAsync(500);
           await Promise.resolve();
       });

       expect(screen.getByText("Tracking failed")).toBeInTheDocument();
       expect(screen.queryByText("Stop Camera Test")).not.toBeInTheDocument();
    });
  });

  describe("Practice Flow (Pose)", () => {
      beforeEach(async () => {
          vi.mocked(activityService.getActivityById).mockResolvedValue(mockPoseActivity);
      });

      it("should capture and compare after countdown", async () => {
          vi.useFakeTimers();
          const onComplete = vi.fn();
          const { container } = render(<PracticeInterface activityId="pose-1" onComplete={onComplete} />);

          await act(async () => { await vi.runAllTimersAsync(); });
          expect(screen.getByText("Start Practice")).toBeInTheDocument();

          const videoElement = container.querySelector('video');
          if (videoElement) {
            Object.defineProperty(videoElement, "videoWidth", { value: 640, writable: true });
            Object.defineProperty(videoElement, "videoHeight", { value: 480, writable: true });
          }

          // Trigger Start Practice
          await act(async () => {
             fireEvent.click(screen.getByText("Start Practice"));
             await vi.advanceTimersByTimeAsync(300);
             await Promise.resolve();
          });

          expect(screen.getByText("3")).toBeInTheDocument();

          // Countdown 3..2..1..0
          // Advance step by step to ensure recursive effects run
          for (let i = 0; i < 5; i++) {
              await act(async () => {
                  await vi.advanceTimersByTimeAsync(1000);
                  await Promise.resolve();
              });
          }

          // Verify comparison call and overlay
          expect(comparisonService.comparePoses).toHaveBeenCalled();
          expect(screen.getByText("Excellent!")).toBeInTheDocument();

          // Target pose image should still be visible alongside the result
          expect(screen.getByText("Target Pose")).toBeInTheDocument();
          expect(screen.getByText("Your Pose")).toBeInTheDocument();
          expect(screen.getByAltText("Your Attempt")).toBeInTheDocument();

          fireEvent.click(screen.getByText("Approve and save"));
          expect(onComplete).toHaveBeenCalledWith(0.85);
      });

      it("should allow cancel during countdown", async () => {
          vi.useFakeTimers();
          const { container } = render(<PracticeInterface activityId="pose-1" />);
          await act(async () => { await vi.runAllTimersAsync(); });
          expect(screen.getByText("Start Practice")).toBeInTheDocument();

          const videoElement = container.querySelector('video');
          if (videoElement) {
            Object.defineProperty(videoElement, "videoWidth", { value: 640, writable: true });
          }

          await act(async () => {
             fireEvent.click(screen.getByText("Start Practice"));
             await vi.advanceTimersByTimeAsync(300);
             await Promise.resolve();
          });

          expect(screen.getByText("Cancel")).toBeInTheDocument();

          await act(async () => {
            fireEvent.click(screen.getByText("Cancel"));
            await Promise.resolve(); // Flush state updates
          });

          expect(webcamService.stopVideoStream).toHaveBeenCalled();
          expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
          expect(screen.getByText("Start Practice")).toBeInTheDocument();
      });

      it("should allow retry after completion", async () => {
         vi.useFakeTimers();
         const { container } = render(<PracticeInterface activityId="pose-1" />);
         await act(async () => { await vi.runAllTimersAsync(); });
         expect(screen.getByText("Start Practice")).toBeInTheDocument();

         const videoElement = container.querySelector('video');
         if (videoElement) {
            Object.defineProperty(videoElement, "videoWidth", { value: 640, writable: true });
            Object.defineProperty(videoElement, "videoHeight", { value: 480, writable: true });
          }

         await act(async () => {
             fireEvent.click(screen.getByText("Start Practice"));
             await vi.advanceTimersByTimeAsync(300);
             await Promise.resolve();
         });

         // Countdown
         for (let i = 0; i < 5; i++) {
              await act(async () => {
                  await vi.advanceTimersByTimeAsync(1000);
                  await Promise.resolve();
              });
         }

         expect(screen.getByText("Excellent!")).toBeInTheDocument();

         fireEvent.click(screen.getByText("Retry"));

         expect(screen.queryByText("Excellent!")).not.toBeInTheDocument();
         expect(screen.getByText("Start Practice")).toBeInTheDocument();
      });

      it("should keep practice screen visible with target pose and buttons after countdown", async () => {
         vi.useFakeTimers();
         const onComplete = vi.fn();
         const { container } = render(
            <PracticeInterface activityId="pose-1" onComplete={onComplete} />
         );
         await act(async () => { await vi.runAllTimersAsync(); });
         expect(screen.getByText("Start Practice")).toBeInTheDocument();

         const videoElement = container.querySelector('video');
         if (videoElement) {
            Object.defineProperty(videoElement, "videoWidth", { value: 640, writable: true });
            Object.defineProperty(videoElement, "videoHeight", { value: 480, writable: true });
         }

         await act(async () => {
            fireEvent.click(screen.getByText("Start Practice"));
            await vi.advanceTimersByTimeAsync(300);
            await Promise.resolve();
         });

         // Countdown to completion
         for (let i = 0; i < 5; i++) {
            await act(async () => {
               await vi.advanceTimersByTimeAsync(1000);
               await Promise.resolve();
            });
         }

         // After countdown, practice screen must remain (target + captured image)
         expect(screen.getByText("Target Pose")).toBeInTheDocument();
         expect(screen.getByText("Your Pose")).toBeInTheDocument();
         expect(screen.getByAltText("Target Pose")).toBeInTheDocument();
         expect(screen.getByAltText("Your Attempt")).toBeInTheDocument();

         // Both buttons must be present with the new labels
         expect(screen.getByText("Approve and save")).toBeInTheDocument();
         expect(screen.getByText("Retry")).toBeInTheDocument();

         // onComplete must NOT be called automatically
         expect(onComplete).not.toHaveBeenCalled();
      });

      it("should show camera preview (webcam) during the 3-2-1 countdown", async () => {
         vi.useFakeTimers();
         const { container } = render(<PracticeInterface activityId="pose-1" />);
         await act(async () => { await vi.runAllTimersAsync(); });
         expect(screen.getByText("Start Practice")).toBeInTheDocument();

         const videoElement = container.querySelector('video');
         if (videoElement) {
            Object.defineProperty(videoElement, "videoWidth", { value: 640, writable: true });
            Object.defineProperty(videoElement, "videoHeight", { value: 480, writable: true });
         }

         await act(async () => {
            fireEvent.click(screen.getByText("Start Practice"));
            await vi.advanceTimersByTimeAsync(300);
            await Promise.resolve();
         });

         // We are now in countdown; the webcam preview must still render
         expect(screen.getByText("3")).toBeInTheDocument();
         expect(screen.getByTestId("webcam-preview")).toBeInTheDocument();

         // Captured image must not be shown yet
         expect(screen.queryByAltText("Your Attempt")).not.toBeInTheDocument();

         // Movement tracking (landmark/gesture lines) must be active
         expect(mediaPipeService.startMovementTracking).toHaveBeenCalled();
      });

      it("should handle errors during practice start", async () => {
        vi.useFakeTimers();
        vi.mocked(webcamService.startVideoStream).mockRejectedValue(new Error("Camera failed"));

        const { container } = render(<PracticeInterface activityId="pose-1" />);
        await act(async () => { await vi.runAllTimersAsync(); });
        expect(screen.getByText("Start Practice")).toBeInTheDocument();

        const videoElement = container.querySelector('video');
         if (videoElement) {
            Object.defineProperty(videoElement, "videoWidth", { value: 640, writable: true });
         }

        await act(async () => {
            fireEvent.click(screen.getByText("Start Practice"));
            // Flush promises
            await vi.runAllTimersAsync();
            await Promise.resolve();
        });

        expect(screen.getByText("Camera failed")).toBeInTheDocument();
      });
  });

  describe("Movement Activity", () => {
      const movementSequence = [
        { timestamp: 0, landmarks: [{ x: 0.5, y: 0.5, z: 0, visibility: 1 }] },
        { timestamp: 500, landmarks: [{ x: 0.55, y: 0.5, z: 0, visibility: 1 }] },
        { timestamp: 1000, landmarks: [{ x: 0.6, y: 0.5, z: 0, visibility: 1 }] },
      ];

      const mockMovementActivity: Activity = {
          ...mockPoseActivity,
          id: "move-1",
          type: "movement",
          imageData: undefined,
          movementData: movementSequence,
          landmarks: movementSequence,
          duration: 5000
      };

      beforeEach(() => {
          vi.mocked(activityService.getActivityById).mockResolvedValue(mockMovementActivity);
      });

      it("should render movement playback instead of 'No image available'", async () => {
          render(<PracticeInterface activityId="move-1" />);

          await waitFor(() => {
              expect(screen.getByText("Target Movement")).toBeInTheDocument();
          });

          expect(screen.getByTestId("movement-playback")).toBeInTheDocument();
          expect(screen.queryByText("No image available")).not.toBeInTheDocument();
      });

      it("should handle movement practice flow", async () => {
          vi.useFakeTimers();
          let completeCallback: () => void = () => {};

          vi.mocked(mediaPipeService.startMovementTracking).mockImplementation(
              async (_video, _onFrame, options) => {
                  if (options?.onComplete) {
                      completeCallback = options.onComplete as any;
                  }
                  return () => {};
              }
          );

          const { container } = render(<PracticeInterface activityId="move-1" />);

          await act(async () => { await vi.runAllTimersAsync(); });
          expect(screen.getByText("Start Practice")).toBeInTheDocument();
          expect(screen.getByText("Follow the movement")).toBeInTheDocument();

           const videoElement = container.querySelector('video');
           if (videoElement) {
             Object.defineProperty(videoElement, "videoWidth", { value: 640, writable: true });
           }

          await act(async () => {
              fireEvent.click(screen.getByText("Start Practice"));
              // Advance for video ready check
              await vi.advanceTimersByTimeAsync(300);
              await Promise.resolve();
          });

          expect(mediaPipeService.startMovementTracking).toHaveBeenCalled();

          // Simulate completion
          await act(async () => {
              completeCallback();
          });

          expect(webcamService.stopVideoStream).toHaveBeenCalled();
      });
  });

  describe("Cleanup", () => {
    beforeEach(async () => {
          vi.mocked(activityService.getActivityById).mockResolvedValue(mockPoseActivity);
    });

    it("should clean up on unmount", async () => {
        const { unmount, container } = render(<PracticeInterface activityId="pose-1" />);
        await waitFor(() => expect(screen.getByText("Start Practice")).toBeInTheDocument());

        const videoElement = container.querySelector('video');
         if (videoElement) {
            Object.defineProperty(videoElement, "videoWidth", { value: 640, writable: true });
         }

        // Start something
        fireEvent.click(screen.getByText("Test Camera"));
        await waitFor(() => expect(screen.getByText("Stop Camera Test")).toBeInTheDocument());

        unmount();

        expect(webcamService.stopVideoStream).toHaveBeenCalled();
    });
  });
});
