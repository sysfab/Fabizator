import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy, faFileCirclePlus, faFileCode, faFolder, faFolderOpen, faFolderPlus, faPaste, faPenToSquare, faTrash } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";

export function Sidebar({ treeItems, selectedFileId, hasClipboardItem, onSelectFile, onAddFile, onAddFolder, onCopyItem, onPasteItem, onRenameFile, onDeleteFile, onRenameFolder, onDeleteFolder, onOpenAnalyzer }) {
  const [expandedFolders, setExpandedFolders] = useState(() => new Set());
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    setExpandedFolders(new Set());
  }, [treeItems]);

  useEffect(() => {
    if (!contextMenu) {
      return undefined;
    }

    function closeMenu() {
      setContextMenu(null);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

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

  function openContextMenu(event, item) {
    event.preventDefault();
    event.stopPropagation();

    const menuWidth = 156;
    const menuHeight = item?.kind === "folder" || !item ? 260 : 178;

    setContextMenu({
      item,
      x: Math.min(event.clientX, window.innerWidth - menuWidth - 8),
      y: Math.min(event.clientY, window.innerHeight - menuHeight - 8),
    });
  }

  function handleContextAction(action) {
    if (!contextMenu) {
      return;
    }

    const { item } = contextMenu;
    setContextMenu(null);
    action(item);
  }

  function renameActionFor(item) {
    return item.kind === "folder" ? onRenameFolder : onRenameFile;
  }

  function deleteActionFor(item) {
    return item.kind === "folder" ? onDeleteFolder : onDeleteFile;
  }

  function contextLabel() {
    return contextMenu.item ? `Actions for ${contextMenu.item.label}` : "File tree actions";
  }

  const visibleItems = treeItems.filter((item) => isVisible(item, expandedFolders));

  return (
    <aside className="sidebar" aria-label="Mod jar file tree">
      <div className="panel-heading">
        <span>File Tree</span>
        <small>.jar</small>
      </div>

      <div className="tree-list" role="tree" onContextMenu={(event) => openContextMenu(event, null)}>
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
              onContextMenu={(event) => openContextMenu(event, item)}
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

      {contextMenu ? (
        <div
          className="file-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label={contextLabel()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {contextMenu.item?.kind === "file" ? null : (
            <>
              <button type="button" role="menuitem" onClick={() => handleContextAction(onAddFile)}>
                <FontAwesomeIcon icon={faFileCirclePlus} aria-hidden="true" />
                <span>Add File</span>
              </button>
              <button type="button" role="menuitem" onClick={() => handleContextAction(onAddFolder)}>
                <FontAwesomeIcon icon={faFolderPlus} aria-hidden="true" />
                <span>Add Folder</span>
              </button>
              <div className="context-menu-separator" role="separator" />
            </>
          )}
          {contextMenu.item ? (
            <button type="button" role="menuitem" onClick={() => handleContextAction(onCopyItem)}>
              <FontAwesomeIcon icon={faCopy} aria-hidden="true" />
              <span>Copy</span>
            </button>
          ) : null}
          <button type="button" role="menuitem" disabled={!hasClipboardItem} onClick={() => handleContextAction(onPasteItem)}>
            <FontAwesomeIcon icon={faPaste} aria-hidden="true" />
            <span>Paste</span>
          </button>
          {contextMenu.item ? (
            <>
              <div className="context-menu-separator" role="separator" />
              <button type="button" role="menuitem" onClick={() => handleContextAction(renameActionFor(contextMenu.item))}>
                <FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" />
                <span>Rename</span>
              </button>
              <button type="button" role="menuitem" className="danger" onClick={() => handleContextAction(deleteActionFor(contextMenu.item))}>
                <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                <span>Delete</span>
              </button>
            </>
          ) : null}
        </div>
      ) : null}

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
