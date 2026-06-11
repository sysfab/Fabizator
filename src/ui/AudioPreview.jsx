export function AudioPreview({ file }) {
  return (
    <div className="audio-preview-shell">
      <div className="audio-preview-card">
        <div className="audio-preview-icon" aria-hidden="true">♪</div>
        <div className="audio-preview-title">
          <span>Sound Asset</span>
          <strong>{file.name}</strong>
        </div>
        <audio src={file.previewDataUrl} controls className="audio-player">
          Your browser does not support audio playback.
        </audio>
        <div className="audio-preview-meta">
          <span>{file.path}</span>
          <strong>{file.size}</strong>
        </div>
      </div>
    </div>
  );
}
