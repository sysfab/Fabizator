import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileCode, faFolder, faFolderOpen } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";

export function Sidebar({ treeItems, selectedFileId, onSelectFile, onOpenAnalyzer }) {
  const [expandedFolders, setExpandedFolders] = useState(() => new Set());

  useEffect(() => {
    setExpandedFolders(new Set());
  }, [treeItems]);

  function toggleFolder(path) {
    setExpandedFolders((current) => {
      const next = new Set(current);

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return next;
    });
  }

  const visibleItems = treeItems.filter((item) => isVisible(item, expandedFolders));

  return (
    <aside className="sidebar" aria-label="Mod jar file tree">
      <div className="panel-heading">
        <span>File Tree</span>
        <small>.jar</small>
      </div>

      <div className="tree-list" role="tree">
        {visibleItems.length === 0 ? (
          <p className="tree-empty">Open a JAR to inspect its files.</p>
        ) : null}

        {visibleItems.map((item) => {
          const isFile = item.kind === "file";
          const isFolder = item.kind === "folder";
          const isSelected = item.id === selectedFileId;
          const isExpanded = isFolder && expandedFolders.has(item.path);

          return (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              className={`tree-item ${item.kind}${isSelected ? " selected" : ""}`}
              style={{ "--depth": item.depth }}
              onClick={() => isFile ? onSelectFile(item.id) : toggleFolder(item.path)}
              role="treeitem"
              aria-selected={isSelected}
              aria-expanded={isFolder ? isExpanded : undefined}
            >
              <span className="tree-icon" aria-hidden="true">
                <FontAwesomeIcon icon={isFile ? faFileCode : isExpanded ? faFolderOpen : faFolder} />
              </span>
              <span className="tree-label">{item.label}</span>
            </button>
          );
        })}
      </div>

      {treeItems.length > 0 ? (
        <div className="sidebar-actions">
          <button
            type="button"
            className={`analyzer-button${selectedFileId === "app:analyzer" ? " active" : ""}`}
            onClick={onOpenAnalyzer}
          >
            Analyzer
          </button>
        </div>
      ) : null}
    </aside>
  );
}

function isVisible(item, expandedFolders) {
  const pathParts = item.path.split("/");
  const ancestorParts = item.kind === "folder" ? pathParts.slice(0, -1) : pathParts.slice(0, -1);

  for (let index = 0; index < ancestorParts.length; index += 1) {
    const ancestorPath = ancestorParts.slice(0, index + 1).join("/");

    if (!expandedFolders.has(ancestorPath)) {
      return false;
    }
  }

  return true;
}
