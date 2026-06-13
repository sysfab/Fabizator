export function StatusBar({ notice }) {
  return (
    <footer className="status-bar">
      <span>{notice}</span>
      <a href="https://donatello.to/sysfab"><strong>Support me</strong></a>
    </footer>
  );
}
