import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MovementVideoRecorder } from "../MovementVideoRecorder";

describe("MovementVideoRecorder", () => {
	const captureStreamDescriptor = Object.getOwnPropertyDescriptor(
		HTMLCanvasElement.prototype,
		"captureStream",
	);
	const context = {
		save: vi.fn(),
		restore: vi.fn(),
		translate: vi.fn(),
		scale: vi.fn(),
		drawImage: vi.fn(),
		fillRect: vi.fn(),
		beginPath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		stroke: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn(),
		fillStyle: "",
		strokeStyle: "",
		lineWidth: 0,
		lineCap: "butt",
	} as unknown as CanvasRenderingContext2D;

	class MockMediaRecorder {
		static isTypeSupported = vi.fn(() => true);
		state = "recording";
		ondataavailable: ((event: { data: Blob }) => void) | null = null;

		start = vi.fn();
		stop = vi.fn();
		addEventListener = vi.fn();
	}

	beforeEach(() => {
		vi.stubGlobal("MediaRecorder", MockMediaRecorder);
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
			context,
		);
		Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", {
			configurable: true,
			value: vi.fn(() => ({}) as MediaStream),
		});
		vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
	});

	afterEach(() => {
		Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", {
			configurable: true,
			...(captureStreamDescriptor ?? { value: undefined, writable: true }),
		});
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("mirrors landmarks together with the recorded camera frame", () => {
		const video = document.createElement("video");
		Object.defineProperty(video, "videoWidth", { value: 640 });
		Object.defineProperty(video, "videoHeight", { value: 480 });
		Object.defineProperty(video, "readyState", { value: 2 });

		const recorder = new MovementVideoRecorder(video, { mirror: true });
		recorder.pushLandmarks([
			{ x: 0.2, y: 0.5, z: 0, visibility: 1 },
			{ x: 0.3, y: 0.6, z: 0, visibility: 1 },
		]);
		recorder.start();

		expect(context.arc).toHaveBeenCalledWith(
			0.8 * 640,
			0.5 * 480,
			5,
			0,
			Math.PI * 2,
		);
	});
});
