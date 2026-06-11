export function EditorTabs({ files, selectedFileId, onSelectFile, onCloseTab }) {
  if (files.length === 0) {
    return <div className="editor-tabs empty-tabs">No open files</div>;
  }

  return (
    <div className="editor-tabs" role="tablist" aria-label="Open files">
      {files.map((file) => (
        <div
          key={file.id}
          className={`editor-tab${file.id === selectedFileId ? " active" : ""}`}
          role="tab"
          aria-selected={file.id === selectedFileId}
        >
          <button type="button" onClick={() => onSelectFile(file.id)}>
            {file.name}
          </button>
          <button
            type="button"
            className="close-tab"
            onClick={() => onCloseTab(file.id)}
            aria-label={`Close ${file.name}`}
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
