import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import CapturedPoseView from "../CapturedPoseView";
import type { PoseLandmark } from "../../../types";

const sampleLandmarks: PoseLandmark[] = [
  { x: 0.5, y: 0.5, z: 0, visibility: 1 },
  { x: 0.6, y: 0.6, z: 0, visibility: 1 },
];

describe("CapturedPoseView", () => {
  it("horizontally mirrors the captured image to match the selfie-view preview the user saw while recording", () => {
    render(
      <CapturedPoseView
        capturedImage="data:image/jpeg;base64,test"
        capturedLandmarks={sampleLandmarks}
      />
    );

    const capturedImage = screen.getByAltText("Captured pose");
    expect(capturedImage.style.transform).toContain("scaleX(-1)");
  });
});
