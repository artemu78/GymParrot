import type { PoseLandmark } from "../types";

export const POSE_VISIBILITY_THRESHOLD = 0.5;

export const LANDMARK_INDEX = {
	leftShoulder: 11,
	rightShoulder: 12,
	leftHip: 23,
	rightHip: 24,
	leftKnee: 25,
	rightKnee: 26,
	leftAnkle: 27,
	rightAnkle: 28,
} as const;

export interface NormalizedPose {
	landmarks: Array<PoseLandmark | null>;
	warning?: string;
}

const isVisible = (landmark: PoseLandmark | undefined, threshold: number) =>
	!!landmark &&
	Number.isFinite(landmark.x) &&
	Number.isFinite(landmark.y) &&
	Number.isFinite(landmark.z) &&
	(landmark.visibility ?? 1) >= threshold;

export function normalizePose(
	landmarks: PoseLandmark[],
	mirrored = false,
	visibilityThreshold = POSE_VISIBILITY_THRESHOLD,
): NormalizedPose {
	const leftHip = landmarks[LANDMARK_INDEX.leftHip];
	const rightHip = landmarks[LANDMARK_INDEX.rightHip];
	const leftShoulder = landmarks[LANDMARK_INDEX.leftShoulder];
	const rightShoulder = landmarks[LANDMARK_INDEX.rightShoulder];
	const anchors = [leftHip, rightHip, leftShoulder, rightShoulder];

	if (!anchors.every((landmark) => isVisible(landmark, visibilityThreshold))) {
		return {
			landmarks: landmarks.map(() => null),
			warning: "Cannot evaluate: hips and shoulders must be visible",
		};
	}

	const originX = (leftHip.x + rightHip.x) / 2;
	const originY = (leftHip.y + rightHip.y) / 2;
	const originZ = (leftHip.z + rightHip.z) / 2;
	const shoulderX = (leftShoulder.x + rightShoulder.x) / 2;
	const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
	const scale = Math.hypot(shoulderX - originX, shoulderY - originY);

	if (!Number.isFinite(scale) || scale < 0.01) {
		return {
			landmarks: landmarks.map(() => null),
			warning: "Cannot evaluate: torso scale is unavailable",
		};
	}

	return {
		landmarks: landmarks.map((landmark) => {
			if (!isVisible(landmark, visibilityThreshold)) return null;
			return {
				x:
					((mirrored ? 1 - landmark.x : landmark.x) -
						(mirrored ? 1 - originX : originX)) /
					scale,
				y: (landmark.y - originY) / scale,
				z: (landmark.z - originZ) / scale,
				visibility: landmark.visibility,
			};
		}),
	};
}

export function jointAngle(
	first: PoseLandmark,
	vertex: PoseLandmark,
	third: PoseLandmark,
): number {
	const a = { x: first.x - vertex.x, y: first.y - vertex.y };
	const b = { x: third.x - vertex.x, y: third.y - vertex.y };
	const denominator = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
	if (denominator === 0) return Number.NaN;
	const cosine = Math.max(
		-1,
		Math.min(1, (a.x * b.x + a.y * b.y) / denominator),
	);
	return (Math.acos(cosine) * 180) / Math.PI;
}
