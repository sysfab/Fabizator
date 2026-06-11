export function ImagePreview({ file }) {
  return (
    <div className="image-preview-shell">
      <div className="image-preview-stage">
        <img src={file.previewDataUrl} alt={file.name} className="image-preview" />
      </div>
      <div className="image-preview-meta">
        <span>{file.name}</span>
        <strong>{file.size}</strong>
      </div>
    </div>
  );
}
