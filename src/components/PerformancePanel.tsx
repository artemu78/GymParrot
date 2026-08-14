import type { PerformanceMetrics } from "../utils/performance";

interface PerformancePanelProps {
	metrics: PerformanceMetrics;
	uiFps: number;
	width: number;
	height: number;
	delegate: string;
	recordingEnabled: boolean;
	retainedFrames: number;
	retainedBytes: number;
}

export default function PerformancePanel({
	metrics,
	uiFps,
	width,
	height,
	delegate,
	recordingEnabled,
	retainedFrames,
	retainedBytes,
}: PerformancePanelProps) {
	return (
		<aside
			className="mt-4 rounded bg-slate-900 p-4 font-mono text-xs text-white"
			data-testid="performance-panel"
		>
			<h3 className="mb-2 font-bold">Real MediaPipe diagnostics</h3>
			<dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
				<dt>Inference</dt>
				<dd>{metrics.latestFrameTime.toFixed(1)} ms</dd>
				<dt>Average</dt>
				<dd>{metrics.averageFrameTime.toFixed(1)} ms</dd>
				<dt>p95</dt>
				<dd>{metrics.p95FrameTime.toFixed(1)} ms</dd>
				<dt>Inference FPS</dt>
				<dd>{metrics.fps.toFixed(1)}</dd>
				<dt>UI FPS</dt>
				<dd>{uiFps.toFixed(1)}</dd>
				<dt>Skipped frames</dt>
				<dd>{metrics.droppedFrames}</dd>
				<dt>Camera</dt>
				<dd>
					{width}×{height}
				</dd>
				<dt>Delegate</dt>
				<dd>{delegate}</dd>
				<dt>Review recording</dt>
				<dd>{recordingEnabled ? "on" : "off"}</dd>
				<dt>Landmarks retained</dt>
				<dd>
					{retainedFrames} (~{Math.ceil(retainedBytes / 1024)} KiB)
				</dd>
			</dl>
		</aside>
	);
}
