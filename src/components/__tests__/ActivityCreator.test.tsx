import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ActivityCreator from "../ActivityCreator";
import {
  mediaPipeService,
  webcamService,
  activityService,
} from "../../services";

// Mock the services
vi.mock("../../services", () => ({
  mediaPipeService: {
    initializePoseLandmarker: vi.fn(),
    detectSinglePose: vi.fn(),
    extractLandmarks: vi.fn(),
    validatePoseQuality: vi.fn(),
    startMovementTracking: vi.fn(),
    validateMovementSequence: vi.fn(),
  },
  webcamService: {
    startVideoStream: vi.fn(),
    stopVideoStream: vi.fn(),
  },
  activityService: {
    createPoseActivity: vi.fn(),
    createMovementActivity: vi.fn(),
  },
}));

// Mock WebcamPreview component
vi.mock("../WebcamPreview", () => ({
  default: React.forwardRef<HTMLVideoElement, any>((props, ref) => (
    <div data-testid="webcam-preview">
      <video ref={ref} />
      {props.isRecording && <div>Recording</div>}
      {props.landmarks.length > 0 && <div>Landmarks visible</div>}
    </div>
  )),
}));

describe("ActivityCreator", () => {
  const mockVideoElement = document.createElement("video");

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    vi.mocked(mediaPipeService.initializePoseLandmarker).mockResolvedValue(
      {} as any
    );
    vi.mocked(webcamService.startVideoStream).mockResolvedValue();
    vi.mocked(mediaPipeService.detectSinglePose).mockResolvedValue({} as any);
    vi.mocked(mediaPipeService.extractLandmarks).mockReturnValue([
      { x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 },
    ]);
    vi.mocked(mediaPipeService.validatePoseQuality).mockReturnValue({
      isValid: true,
      issues: [],
    });
    vi.mocked(activityService.createPoseActivity).mockResolvedValue("pose-123");
    vi.mocked(activityService.createMovementActivity).mockResolvedValue(
      "movement-123"
    );
  });

  it("should render form elements correctly", () => {
    const { container } = render(<ActivityCreator />);

    expect(container.textContent).toContain("Create Activity");
    expect(container.textContent).toContain("Activity Name");
    expect(container.textContent).toContain("Activity Type");
    expect(container.textContent).toContain("Single Pose");
    expect(container.textContent).toContain("Movement Sequence");
  });

  it("should show duration selector for movement type", () => {
    const { container } = render(<ActivityCreator />);

    // Switch to movement type
    const movementRadio = container.querySelector(
      'input[value="movement"]'
    ) as HTMLInputElement;
    fireEvent.click(movementRadio);

    expect(container.textContent).toContain("Duration");
    expect(container.textContent).toContain("10 seconds");
    expect(container.textContent).toContain("30 seconds");
  });

  it("should not show duration selector for pose type", () => {
    const { container } = render(<ActivityCreator />);

    // Pose is default, but let's make sure
    const poseRadio = container.querySelector(
      'input[value="pose"]'
    ) as HTMLInputElement;
    fireEvent.click(poseRadio);

    expect(container.textContent).not.toContain("Duration");
  });

  it("should disable start recording when name is empty", () => {
    const { container } = render(<ActivityCreator />);

    const startButton = container.querySelector("button") as HTMLButtonElement;
    expect(startButton.textContent).toContain("Start Recording");
    expect(startButton.disabled).toBe(true);
  });

  it("should enable start recording when name is provided", () => {
    const { container } = render(<ActivityCreator />);

    const nameInput = container.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Test Activity" } });

    const startButton = container.querySelector("button") as HTMLButtonElement;
    expect(startButton.disabled).toBe(false);
  });

  it("should handle pose recording successfully", async () => {
    const onActivityCreated = vi.fn();
    const { container } = render(
      <ActivityCreator onActivityCreated={onActivityCreated} />
    );

    // Fill in activity name
    const nameInput = container.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Test Pose" } });

    // Start recording
    const startButton = container.querySelector("button") as HTMLButtonElement;
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mediaPipeService.detectSinglePose).toHaveBeenCalled();
      expect(activityService.createPoseActivity).toHaveBeenCalledWith(
        [{ x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }],
        expect.objectContaining({
          name: "Test Pose",
          type: "pose",
          createdBy: "trainer",
          isPublic: true,
        })
      );
      expect(onActivityCreated).toHaveBeenCalledWith("pose-123");
    });
  });

  it("should handle movement recording successfully", async () => {
    const onActivityCreated = vi.fn();
    const { container } = render(
      <ActivityCreator onActivityCreated={onActivityCreated} />
    );

    // Switch to movement type
    const movementRadio = container.querySelector(
      'input[value="movement"]'
    ) as HTMLInputElement;
    fireEvent.click(movementRadio);

    // Fill in activity name
    const nameInput = container.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Test Movement" } });

    // Mock movement tracking
    vi.mocked(mediaPipeService.startMovementTracking).mockImplementation(
      async (video, onPoseDetected, options) => {
        // Simulate pose detection
        onPoseDetected([{ x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }], 100);

        // Simulate completion
        setTimeout(() => options?.onComplete?.(), 100);

        return () => {}; // Stop function
      }
    );

    vi.mocked(mediaPipeService.validateMovementSequence).mockReturnValue({
      isValid: true,
      issues: [],
      stats: {
        totalFrames: 30,
        duration: 1000,
        averageConfidence: 0.9,
        frameRate: 30,
      },
    });

    // Start recording
    const startButton = container.querySelector("button") as HTMLButtonElement;
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mediaPipeService.startMovementTracking).toHaveBeenCalled();
      expect(activityService.createMovementActivity).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            timestamp: 100,
            landmarks: [{ x: 0.5, y: 0.5, z: 0.1, visibility: 0.9 }],
          }),
        ]),
        expect.objectContaining({
          name: "Test Movement",
          type: "movement",
          createdBy: "trainer",
          duration: 10000,
          isPublic: true,
        })
      );
      expect(onActivityCreated).toHaveBeenCalledWith("movement-123");
    });
  });

  it("should handle pose detection errors", async () => {
    const onError = vi.fn();
    const { container } = render(<ActivityCreator onError={onError} />);

    // Mock error
    vi.mocked(mediaPipeService.detectSinglePose).mockRejectedValue(
      new Error("Pose detection failed")
    );

    // Fill in activity name
    const nameInput = container.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Test Pose" } });

    // Start recording
    const startButton = container.querySelector("button") as HTMLButtonElement;
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(container.textContent).toContain("Pose detection failed");
      expect(onError).toHaveBeenCalledWith("Pose detection failed");
    });
  });

  it("should handle no pose detected error", async () => {
    const { container } = render(<ActivityCreator />);

    // Mock no landmarks
    vi.mocked(mediaPipeService.extractLandmarks).mockReturnValue([]);

    // Fill in activity name
    const nameInput = container.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Test Pose" } });

    // Start recording
    const startButton = container.querySelector("button") as HTMLButtonElement;
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(container.textContent).toContain("No pose detected");
    });
  });

  it("should handle pose quality validation errors", async () => {
    const { container } = render(<ActivityCreator />);

    // Mock poor quality pose
    vi.mocked(mediaPipeService.validatePoseQuality).mockReturnValue({
      isValid: false,
      issues: ["Low visibility landmarks", "Invalid coordinates"],
    });

    // Fill in activity name
    const nameInput = container.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Test Pose" } });

    // Start recording
    const startButton = container.querySelector("button") as HTMLButtonElement;
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(container.textContent).toContain("Pose quality issues");
      expect(container.textContent).toContain("Low visibility landmarks");
    });
  });

  it("should show success message after completion", async () => {
    const { container } = render(<ActivityCreator />);

    // Fill in activity name
    const nameInput = container.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Test Pose" } });

    // Start recording
    const startButton = container.querySelector("button") as HTMLButtonElement;
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(container.textContent).toContain("Activity Created Successfully!");
      expect(container.textContent).toContain("Create Another");
    });
  });

  it("should reset form when create another is clicked", async () => {
    const { container } = render(<ActivityCreator />);

    // Fill in activity name
    const nameInput = container.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Test Pose" } });

    // Start recording
    const startButton = container.querySelector("button") as HTMLButtonElement;
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(container.textContent).toContain("Create Another");
    });

    // Click create another
    const createAnotherButton = Array.from(
      container.querySelectorAll("button")
    ).find((btn) =>
      btn.textContent?.includes("Create Another")
    ) as HTMLButtonElement;
    fireEvent.click(createAnotherButton);

    // Form should be reset
    expect(
      (container.querySelector('input[type="text"]') as HTMLInputElement).value
    ).toBe("");
    expect(container.textContent).toContain("Start Recording");
  });

  it("should show test camera button", () => {
    const { container } = render(<ActivityCreator />);

    expect(container.textContent).toContain("Test Camera");
  });

  it("should handle camera errors", async () => {
    const { container } = render(<ActivityCreator />);

    // Mock camera error
    vi.mocked(webcamService.startVideoStream).mockRejectedValue(
      new Error("Camera access denied")
    );

    // Click test camera
    const testCameraButton = Array.from(
      container.querySelectorAll("button")
    ).find((btn) =>
      btn.textContent?.includes("Test Camera")
    ) as HTMLButtonElement;
    fireEvent.click(testCameraButton);

    await waitFor(() => {
      expect(container.textContent).toContain("Camera access denied");
    });
  });

  it("should show instructions for pose type", () => {
    const { container } = render(<ActivityCreator />);

    expect(container.textContent).toContain("Instructions:");
    expect(container.textContent).toContain(
      "Enter a name for your pose activity"
    );
    expect(container.textContent).toContain("hold your pose");
  });

  it("should show instructions for movement type", () => {
    const { container } = render(<ActivityCreator />);

    // Switch to movement type
    const movementRadio = container.querySelector(
      'input[value="movement"]'
    ) as HTMLInputElement;
    fireEvent.click(movementRadio);

    expect(container.textContent).toContain(
      "Enter a name for your movement activity"
    );
    expect(container.textContent).toContain("Choose the duration");
    expect(container.textContent).toContain("perform your movement");
  });

  it("should disable form controls during recording", async () => {
    const { container } = render(<ActivityCreator />);

    // Fill in activity name
    const nameInput = container.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Test Pose" } });

    // Start recording
    const startButton = container.querySelector("button") as HTMLButtonElement;
    fireEvent.click(startButton);

    // Form controls should be disabled
    expect(nameInput.disabled).toBe(true);
    expect(
      (container.querySelector('input[value="pose"]') as HTMLInputElement)
        .disabled
    ).toBe(true);
    expect(
      (container.querySelector('input[value="movement"]') as HTMLInputElement)
        .disabled
    ).toBe(true);
  });
});
