import { describe, expect, it } from "vitest";
import { SquatEvaluator } from "../squatEvaluator";
import {
	completeSquat,
	incompleteSquat,
	squatFrame,
} from "./fixtures/poseLandmarks";

const evaluate = (frames: ReturnType<typeof squatFrame>[]) => {
	const evaluator = new SquatEvaluator();
	let result = evaluator.update(frames[0]);
	for (const frame of frames.slice(1)) result = evaluator.update(frame);
	return result;
};

describe("SquatEvaluator", () => {
	it("counts exactly one complete phase cycle", () =>
		expect(evaluate(completeSquat).repetitions).toBe(1));
	it("rejects an incomplete squat", () =>
		expect(evaluate(incompleteSquat).repetitions).toBe(0));
	it("counts the same repetition at a slower speed", () =>
		expect(
			evaluate(completeSquat.flatMap((frame) => [frame, frame])).repetitions,
		).toBe(1));
	it("debounces jitter around transitions", () =>
		expect(
			evaluate([
				...completeSquat.slice(0, 4),
				squatFrame(0.16),
				squatFrame(0.08),
				...completeSquat.slice(4),
			]).repetitions,
		).toBe(1));
	it("reports cannot evaluate for hidden required joints", () => {
		const frame = squatFrame(0);
		frame[25].visibility = 0.1;
		expect(new SquatEvaluator().update(frame)).toMatchObject({
			canEvaluate: false,
			repetitions: 0,
		});
	});
	it("reports cannot evaluate for invalid knee geometry", () => {
		const frame = squatFrame(0);
		frame[27] = { ...frame[25] };
		expect(new SquatEvaluator().update(frame)).toMatchObject({
			canEvaluate: false,
			depth: null,
			warning: expect.stringMatching(/geometry is invalid/i),
		});
	});
});
