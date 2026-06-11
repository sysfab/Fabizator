import { AudioPreview } from "./AudioPreview.jsx";
import { CodeEditor } from "./CodeEditor.jsx";
import { ImagePreview } from "./ImagePreview.jsx";

export function EditorPane({ file, onChangeFileContent }) {
  if (file?.isAnalyzer) {
    return (
      <div className="editor-pane analyzer-pane">
        <div className="editor-header">
          <div>
            <h2>{file.path}</h2>
          </div>
        </div>

        <div className="analyzer-grid">
          <AnalyzerCard label="Mod Name" value={file.analysis.modName} />
          <AnalyzerCard label="Mod ID" value={file.analysis.modId} />
          <AnalyzerCard label="Version" value={file.analysis.version} />
          <AnalyzerCard label="Platform" value={file.analysis.platform} />
          <AnalyzerCard label="Minecraft" value={file.analysis.minecraftVersion} />
        </div>

        <section className="requirements-panel">
          <h3>Requirements</h3>
          {file.analysis.requirements.length > 0 ? (
            <div className="requirements-list">
              {file.analysis.requirements.map((requirement) => (
                <div className="requirement-row" key={`${requirement.id}-${requirement.version}`}>
                  <strong>{requirement.id}</strong>
                  <span>{requirement.version}</span>
                  <em>{requirement.relation}</em>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-copy">No explicit requirements detected.</p>
          )}
        </section>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="editor-pane empty-state">
        <div>
          <span className="empty-kicker">No file selected</span>
          <h2>Click on the file to inspect its contents.</h2>
          <p>
            (Open .JAR first)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-pane">
      {file.previewKind === "image" || file.previewKind === "audio" ? null : (
        <div className="editor-header">
          <div>
            <h2>{file.path}</h2>
          </div>
          <span className={`edit-badge${file.editable ? " editable" : " readonly"}`}>
            {file.editable ? "Editable" : "Read-only"}
          </span>
        </div>
      )}

      {file.previewKind === "image" ? (
        <ImagePreview file={file} />
      ) : file.previewKind === "audio" ? (
        <AudioPreview file={file} />
      ) : (
        <CodeEditor file={file} onChange={onChangeFileContent} />
      )}
    </div>
  );
}

function AnalyzerCard({ label, value }) {
  return (
    <div className="analyzer-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
