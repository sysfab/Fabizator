export function AudioPreview({ file }) {
  return (
    <div className="audio-preview-shell">
      <div className="audio-preview-card">
        <audio src={file.previewDataUrl} controls className="audio-player">
          Your browser does not support audio playback.
        </audio>
      </div>
    </div>
  );
}
