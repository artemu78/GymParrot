import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { captureImageFromVideo } from '../utils';

describe('captureImageFromVideo', () => {
  let videoMock: HTMLVideoElement;

  beforeEach(() => {
    videoMock = {
      videoWidth: 640,
      videoHeight: 480,
    } as HTMLVideoElement;
  });

  it('returns a mock image data URL in test environment', () => {
    const result = captureImageFromVideo(videoMock);
    expect(result).toBe('data:image/jpeg;base64,mock-image-data');
  });

  describe('when not in test environment', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it('captures image from video using canvas', () => {
      const mockContext = {
        drawImage: vi.fn(),
      };
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(mockContext),
        toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,captured-image'),
      };

      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as unknown as HTMLElement);

      const result = captureImageFromVideo(videoMock);

      expect(createElementSpy).toHaveBeenCalledWith('canvas');
      expect(mockCanvas.width).toBe(640);
      expect(mockCanvas.height).toBe(480);
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
      expect(mockContext.drawImage).toHaveBeenCalledWith(videoMock, 0, 0, 640, 480);
      expect(result).toBe('data:image/jpeg;base64,captured-image');
    });

    it('throws error if canvas context cannot be obtained', () => {
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(null),
      };
      vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as unknown as HTMLElement);

      expect(() => captureImageFromVideo(videoMock)).toThrow('Failed to get canvas context');
    });
  });
});
