import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import WebcamPreview from "../WebcamPreview";
import type { PoseLandmark } from "../../types";

describe("WebcamPreview", () => {
  const mockLandmarks: PoseLandmark[] = [
    { x: 0.5, y: 0.3, z: 0.1, visibility: 0.9 },
    { x: 0.4, y: 0.5, z: 0.1, visibility: 0.8 },
    { x: 0.6, y: 0.5, z: 0.1, visibility: 0.8 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render video element with correct attributes", () => {
    const { container } = render(<WebcamPreview />);

    const video = container.querySelector("video");
    expect(video).toBeTruthy();
    expect(video?.autoplay).toBe(true);
    expect(video?.playsInline).toBe(true);
    expect(video?.muted).toBe(true);
  });

  it("should apply custom dimensions", () => {
    const { container } = render(<WebcamPreview width={800} height={600} />);

    const previewContainer = container.firstChild as HTMLElement;
    expect(previewContainer.style.width).toBe("800px");
    expect(previewContainer.style.height).toBe("600px");
  });

  it("should apply custom className", () => {
    const { container } = render(<WebcamPreview className="custom-class" />);

    const previewContainer = container.firstChild as HTMLElement;
    expect(previewContainer.className).toContain("custom-class");
  });

  it("should call onVideoReady when video is ready", () => {
    const onVideoReady = vi.fn();
    const { container } = render(<WebcamPreview onVideoReady={onVideoReady} />);

    const video = container.querySelector("video") as HTMLVideoElement;
    fireEvent.loadedData(video);

    expect(onVideoReady).toHaveBeenCalledWith(video);
  });

  it("should call onError when video fails to load", () => {
    const onError = vi.fn();
    const { container } = render(<WebcamPreview onError={onError} />);

    const video = container.querySelector("video") as HTMLVideoElement;
    fireEvent.error(video);

    expect(onError).toHaveBeenCalledWith("Video failed to load");
  });

  it("should show recording indicator when recording", () => {
    const { container } = render(<WebcamPreview isRecording={true} />);

    expect(container.textContent).toContain("Recording");
  });

  it("should not show recording indicator when not recording", () => {
    const { container } = render(<WebcamPreview isRecording={false} />);

    expect(container.textContent).not.toContain("Recording");
  });

  it("should render pose landmarks when showLandmarks is true", () => {
    const { container } = render(
      <WebcamPreview
        showLandmarks={true}
        landmarks={mockLandmarks}
        isActive={true}
      />
    );

    const video = container.querySelector("video") as HTMLVideoElement;
    fireEvent.loadedData(video);

    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("should not render landmarks when showLandmarks is false", () => {
    const { container } = render(
      <WebcamPreview
        showLandmarks={false}
        landmarks={mockLandmarks}
        isActive={true}
      />
    );

    const video = container.querySelector("video") as HTMLVideoElement;
    fireEvent.loadedData(video);

    const svg = container.querySelector("svg");
    expect(svg).toBeFalsy();
  });

  it("should mirror video horizontally for better UX", () => {
    const { container } = render(<WebcamPreview />);

    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video.style.transform).toContain("scaleX(-1)");
  });

  it("should handle video metadata loaded event", () => {
    const { container } = render(<WebcamPreview />);

    const video = container.querySelector("video") as HTMLVideoElement;

    Object.defineProperty(video, "videoWidth", { value: 1280, writable: true });
    Object.defineProperty(video, "videoHeight", { value: 720, writable: true });

    fireEvent.loadedMetadata(video);
    fireEvent.loadedData(video);

    // Should not throw any errors
    expect(video).toBeTruthy();
  });

  it("should maintain aspect ratio classes", () => {
    const { container } = render(<WebcamPreview width={800} height={600} />);

    const video = container.querySelector("video");
    expect(video?.className).toContain("w-full");
    expect(video?.className).toContain("h-full");
    expect(video?.className).toContain("object-cover");
  });
});
