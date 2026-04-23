import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TimestampedLandmarks } from "../../types";
import MovementPlayback from "../MovementPlayback";

const buildFrame = (t: number, x: number): TimestampedLandmarks => ({
	timestamp: t,
	landmarks: [
		{ x, y: 0.5, z: 0, visibility: 1 },
		{ x: x + 0.05, y: 0.6, z: 0, visibility: 1 },
	],
});

describe("MovementPlayback", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("shows fallback text when sequence is empty", () => {
		render(<MovementPlayback sequence={[]} />);
		expect(screen.getByText("No movement data available")).toBeInTheDocument();
	});

	it("renders skeleton overlay for a non-empty sequence", () => {
		const sequence = [
			buildFrame(0, 0.1),
			buildFrame(500, 0.2),
			buildFrame(1000, 0.3),
		];
		const { container } = render(
			<MovementPlayback sequence={sequence} autoPlay={false} />,
		);

		expect(screen.getByTestId("movement-playback")).toBeInTheDocument();
		const circles = container.querySelectorAll("circle");
		expect(circles.length).toBeGreaterThan(0);
	});

	it("advances frames over time when playing", async () => {
		const rafSpy = vi.spyOn(window, "requestAnimationFrame");
		const sequence = [
			buildFrame(0, 0.1),
			buildFrame(100, 0.2),
			buildFrame(200, 0.3),
		];
		render(<MovementPlayback sequence={sequence} autoPlay loop={false} />);

		expect(screen.getByText("1/3")).toBeInTheDocument();

		await act(async () => {
			const callbacks = rafSpy.mock.calls.map((c) => c[0]);
			if (callbacks[0]) callbacks[0](0);
		});
		await act(async () => {
			const callbacks = rafSpy.mock.calls.map((c) => c[0]);
			if (callbacks[callbacks.length - 1]) callbacks[callbacks.length - 1](120);
		});

		expect(screen.queryByText("1/3")).not.toBeInTheDocument();
	});

	it("exposes a play/pause control that toggles state", () => {
		const sequence = [buildFrame(0, 0.1), buildFrame(500, 0.2)];
		render(<MovementPlayback sequence={sequence} autoPlay={false} />);

		const button = screen.getByRole("button", { name: /play playback/i });
		expect(button).toBeInTheDocument();

		fireEvent.click(button);

		expect(
			screen.getByRole("button", { name: /pause playback/i }),
		).toBeInTheDocument();
	});
});
