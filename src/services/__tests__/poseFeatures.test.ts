import { describe, expect, it } from "vitest";
import { normalizePose } from "../poseFeatures";
import {
	mirrorPose,
	standingPose,
	transformPose,
} from "./fixtures/poseLandmarks";

const distance = (
	first: ReturnType<typeof normalizePose>,
	second: ReturnType<typeof normalizePose>,
) => {
	let total = 0;
	let count = 0;
	first.landmarks.forEach((landmark, index) => {
		const other = second.landmarks[index];
		if (landmark && other) {
			total += Math.hypot(
				landmark.x - other.x,
				landmark.y - other.y,
				landmark.z - other.z,
			);
			count += 1;
		}
	});
	return total / count;
};

describe("normalizePose", () => {
	it("makes translated and scaled versions equivalent", () => {
		const original = standingPose();
		expect(
			distance(
				normalizePose(original),
				normalizePose(transformPose(original, 0.6, 0.2, 0.1)),
			),
		).toBeLessThan(0.001);
	});

	it("accounts explicitly for mirrored camera input", () => {
		const original = standingPose();
		expect(
			distance(
				normalizePose(original),
				normalizePose(mirrorPose(original), true),
			),
		).toBeLessThan(0.001);
	});

	it("uses visible geometry for normalization and excludes low-confidence points", () => {
		const pose = standingPose();
		pose[23].visibility = 0.1;
		const normalized = normalizePose(pose);

		expect(normalized.warning).toBeUndefined();
		expect(normalized.landmarks[23]).toBeNull();
		expect(normalized.landmarks[24]).not.toBeNull();
	});

	it("returns a quality warning when visible geometry is unavailable", () => {
		const pose = standingPose().map((landmark) => ({
			...landmark,
			visibility: 0.1,
		}));

		expect(normalizePose(pose).warning).toMatch(/cannot evaluate/i);
	});
});
