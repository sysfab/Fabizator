import { useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileExport, faFileImport } from "@fortawesome/free-solid-svg-icons";

export function TopBar({ jarName, onOpenJar, onExport }) {
  const fileInputRef = useRef(null);

  function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (file) {
      onOpenJar(file);
    }

    event.target.value = "";
  }

  return (
    <header className="top-bar">
      <div className="brand-block" aria-label="Application brand">
        <div className="brand-mark">FZ</div>
        <div>
          <h1>Fabizator</h1>
          <p>Minecraft mod viewer/editor</p>
        </div>
      </div>

      <div className="jar-pill" title={jarName}>
        <span>Loaded jar</span>
        <strong>{jarName}</strong>
      </div>

      <nav className="toolbar" aria-label="Main actions">
        <input
          ref={fileInputRef}
          type="file"
          accept=".jar,application/java-archive,application/zip"
          className="visually-hidden"
          onChange={handleFileChange}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          <FontAwesomeIcon icon={faFileImport} aria-hidden="true" />
          Import
        </button>
        <button type="button" className="primary-action" onClick={onExport}>
          <FontAwesomeIcon icon={faFileExport} aria-hidden="true" />
          Export
        </button>
      </nav>
    </header>
  );
}
