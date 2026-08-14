import type { PoseLandmark } from "../types";

/**
 * Pose connections used for drawing the skeleton overlay (matches the UI
 * landmark overlay). Kept local so the recorder has no UI dependency.
 */
const POSE_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [29, 31],
  [24, 26], [26, 28], [28, 30], [30, 32],
];

export interface MovementVideoRecorderOptions {
  /** Target FPS for the canvas-based recording. Defaults to 30. */
  frameRate?: number;
  /** Preferred MIME types, tried in order. Falls back to browser default. */
  mimeTypes?: string[];
  /**
   * Mirror horizontally to match the mirrored webcam preview users see.
   * Defaults to true.
   */
  mirror?: boolean;
}

export interface RecordedVideo {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

const DEFAULT_MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];

function pickSupportedMimeType(candidates: string[]): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return undefined;
}

/**
 * Records the trainer's webcam feed with the pose-landmark skeleton baked into
 * the video via an offscreen canvas. The resulting WebM/MP4 blob can then be
 * persisted and played back during practice and review.
 *
 * Usage:
 *   const rec = new MovementVideoRecorder(video, { frameRate: 30 });
 *   rec.start();
 *   // …on every mediapipe frame:
 *   rec.pushLandmarks(landmarks);
 *   // …when done:
 *   const { blob, mimeType } = await rec.stop();
 */
export class MovementVideoRecorder {
  private readonly video: HTMLVideoElement;
  private readonly options: Required<Omit<MovementVideoRecorderOptions, "mimeTypes">> & {
    mimeTypes: string[];
  };
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private rafId: number | null = null;
  private latestLandmarks: PoseLandmark[] = [];
  private startedAt = 0;
  private activeMimeType = "";

  constructor(video: HTMLVideoElement, options: MovementVideoRecorderOptions = {}) {
    this.video = video;
    this.options = {
      frameRate: options.frameRate ?? 30,
      mirror: options.mirror ?? true,
      mimeTypes: options.mimeTypes ?? DEFAULT_MIME_TYPES,
    };
  }

  /** Update the landmarks that will be drawn on the next rendered frame. */
  pushLandmarks(landmarks: PoseLandmark[]): void {
    this.latestLandmarks = landmarks;
  }

  start(): void {
    if (this.recorder) return;

    if (typeof MediaRecorder === "undefined") {
      throw new Error("MediaRecorder is not supported in this browser");
    }

    const width = this.video.videoWidth || 640;
    const height = this.video.videoHeight || 480;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to get 2D canvas context for video recording");
    }
    this.canvas = canvas;
    this.ctx = ctx;

    const stream = canvas.captureStream(this.options.frameRate);
    const mimeType = pickSupportedMimeType(this.options.mimeTypes);
    this.activeMimeType = mimeType ?? "video/webm";

    this.recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );
    this.chunks = [];
    this.recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.startedAt = performance.now();
    this.recorder.start(250);
    this.drawLoop();
  }

  private drawLoop = () => {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const canvas = this.canvas;
    const width = canvas.width;
    const height = canvas.height;

    ctx.save();
    if (this.options.mirror) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    try {
      if (this.video.readyState >= 2 && this.video.videoWidth > 0) {
        ctx.drawImage(this.video, 0, 0, width, height);
      } else {
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, width, height);
      }
    } catch {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();

    this.drawSkeleton(ctx, width, height);

    this.rafId = requestAnimationFrame(this.drawLoop);
  };

  private drawSkeleton(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const lms = this.latestLandmarks;
    if (!lms || lms.length === 0) return;

    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = Math.max(2, Math.round(width * 0.005));
    ctx.lineCap = "round";

    for (const [a, b] of POSE_CONNECTIONS) {
      const start = lms[a];
      const end = lms[b];
      if (
        !start || !end ||
        (start.visibility ?? 1) < 0.5 ||
        (end.visibility ?? 1) < 0.5
      ) continue;
      ctx.beginPath();
      ctx.moveTo(start.x * width, start.y * height);
      ctx.lineTo(end.x * width, end.y * height);
      ctx.stroke();
    }

    ctx.fillStyle = "#ff3355";
    const radius = Math.max(3, Math.round(width * 0.008));
    for (const lm of lms) {
      if ((lm.visibility ?? 1) < 0.5) continue;
      ctx.beginPath();
      ctx.arc(lm.x * width, lm.y * height, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  async stop(): Promise<RecordedVideo> {
    if (!this.recorder) {
      throw new Error("Recorder was never started");
    }

    const recorder = this.recorder;
    const stopped = new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
    });

    if (recorder.state !== "inactive") {
      recorder.stop();
    }
    await stopped;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    const blob = new Blob(this.chunks, { type: this.activeMimeType });
    const durationMs = Math.max(0, performance.now() - this.startedAt);

    this.recorder = null;
    this.canvas = null;
    this.ctx = null;
    this.chunks = [];
    this.latestLandmarks = [];

    return { blob, mimeType: this.activeMimeType, durationMs };
  }

  cancel(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.recorder && this.recorder.state !== "inactive") {
      try {
        this.recorder.stop();
      } catch {
        /* ignore */
      }
    }
    this.recorder = null;
    this.canvas = null;
    this.ctx = null;
    this.chunks = [];
    this.latestLandmarks = [];
  }

  /** Returns true if MediaRecorder is available and a supported mime type exists. */
  static isSupported(): boolean {
    if (typeof MediaRecorder === "undefined") return false;
    return Boolean(pickSupportedMimeType(DEFAULT_MIME_TYPES));
  }
}
