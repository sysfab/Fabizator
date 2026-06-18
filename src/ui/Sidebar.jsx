import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCode, faCopy, faDownload, faFileCirclePlus, faFileCode, faFolder, faFolderOpen, faFolderPlus, faPaste, faPenToSquare, faTrash, faUpload } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef, useState } from "react";

export function Sidebar({ treeItems, expandedFolders, selectedFileId, hasClipboardItem, hasUndecompiledClassFiles, onSelectFile, onAddFile, onAddFolder, onUploadFiles, onCopyItem, onPasteItem, onDownloadItem, onRenameFile, onDeleteFile, onRenameFolder, onDeleteFolder, onDecompileAll, onOpenAnalyzer, onExpandedFoldersChange }) {
  const [contextMenu, setContextMenu] = useState(null);
  const uploadTargetRef = useRef(null);
  const fileUploadInputRef = useRef(null);

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
    onExpandedFoldersChange((current) => {
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
    const menuHeight = item?.kind === "folder" || !item ? 342 : 218;

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

  function openUploadPicker(inputRef) {
    if (!contextMenu) {
      return;
    }

    uploadTargetRef.current = contextMenu.item;
    setContextMenu(null);
    inputRef.current?.click();
  }

  function handleUploadChange(event) {
    const files = Array.from(event.target.files ?? []);

    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    onUploadFiles(uploadTargetRef.current, files);
    uploadTargetRef.current = null;
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
              <button type="button" role="menuitem" onClick={() => openUploadPicker(fileUploadInputRef)}>
                <FontAwesomeIcon icon={faUpload} aria-hidden="true" />
                <span>Upload</span>
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
              <button type="button" role="menuitem" onClick={() => handleContextAction(onDownloadItem)}>
                <FontAwesomeIcon icon={faDownload} aria-hidden="true" />
                <span>Download</span>
              </button>
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

      <input
        ref={fileUploadInputRef}
        className="visually-hidden"
        type="file"
        multiple
        onChange={handleUploadChange}
        tabIndex={-1}
      />
      {treeItems.length > 0 ? (
        <div className="sidebar-actions">
          {hasUndecompiledClassFiles ? (
            <button
              type="button"
              className="analyzer-button"
              onClick={onDecompileAll}
            >
              <FontAwesomeIcon icon={faCode} aria-hidden="true" />
              Decompile All
            </button>
          ) : null}
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
