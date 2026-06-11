export function StatusBar({ jarName, selectedFile, notice }) {
  return (
    <footer className="status-bar">
      <span>{jarName}</span>
      <span>{selectedFile ? selectedFile.path : "No file selected"}</span>
      <span>{notice}</span>
      <strong>v1.0</strong>
    </footer>
  );
}
