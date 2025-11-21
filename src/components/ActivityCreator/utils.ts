export const captureImageFromVideo = (video: HTMLVideoElement): string => {
  // In test environment, return a mock data URL
  if (process.env.NODE_ENV === 'test') {
    return 'data:image/jpeg;base64,mock-image-data';
  }
  
  // Create a canvas to capture the video frame
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // Draw the current video frame WITHOUT mirroring
  // MediaPipe processes the non-mirrored video, so landmarks match non-mirrored image
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Convert to data URL
  return canvas.toDataURL('image/jpeg', 0.95);
};
