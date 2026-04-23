import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VideoReferencePlayer from "../VideoReferencePlayer";
import type { Activity } from "../../types";

const mockResolveUrl = vi.fn();

vi.mock("../../services/VideoBlobStore", () => ({
  default: {
    resolveUrl: (...args: unknown[]) => mockResolveUrl(...args),
    save: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
  },
}));

const activityWithoutVideo: Activity = {
  id: "move-1",
  name: "No video movement",
  type: "movement",
  createdBy: "trainer",
  createdAt: new Date(),
  isPublic: true,
  landmarks: [
    { timestamp: 0, landmarks: [{ x: 0.5, y: 0.5, z: 0, visibility: 1 }] },
  ],
  movementData: [
    { timestamp: 0, landmarks: [{ x: 0.5, y: 0.5, z: 0, visibility: 1 }] },
  ],
};

const activityWithBlob: Activity = {
  ...activityWithoutVideo,
  id: "move-2",
  videoBlobId: "blob-1",
  videoMimeType: "video/webm",
};

describe("VideoReferencePlayer", () => {
  const originalCreateObjectURL = global.URL.createObjectURL;
  const originalRevokeObjectURL = global.URL.revokeObjectURL;

  beforeEach(() => {
    mockResolveUrl.mockReset();
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    global.URL.createObjectURL = originalCreateObjectURL;
    global.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("falls back to MovementPlayback when no video is available", () => {
    render(<VideoReferencePlayer activity={activityWithoutVideo} />);
    expect(screen.getByTestId("movement-playback")).toBeInTheDocument();
    expect(screen.queryByTestId("reference-video")).not.toBeInTheDocument();
  });

  it("renders the stored reference video when a blob id is available", async () => {
    mockResolveUrl.mockResolvedValue("blob:video");

    render(<VideoReferencePlayer activity={activityWithBlob} />);

    await waitFor(() => {
      expect(screen.getByTestId("reference-video")).toBeInTheDocument();
    });

    const video = screen.getByTestId("reference-video") as HTMLVideoElement;
    expect(video.getAttribute("src")).toBe("blob:video");
    expect(video.loop).toBe(true);
    expect(mockResolveUrl).toHaveBeenCalledWith("blob-1");
  });

  it("falls back to skeleton when blob resolution fails", async () => {
    mockResolveUrl.mockResolvedValue(null);

    render(<VideoReferencePlayer activity={activityWithBlob} />);

    await waitFor(() => {
      expect(screen.getByTestId("movement-playback")).toBeInTheDocument();
    });
  });

  it("shows the empty-reference placeholder when no playback data exists", () => {
    const empty: Activity = {
      ...activityWithoutVideo,
      id: "move-empty",
      landmarks: [],
      movementData: [],
    };
    render(<VideoReferencePlayer activity={empty} />);
    expect(screen.getByText("No reference available")).toBeInTheDocument();
  });
});
