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
  });

  describe("Pose Comparison Result", () => {
      beforeEach(async () => {
          vi.mocked(activityService.getActivityById).mockResolvedValue(mockPoseActivity);
          // We need to mock Canvas API for captureImage
          HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
              translate: vi.fn(),
              scale: vi.fn(),
              drawImage: vi.fn(),
          });
          HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,test");
      });
      
      it("should initiate countdown when practice starts", async () => {
          // Use real timers
          vi.useRealTimers();

          const { container } = render(<PracticeInterface activityId="pose-1" />);

          await waitFor(() => {
              expect(screen.getByText("Start Practice")).toBeInTheDocument();
          });

          // Mock video element properties explicitly
          const video = container.querySelector("video");
          if (video) {
             Object.defineProperty(video, "videoWidth", { value: 640, writable: true });
             Object.defineProperty(video, "videoHeight", { value: 480, writable: true });
          }

          fireEvent.click(screen.getByText("Start Practice"));

          // Wait for countdown to appear (it has 200ms delay)
          await waitFor(() => {
             expect(screen.getByText("3")).toBeInTheDocument();
          }, { timeout: 2000 });

          // Verify cancel button appears
          expect(screen.getByText("Cancel")).toBeInTheDocument();
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
  });
});
