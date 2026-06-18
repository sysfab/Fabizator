import { lazy, Suspense } from 'react';

const CodeEditor = lazy(() => import("./CodeEditor.jsx"));

import { AudioPreview } from "./AudioPreview.jsx";
import { ImagePreview } from "./ImagePreview.jsx";

export function EditorPane({ file, onChangeFileContent, onDecompile }) {
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
          <p>(Open .JAR first)</p>
        </div>
      </div>
    );
  }

  const isClassFile = file.path.toLowerCase().endsWith(".class");
  const needsDecompile = isClassFile && !file.decompiled;

  return (
    <div className="editor-pane">
      {file.previewKind === "image" ? (
        <ImagePreview file={file} />
      ) : file.previewKind === "audio" ? (
        <AudioPreview file={file} />
      ) : (
        <Suspense fallback={<div className="code-editor-shell">Loading editor...</div>}>
          <CodeEditor file={file} onChange={onChangeFileContent} />
        </Suspense>
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
