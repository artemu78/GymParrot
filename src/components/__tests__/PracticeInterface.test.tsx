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
    getPerformanceMetrics: vi.fn(() => ({
      monitor: {
        fps: 0,
        latestFrameTime: 0,
        averageFrameTime: 0,
        p95FrameTime: 0,
        memoryUsage: 0,
        droppedFrames: 0,
        totalFrames: 0,
        timestamp: 0,
      },
      memory: {
        historySize: 0,
        estimatedMemory: 0,
      },
      frameRate: 0,
    })),
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
  WEBCAM_PREVIEW_MIRRORED: true,
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
    vi.mocked(comparisonService.comparePoses).mockReturnValue(
      mockComparisonResult
    );
    vi.mocked(comparisonService.compareMovementSequence).mockReturnValue(
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

    it("should horizontally mirror the target pose image to match the selfie-view preview the trainer saw when recording", async () => {
      vi.mocked(activityService.getActivityById).mockResolvedValue(
        mockPoseActivity
      );

      render(<PracticeInterface activityId="pose-1" />);

      const targetImage = await screen.findByAltText("Target Pose");
      expect(targetImage.style.transform).toContain("scaleX(-1)");

      const landmarkOverlay = targetImage.parentElement
        ?.querySelector("svg")
        ?.parentElement;
      expect(landmarkOverlay?.style.transform).toContain("scaleX(-1)");
    });

    it("should align target landmarks to the target image aspect ratio", async () => {
      vi.mocked(activityService.getActivityById).mockResolvedValue(
        mockPoseActivity
      );

      render(<PracticeInterface activityId="pose-1" />);

      const targetImage = await screen.findByAltText("Target Pose");
      Object.defineProperty(targetImage, "naturalWidth", {
        value: 1280,
        configurable: true,
      });
      Object.defineProperty(targetImage, "naturalHeight", {
        value: 720,
        configurable: true,
      });
      fireEvent.load(targetImage);

      const overlay = targetImage.parentElement?.querySelector("svg");
      const firstLandmark = overlay?.querySelector("circle");
      expect(overlay?.getAttribute("viewBox")).toBe("0 0 1280 720");
      expect(firstLandmark?.getAttribute("cx")).toBe("640");
      expect(firstLandmark?.getAttribute("cy")).toBe("360");
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
      const mockLivePoseTracking = () => {
          const evaluation = {
              onFrame: null as Parameters<typeof mediaPipeService.startMovementTracking>[1] | null,
              onComplete: null as (() => void) | null,
          };

          vi.mocked(mediaPipeService.startMovementTracking).mockImplementation(
              async (_video, onFrame, options) => {
                  if (options?.duration === 5000) {
                      evaluation.onFrame = onFrame;
                      evaluation.onComplete = options.onComplete ?? null;
                  }
                  return () => {};
              }
          );

          return evaluation;
      };

      const advanceThroughCountdown = async () => {
          for (let i = 0; i < 4; i++) {
              await act(async () => {
                  await vi.advanceTimersByTimeAsync(1000);
                  await Promise.resolve();
              });
          }
      };

      beforeEach(async () => {
          vi.mocked(activityService.getActivityById).mockResolvedValue(mockPoseActivity);
      });

      it("should keep the highest live score and its matching photo", async () => {
          vi.useFakeTimers();
          const evaluation = mockLivePoseTracking();
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

          await advanceThroughCountdown();
          expect(screen.getByText(/Live score/)).toBeInTheDocument();
          expect(mediaPipeService.startMovementTracking).toHaveBeenLastCalledWith(
            expect.anything(),
            expect.any(Function),
            expect.objectContaining({ duration: 5000 })
          );

          const results = [
            { ...mockComparisonResult, score: 0.4, isMatch: false },
            { ...mockComparisonResult, score: 0.8, isMatch: true },
            { ...mockComparisonResult, score: 0.6, isMatch: false },
            { ...mockComparisonResult, score: 0.9, isMatch: true },
          ];
          vi.mocked(comparisonService.comparePoses)
            .mockReturnValueOnce(results[0])
            .mockReturnValueOnce(results[1])
            .mockReturnValueOnce(results[2])
            .mockReturnValueOnce(results[3]);
          vi.mocked(HTMLCanvasElement.prototype.toDataURL)
            .mockReturnValueOnce("data:image/jpeg;base64,score-40")
            .mockReturnValueOnce("data:image/jpeg;base64,score-80")
            .mockReturnValueOnce("data:image/jpeg;base64,score-90");

          await act(async () => {
            for (let index = 0; index < results.length; index++) {
              evaluation.onFrame?.(
                [{ x: index / 10, y: 0.5, z: 0, visibility: 1 }],
                index * 100
              );
            }
          });

          expect(screen.getByText("Best: 90%")).toBeInTheDocument();
          expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledTimes(3);

          await act(async () => {
            evaluation.onComplete?.();
          });

          expect(screen.getByText("Excellent!")).toBeInTheDocument();
          expect(screen.getAllByText("90%")).toHaveLength(2);

          // Target pose image should still be visible alongside the result
          expect(screen.getByText("Target Pose")).toBeInTheDocument();
          expect(screen.getByText("Your Pose")).toBeInTheDocument();
          expect(screen.getByAltText("Your Attempt")).toHaveAttribute(
            "src",
            "data:image/jpeg;base64,score-90"
          );

          fireEvent.click(screen.getByText("Approve and save"));
          expect(onComplete).toHaveBeenCalledWith(0.9);
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
         const evaluation = mockLivePoseTracking();
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

         await advanceThroughCountdown();
         await act(async () => {
            evaluation.onFrame?.(mockPoseActivity.poseData ?? [], 0);
            evaluation.onComplete?.();
         });

         expect(screen.getByText("Excellent!")).toBeInTheDocument();

         fireEvent.click(screen.getByText("Retry"));

         expect(screen.queryByText("Excellent!")).not.toBeInTheDocument();
         expect(screen.getByText("Start Practice")).toBeInTheDocument();
      });

      it("should keep practice screen visible with target pose and buttons after countdown", async () => {
         vi.useFakeTimers();
         const evaluation = mockLivePoseTracking();
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

         await advanceThroughCountdown();
         await act(async () => {
            evaluation.onFrame?.(mockPoseActivity.poseData ?? [], 0);
            evaluation.onComplete?.();
         });

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
