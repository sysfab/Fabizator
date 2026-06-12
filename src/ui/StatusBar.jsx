export function StatusBar({ notice }) {
  return (
    <footer className="status-bar">
      <span>{notice}</span>
      <strong>v1.0</strong>
    </footer>
  );
}
