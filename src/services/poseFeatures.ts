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

const hasFiniteCoordinates = (
	landmark: PoseLandmark | undefined,
): landmark is PoseLandmark =>
	!!landmark &&
	Number.isFinite(landmark.x) &&
	Number.isFinite(landmark.y) &&
	Number.isFinite(landmark.z);

export function normalizePose(
	landmarks: PoseLandmark[],
	mirrored = false,
): NormalizedPose {
	const visibleLandmarks = landmarks.filter(
		(landmark) =>
			hasFiniteCoordinates(landmark) &&
			(landmark.visibility ?? 1) >= POSE_VISIBILITY_THRESHOLD,
	);

	if (visibleLandmarks.length < 2) {
		return {
			landmarks: landmarks.map(() => null),
			warning: "Cannot evaluate: not enough visible landmarks",
		};
	}

	const originX =
		visibleLandmarks.reduce((sum, landmark) => sum + landmark.x, 0) /
		visibleLandmarks.length;
	const originY =
		visibleLandmarks.reduce((sum, landmark) => sum + landmark.y, 0) /
		visibleLandmarks.length;
	const originZ =
		visibleLandmarks.reduce((sum, landmark) => sum + landmark.z, 0) /
		visibleLandmarks.length;
	const scale = Math.sqrt(
		visibleLandmarks.reduce(
			(sum, landmark) =>
				sum + (landmark.x - originX) ** 2 + (landmark.y - originY) ** 2,
			0,
		) / visibleLandmarks.length,
	);

	if (!Number.isFinite(scale) || scale < 0.01) {
		return {
			landmarks: landmarks.map(() => null),
			warning: "Cannot evaluate: pose scale is unavailable",
		};
	}

	return {
		landmarks: landmarks.map((landmark) => {
			if (
				!hasFiniteCoordinates(landmark) ||
				(landmark.visibility ?? 1) < POSE_VISIBILITY_THRESHOLD
			) {
				return null;
			}
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
