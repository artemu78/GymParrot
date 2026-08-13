import type { PoseLandmark } from "../../../types";

const point = (x: number, y: number, visibility = 0.99): PoseLandmark => ({ x, y, z: 0, visibility });

export const standingPose = (): PoseLandmark[] => {
  const pose = Array.from({ length: 33 }, () => point(0.5, 0.5));
  pose[11] = point(0.42, 0.25); pose[12] = point(0.58, 0.25);
  pose[23] = point(0.45, 0.5); pose[24] = point(0.55, 0.5);
  pose[25] = point(0.45, 0.7); pose[26] = point(0.55, 0.7);
  pose[27] = point(0.45, 0.9); pose[28] = point(0.55, 0.9);
  return pose;
};

export const transformPose = (pose: PoseLandmark[], scale: number, dx: number, dy: number) =>
  pose.map((landmark) => ({ ...landmark, x: landmark.x * scale + dx, y: landmark.y * scale + dy }));

export const mirrorPose = (pose: PoseLandmark[]) => pose.map((landmark) => ({ ...landmark, x: 1 - landmark.x }));

export const squatFrame = (kneeOffset: number): PoseLandmark[] => {
  const pose = standingPose();
  pose[23] = point(0.42, 0.48 + kneeOffset); pose[24] = point(0.58, 0.48 + kneeOffset);
  pose[25] = point(0.42 + kneeOffset, 0.7); pose[26] = point(0.58 - kneeOffset, 0.7);
  return pose;
};

export const completeSquat = [0, 0, 0.08, 0.08, 0.18, 0.18, 0.08, 0.08, 0, 0].map(squatFrame);
export const incompleteSquat = [0, 0, 0.07, 0.07, 0.1, 0.1, 0, 0].map(squatFrame);
