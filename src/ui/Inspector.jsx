export function Inspector({ file, jarName }) {
  return (
    <aside className="inspector" aria-label="File inspector">
      <div className="panel-heading">
        <span>Inspector</span>
      </div>

      {file ? (
        <div className="inspector-stack">
          <InfoRow label="Archive" value={jarName} />
          <InfoRow label="Type" value={file.type} />
          <InfoRow label="Size" value={file.size} />
        </div>
      ) : (
        <p className="muted-copy">Select a file to inspect metadata.</p>
      )}
    </aside>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
