import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmark, TimestampedLandmarks } from "../types";

interface MovementPlaybackProps {
	sequence: TimestampedLandmarks[];
	autoPlay?: boolean;
	loop?: boolean;
	className?: string;
	mirrored?: boolean;
}

const POSE_CONNECTIONS: Array<[number, number]> = [
	// Face
	[0, 1],
	[1, 2],
	[2, 3],
	[3, 7],
	[0, 4],
	[4, 5],
	[5, 6],
	[6, 8],
	// Body
	[9, 10],
	[11, 12],
	[11, 13],
	[13, 15],
	[15, 17],
	[15, 19],
	[15, 21],
	[12, 14],
	[14, 16],
	[16, 18],
	[16, 20],
	[16, 22],
	// Legs
	[11, 23],
	[12, 24],
	[23, 24],
	[23, 25],
	[25, 27],
	[27, 29],
	[29, 31],
	[24, 26],
	[26, 28],
	[28, 30],
	[30, 32],
];

interface SkeletonOverlayProps {
	landmarks: PoseLandmark[];
}

const SkeletonOverlay: React.FC<SkeletonOverlayProps> = ({ landmarks }) => {
	if (!landmarks || landmarks.length === 0) return null;

	return (
		<svg
			className="absolute inset-0 pointer-events-none w-full h-full"
			viewBox="0 0 1 1"
			preserveAspectRatio="xMidYMid meet"
			role="img"
			aria-label="Recorded movement skeleton"
		>
			<title>Recorded movement skeleton</title>
			{POSE_CONNECTIONS.map(([startIdx, endIdx]) => {
				const start = landmarks[startIdx];
				const end = landmarks[endIdx];
				if (
					!start ||
					!end ||
					(start.visibility ?? 1) < 0.5 ||
					(end.visibility ?? 1) < 0.5
				) {
					return null;
				}
				return (
					<line
						key={`conn-${startIdx}-${endIdx}`}
						x1={start.x}
						y1={start.y}
						x2={end.x}
						y2={end.y}
						stroke="#00ff88"
						strokeWidth="0.006"
						strokeLinecap="round"
						opacity="0.9"
					/>
				);
			})}
			{landmarks.map((lm, idx) => {
				if ((lm.visibility ?? 1) < 0.5) return null;
				return (
					<circle
						key={`pt-${idx}-${lm.x.toFixed(3)}-${lm.y.toFixed(3)}`}
						cx={lm.x}
						cy={lm.y}
						r="0.008"
						fill="#ff3355"
						opacity="0.95"
					/>
				);
			})}
		</svg>
	);
};

/**
 * Plays back a recorded movement sequence as an animated skeleton on a dark canvas.
 * Acts as the "recorded video" for movement activities where only landmarks
 * (not raw video frames) are stored.
 */
const MovementPlayback: React.FC<MovementPlaybackProps> = ({
	sequence,
	autoPlay = true,
	loop = true,
	className = "",
	mirrored = false,
}) => {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isPlaying, setIsPlaying] = useState(autoPlay);
	const rafRef = useRef<number | null>(null);
	const startTimeRef = useRef<number | null>(null);

	const hasFrames = Array.isArray(sequence) && sequence.length > 0;
	const firstTs = hasFrames ? sequence[0].timestamp : 0;
	const totalDuration = hasFrames
		? Math.max(0, sequence[sequence.length - 1].timestamp - firstTs)
		: 0;

	const stop = useCallback(() => {
		setIsPlaying(false);
		if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		startTimeRef.current = null;
	}, []);

	const restart = useCallback(() => {
		setCurrentIndex(0);
		startTimeRef.current = null;
		setIsPlaying(true);
	}, []);

	useEffect(() => {
		if (!isPlaying || !hasFrames) return;

		const step = (now: number) => {
			if (startTimeRef.current === null) {
				startTimeRef.current = now;
			}
			const elapsed = now - startTimeRef.current;

			let idx = 0;
			for (let i = 0; i < sequence.length; i++) {
				const relTs = sequence[i].timestamp - firstTs;
				if (relTs <= elapsed) {
					idx = i;
				} else {
					break;
				}
			}

			setCurrentIndex(idx);

			if (elapsed >= totalDuration) {
				if (loop) {
					startTimeRef.current = now;
					setCurrentIndex(0);
					rafRef.current = requestAnimationFrame(step);
				} else {
					setIsPlaying(false);
					rafRef.current = null;
				}
				return;
			}

			rafRef.current = requestAnimationFrame(step);
		};

		rafRef.current = requestAnimationFrame(step);

		return () => {
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
		};
	}, [isPlaying, hasFrames, sequence, firstTs, totalDuration, loop]);

	if (!hasFrames) {
		return (
			<div
				className={`flex items-center justify-center h-full text-gray-400 ${className}`}
			>
				No movement data available
			</div>
		);
	}

	const currentLandmarks = sequence[currentIndex]?.landmarks ?? [];
	const progress =
		totalDuration > 0
			? Math.min(
					1,
					(sequence[currentIndex].timestamp - firstTs) / totalDuration,
				)
			: 0;

	return (
		<div
			className={`relative w-full h-full bg-gray-900 ${className}`}
			data-testid="movement-playback"
		>
			<div
				className="absolute inset-0"
				style={mirrored ? { transform: "scaleX(-1)" } : undefined}
			>
				<SkeletonOverlay landmarks={currentLandmarks} />
			</div>

			{/* Playback controls */}
			<div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 pointer-events-auto">
				<button
					type="button"
					onClick={() => (isPlaying ? stop() : restart())}
					className="px-2 py-1 text-xs bg-white/90 text-gray-800 rounded shadow hover:bg-white"
					aria-label={isPlaying ? "Pause playback" : "Play playback"}
				>
					{isPlaying ? "Pause" : "Play"}
				</button>
				<div className="flex-1 h-1 bg-white/20 rounded overflow-hidden">
					<div
						className="h-full bg-green-400 transition-[width] duration-100"
						style={{ width: `${progress * 100}%` }}
					/>
				</div>
				<span className="text-xs text-white/80 tabular-nums">
					{currentIndex + 1}/{sequence.length}
				</span>
			</div>
		</div>
	);
};

export default MovementPlayback;
