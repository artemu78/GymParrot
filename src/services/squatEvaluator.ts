import type { PoseLandmark } from "../types";
import {
	LANDMARK_INDEX,
	POSE_VISIBILITY_THRESHOLD,
	jointAngle,
} from "./poseFeatures";

export type SquatPhase = "standing" | "descending" | "bottom" | "ascending";

export interface SquatConfig {
	visibilityThreshold: number;
	standingAngle: number;
	bottomAngle: number;
	transitionFrames: number;
}

export const DEFAULT_SQUAT_CONFIG: SquatConfig = {
	visibilityThreshold: POSE_VISIBILITY_THRESHOLD,
	standingAngle: 160,
	bottomAngle: 105,
	transitionFrames: 2,
};

export interface SquatState {
	canEvaluate: boolean;
	phase: SquatPhase;
	repetitions: number;
	depth: number | null;
	warning?: string;
}

export class SquatEvaluator {
	private phase: SquatPhase = "standing";
	private repetitions = 0;
	private candidate: SquatPhase | null = null;
	private candidateFrames = 0;

	constructor(private readonly config: SquatConfig = DEFAULT_SQUAT_CONFIG) {}

	update(landmarks: PoseLandmark[]): SquatState {
		const indices = [
			LANDMARK_INDEX.leftHip,
			LANDMARK_INDEX.rightHip,
			LANDMARK_INDEX.leftKnee,
			LANDMARK_INDEX.rightKnee,
			LANDMARK_INDEX.leftAnkle,
			LANDMARK_INDEX.rightAnkle,
		];
		const required = indices.map((index) => landmarks[index]);
		if (
			required.some(
				(landmark) =>
					!landmark ||
					(landmark.visibility ?? 1) < this.config.visibilityThreshold,
			)
		) {
			this.candidate = null;
			this.candidateFrames = 0;
			return {
				canEvaluate: false,
				phase: this.phase,
				repetitions: this.repetitions,
				depth: null,
				warning:
					"Cannot evaluate squat: hips, knees, and ankles must be visible",
			};
		}

		const leftAngle = jointAngle(required[0], required[2], required[4]);
		const rightAngle = jointAngle(required[1], required[3], required[5]);
		const kneeAngle = (leftAngle + rightAngle) / 2;
		const depth = Math.max(
			0,
			Math.min(
				1,
				(this.config.standingAngle - kneeAngle) /
					(this.config.standingAngle - this.config.bottomAngle),
			),
		);

		let next = this.phase;
		if (this.phase === "standing" && kneeAngle < this.config.standingAngle)
			next = "descending";
		else if (
			this.phase === "descending" &&
			kneeAngle <= this.config.bottomAngle
		)
			next = "bottom";
		else if (
			this.phase === "bottom" &&
			kneeAngle > this.config.bottomAngle + 10
		)
			next = "ascending";
		else if (
			this.phase === "ascending" &&
			kneeAngle >= this.config.standingAngle
		)
			next = "standing";

		if (next !== this.phase) {
			if (this.candidate === next) this.candidateFrames += 1;
			else {
				this.candidate = next;
				this.candidateFrames = 1;
			}
			if (this.candidateFrames >= this.config.transitionFrames) {
				if (this.phase === "ascending" && next === "standing")
					this.repetitions += 1;
				this.phase = next;
				this.candidate = null;
				this.candidateFrames = 0;
			}
		} else {
			this.candidate = null;
			this.candidateFrames = 0;
		}

		return {
			canEvaluate: true,
			phase: this.phase,
			repetitions: this.repetitions,
			depth,
		};
	}
}
