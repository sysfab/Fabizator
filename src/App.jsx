import { useState } from "react";
import { analyzeMod } from "./mod/analyzer.js";
import { decompileAll } from "./mod/decompiler.js";
import { exportJar } from "./mod/exporter.js";
import { buildTree, fileIdFromPath, formatBytes, importJar } from "./mod/importer.js";
import { initialState } from "./state/initialState.js";
import { EditorPane } from "./ui/EditorPane.jsx";
import { EditorTabs } from "./ui/EditorTabs.jsx";
import { Inspector } from "./ui/Inspector.jsx";
import { Sidebar } from "./ui/Sidebar.jsx";
import { StatusBar } from "./ui/StatusBar.jsx";
import { TopBar } from "./ui/TopBar.jsx";
import { shouldShowWelcomePopup, WelcomePopup } from "./ui/WelcomePopup.jsx";

const panelLimits = {
  sidebar: { min: 160, max: 420 },
  inspector: { min: 220, max: 460 },
};

const analyzerTabBase = {
  id: "app:analyzer",
  name: "Mod Analyzer",
  path: "Mod Analyzer",
  type: "Analysis",
  isAnalyzer: true,
};

function findFile(files, fileId) {
  return files.find((file) => file.id === fileId) ?? null;
}

function sizeForContent(content) {
  return formatBytes(new TextEncoder().encode(content).length);
}

function hasEmptyPathSegment(path) {
  return path.startsWith("/") || path.endsWith("/") || path.includes("//");
}

function isInFolder(file, folderPath) {
  return file.path.startsWith(`${folderPath}/`);
}

function isFolderPathInFolder(path, folderPath) {
  return path === folderPath || path.startsWith(`${folderPath}/`);
}

function folderPathExists(files, folders, path) {
  return folders.includes(path) || files.some((file) => isInFolder(file, path));
}

function childPathFor(parentItem, name) {
  return parentItem ? `${parentItem.path}/${name}` : name;
}

function parentPathFor(path) {
  const parts = path.split("/");

  return parts.length > 1 ? parts.slice(0, -1).join("/") : null;
}

function baseNameFor(path) {
  return path.split("/").at(-1);
}

function targetFolderPathFor(item) {
  if (!item) {
    return null;
  }

  return item.kind === "folder" ? item.path : parentPathFor(item.path);
}

function joinPath(parentPath, name) {
  return parentPath ? `${parentPath}/${name}` : name;
}

function uniqueCopyName(name) {
  const extensionStart = name.lastIndexOf(".");

  if (extensionStart <= 0) {
    return `${name} copy`;
  }

  return `${name.slice(0, extensionStart)} copy${name.slice(extensionStart)}`;
}

function uniqueCopyPath(path, files, folders, isFolder = false) {
  const parentPath = parentPathFor(path);
  const name = baseNameFor(path);
  const firstCopyPath = joinPath(parentPath, uniqueCopyName(name));

  if (!pathExists(firstCopyPath, files, folders, isFolder)) {
    return firstCopyPath;
  }

  for (let index = 2; index < 1000; index += 1) {
    const numberedName = uniqueCopyName(name).replace(" copy", ` copy ${index}`);
    const numberedPath = joinPath(parentPath, numberedName);

    if (!pathExists(numberedPath, files, folders, isFolder)) {
      return numberedPath;
    }
  }

  return joinPath(parentPath, `${uniqueCopyName(name)} ${Date.now()}`);
}

function pathExists(path, files, folders, isFolder = false) {
  if (files.some((file) => file.path === path)) {
    return true;
  }

  return isFolder
    ? folderPathExists(files, folders, path)
    : folders.includes(path);
}

function createEditableFile(path) {
  return {
    id: fileIdFromPath(path),
    name: path.split("/").at(-1),
    path,
    type: "Text resource",
    size: formatBytes(0),
    editable: true,
    previewKind: "code",
    previewDataUrl: null,
    classBytes: null,
    decompiled: false,
    content: "",
  };
}

export default function App() {
  const [appState, setAppState] = useState(initialState);
  const [notice, setNotice] = useState("Ready.");
  const [panelWidths, setPanelWidths] = useState({
    sidebar: 216,
    inspector: 320,
  });
  const [treeClipboard, setTreeClipboard] = useState(null);
  const [showWelcomePopup, setShowWelcomePopup] = useState(shouldShowWelcomePopup);
  const analyzerTab = {
    ...analyzerTabBase,
    analysis: appState.analysis,
  };

  const selectedFile = findFile(appState.files, appState.selectedFileId);
  const openFiles = appState.openFileIds
    .map((fileId) => fileId === analyzerTab.id ? analyzerTab : findFile(appState.files, fileId))
    .filter(Boolean);
  const activeEditorItem = appState.selectedFileId === analyzerTab.id ? analyzerTab : selectedFile;
  const isAnalyzerOpen = appState.selectedFileId === analyzerTab.id;

  async function handleOpenJar(file) {
    setNotice(`Loading ${file.name}...`);

    try {
      const result = await importJar(file);
      if (!result.ok) {
        setNotice(result.message);
        return;
      }

      setTreeClipboard(null);
      const analysis = analyzeMod(result.files, result.jarName);
      setAppState((current) => ({
        ...current,
        jarName: result.jarName,
        selectedFileId: analyzerTab.id,
        openFileIds: [analyzerTab.id],
        files: result.files,
        folders: result.folders,
        tree: result.tree,
        zip: result.zip,
        analysis,
      }));

      const classCount = result.files.filter((f) =>
        f.path.toLowerCase().endsWith(".class")
      ).length;

      if (classCount === 0) {
        setNotice(result.message);
        return;
      }

      setNotice(`Loaded ${file.name}. Decompiling ${classCount} classes...`);

      // Run in background — do NOT await
      decompileAll(result.files, (batch, completed, total) => {
        setNotice(`Decompiling classes... ${completed} / ${total}`);
        setAppState((current) => {
          const updates = new Map(batch.map((b) => [b.id, b.source]));
          return {
            ...current,
            files: current.files.map((f) =>
              updates.has(f.id)
                ? { ...f, content: updates.get(f.id), decompiled: true }
                : f
            ),
          };
        });
      })
        .then((count) => setNotice(`${file.name} — decompiled ${count} classes.`))
        .catch((err) => setNotice(`Decompilation error: ${err.message}`));

    } catch (error) {
      setNotice(`Could not load ${file.name}: ${error.message}`);
    }
  }

  async function handleExportJar() {
    setNotice("Exporting JAR...");

    try {
      const result = await exportJar(appState);
      setNotice(result.message);
    } catch (error) {
      setNotice(`Could not export ${appState.jarName}: ${error.message}`);
    }
  }

  function handleSelectFile(fileId) {
    if (fileId === analyzerTab.id) {
      openAnalyzer();
      return;
    }

    const file = findFile(appState.files, fileId);

    if (!file) {
      return;
    }

    setAppState((current) => ({
      ...current,
      selectedFileId: fileId,
      openFileIds: current.openFileIds.includes(fileId)
        ? current.openFileIds
        : [...current.openFileIds, fileId],
    }));
  }

  function openAnalyzer() {
    setAppState((current) => ({
      ...current,
      selectedFileId: analyzerTab.id,
      openFileIds: current.openFileIds.includes(analyzerTab.id)
        ? current.openFileIds
        : [...current.openFileIds, analyzerTab.id],
    }));
  }

  function handleCloseTab(fileId) {
    setAppState((current) => {
      const openFileIds = current.openFileIds.filter((id) => id !== fileId);
      const selectedFileId =
        current.selectedFileId === fileId
          ? openFileIds.at(-1) ?? null
          : current.selectedFileId;

      return {
        ...current,
        openFileIds,
        selectedFileId,
      };
    });
  }

  function handleChangeFileContent(fileId, content) {
    setAppState((current) => {
      const files = current.files.map((file) =>
        file.id === fileId ? { ...file, content, size: sizeForContent(content) } : file,
      );

      return {
        ...current,
        files,
        analysis: analyzeMod(files, current.jarName),
      };
    });
  }

  async function handleRenameFile(treeItem) {
    const currentFile = findFile(appState.files, treeItem.id);

    if (!currentFile) {
      return;
    }

    const nextPath = window.prompt("Rename file", currentFile.path)?.trim();

    if (!nextPath || nextPath === currentFile.path) {
      return;
    }

    if (hasEmptyPathSegment(nextPath)) {
      setNotice("Paths cannot contain empty segments.");
      return;
    }

    if (appState.files.some((file) => file.path === nextPath)) {
      setNotice(`${nextPath} already exists.`);
      return;
    }

    try {
      const entry = appState.zip?.file(currentFile.path);
      const bytes = entry ? await entry.async("uint8array") : null;

      if (bytes && appState.zip) {
        appState.zip.remove(currentFile.path);
        appState.zip.file(nextPath, bytes);
      }

      const nextId = fileIdFromPath(nextPath);
      setAppState((current) => {
        const files = current.files.map((file) =>
          file.id === currentFile.id
            ? { ...file, id: nextId, name: nextPath.split("/").at(-1), path: nextPath }
            : file,
        );

        return {
          ...current,
          selectedFileId: current.selectedFileId === currentFile.id ? nextId : current.selectedFileId,
          openFileIds: current.openFileIds.map((fileId) => fileId === currentFile.id ? nextId : fileId),
          files,
          tree: buildTree(files, current.folders),
          analysis: analyzeMod(files, current.jarName),
        };
      });
      setNotice(`Renamed ${currentFile.path} to ${nextPath}.`);
    } catch (error) {
      setNotice(`Could not rename ${currentFile.path}: ${error.message}`);
    }
  }

  function handleDeleteFile(treeItem) {
    const currentFile = findFile(appState.files, treeItem.id);

    if (!currentFile || !window.confirm(`Delete ${currentFile.path}?`)) {
      return;
    }

    appState.zip?.remove(currentFile.path);
    setAppState((current) => {
      const files = current.files.filter((file) => file.id !== currentFile.id);
      const openFileIds = current.openFileIds.filter((fileId) => fileId !== currentFile.id);
      const selectedFileId = current.selectedFileId === currentFile.id
        ? openFileIds.at(-1) ?? null
        : current.selectedFileId;

      return {
        ...current,
        selectedFileId,
        openFileIds,
        files,
        tree: buildTree(files, current.folders),
        analysis: analyzeMod(files, current.jarName),
      };
    });
    setNotice(`Deleted ${currentFile.path}.`);
  }

  async function handleRenameFolder(treeItem) {
    const currentFolderPath = treeItem.path;
    const nextFolderPath = window.prompt("Rename folder", currentFolderPath)?.trim();

    if (!nextFolderPath || nextFolderPath === currentFolderPath) {
      return;
    }

    if (hasEmptyPathSegment(nextFolderPath)) {
      setNotice("Paths cannot contain empty segments.");
      return;
    }

    if (nextFolderPath.startsWith(`${currentFolderPath}/`)) {
      setNotice("A folder cannot be moved inside itself.");
      return;
    }

    const folderFiles = appState.files.filter((file) => isInFolder(file, currentFolderPath));
    const folderFileIds = new Set(folderFiles.map((file) => file.id));
    const folderPaths = appState.folders.filter((folder) => isFolderPathInFolder(folder, currentFolderPath));
    const nextPaths = new Map(
      folderFiles.map((file) => [file.path, `${nextFolderPath}${file.path.slice(currentFolderPath.length)}`]),
    );
    const nextFolders = new Map(
      folderPaths.map((folder) => [folder, `${nextFolderPath}${folder.slice(currentFolderPath.length)}`]),
    );
    const existingPaths = new Set(
      appState.files
        .filter((file) => !folderFileIds.has(file.id))
        .map((file) => file.path),
    );
    const existingFolders = appState.folders.filter((folder) => !folderPaths.includes(folder));
    const conflictPath = [...nextPaths.values()].find((path) => existingPaths.has(path));
    const conflictFolder = [...nextFolders.values()].find((path) => folderPathExists(appState.files.filter((file) => !folderFileIds.has(file.id)), existingFolders, path));

    if (conflictPath || conflictFolder) {
      setNotice(`${conflictPath ?? conflictFolder} already exists.`);
      return;
    }

    try {
      const zipEntries = await Promise.all(
        folderFiles.map(async (file) => {
          const entry = appState.zip?.file(file.path);
          return {
            oldPath: file.path,
            nextPath: nextPaths.get(file.path),
            bytes: entry ? await entry.async("uint8array") : null,
          };
        }),
      );

      if (appState.zip) {
        for (const folder of folderPaths) {
          appState.zip.remove(`${folder}/`);
        }

        for (const entry of zipEntries) {
          appState.zip.remove(entry.oldPath);
          if (entry.bytes) {
            appState.zip.file(entry.nextPath, entry.bytes);
          }
        }

        for (const folder of nextFolders.values()) {
          appState.zip.folder(folder);
        }
      }

      const nextIds = new Map(folderFiles.map((file) => [file.id, fileIdFromPath(nextPaths.get(file.path))]));

      setAppState((current) => {
        const files = current.files.map((file) => {
          const nextPath = nextPaths.get(file.path);

          return nextPath
            ? { ...file, id: fileIdFromPath(nextPath), name: nextPath.split("/").at(-1), path: nextPath }
            : file;
        });
        const folders = current.folders.map((folder) => nextFolders.get(folder) ?? folder);

        return {
          ...current,
          selectedFileId: nextIds.get(current.selectedFileId) ?? current.selectedFileId,
          openFileIds: current.openFileIds.map((fileId) => nextIds.get(fileId) ?? fileId),
          files,
          folders,
          tree: buildTree(files, folders),
          analysis: analyzeMod(files, current.jarName),
        };
      });
      setNotice(`Renamed ${currentFolderPath} to ${nextFolderPath}.`);
    } catch (error) {
      setNotice(`Could not rename ${currentFolderPath}: ${error.message}`);
    }
  }

  function handleDeleteFolder(treeItem) {
    const folderPath = treeItem.path;
    const folderFiles = appState.files.filter((file) => isInFolder(file, folderPath));
    const folderPaths = appState.folders.filter((folder) => isFolderPathInFolder(folder, folderPath));

    if (!window.confirm(`Delete ${folderPath} and ${folderFiles.length} file(s)?`)) {
      return;
    }

    for (const file of folderFiles) {
      appState.zip?.remove(file.path);
    }

    for (const folder of folderPaths) {
      appState.zip?.remove(`${folder}/`);
    }

    const deletedFileIds = new Set(folderFiles.map((file) => file.id));
    setAppState((current) => {
      const files = current.files.filter((file) => !deletedFileIds.has(file.id));
      const folders = current.folders.filter((folder) => !isFolderPathInFolder(folder, folderPath));
      const openFileIds = current.openFileIds.filter((fileId) => !deletedFileIds.has(fileId));
      const selectedFileId = deletedFileIds.has(current.selectedFileId)
        ? openFileIds.at(-1) ?? null
        : current.selectedFileId;

      return {
        ...current,
        selectedFileId,
        openFileIds,
        files,
        folders,
        tree: buildTree(files, folders),
        analysis: analyzeMod(files, current.jarName),
      };
    });
    setNotice(`Deleted ${folderPath}.`);
  }

  function handleAddFile(parentItem) {
    if (!appState.zip) {
      setNotice("Open a JAR before adding files.");
      return;
    }

    const defaultPath = childPathFor(parentItem, "new-file.txt");
    const nextPath = window.prompt("Add file", defaultPath)?.trim();

    if (!nextPath) {
      return;
    }

    if (hasEmptyPathSegment(nextPath)) {
      setNotice("Paths cannot contain empty segments.");
      return;
    }

    if (appState.files.some((file) => file.path === nextPath) || folderPathExists(appState.files, appState.folders, nextPath)) {
      setNotice(`${nextPath} already exists.`);
      return;
    }

    appState.zip.file(nextPath, "");
    const nextFile = createEditableFile(nextPath);
    setAppState((current) => {
      const files = [...current.files, nextFile];
      return {
        ...current,
        selectedFileId: nextFile.id,
        openFileIds: current.openFileIds.includes(nextFile.id)
          ? current.openFileIds
          : [...current.openFileIds, nextFile.id],
        files,
        tree: buildTree(files, current.folders),
        analysis: analyzeMod(files, current.jarName),
      };
    });
    setNotice(`Added ${nextPath}.`);
  }

  function handleAddFolder(parentItem) {
    if (!appState.zip) {
      setNotice("Open a JAR before adding folders.");
      return;
    }

    const folderPath = window.prompt("Add folder", childPathFor(parentItem, "new-folder"))?.trim();

    if (!folderPath) {
      return;
    }

    if (hasEmptyPathSegment(folderPath)) {
      setNotice("Paths cannot contain empty segments.");
      return;
    }

    if (appState.files.some((file) => file.path === folderPath) || folderPathExists(appState.files, appState.folders, folderPath)) {
      setNotice(`${folderPath} already exists.`);
      return;
    }

    appState.zip.folder(folderPath);
    setAppState((current) => {
      const folders = [...current.folders, folderPath];
      return {
        ...current,
        folders,
        tree: buildTree(current.files, folders),
      };
    });
    setNotice(`Added ${folderPath}.`);
  }

  function handleCopyItem(treeItem) {
    if (!treeItem) {
      return;
    }

    setTreeClipboard({ kind: treeItem.kind, path: treeItem.path });
    setNotice(`Copied ${treeItem.path}.`);
  }

  async function handlePasteItem(targetItem) {
    if (!treeClipboard) {
      return;
    }

    if (treeClipboard.kind === "file") {
      await pasteFile(targetItem, treeClipboard.path);
      return;
    }

    await pasteFolder(targetItem, treeClipboard.path);
  }

  async function pasteFile(targetItem, sourcePath) {
    const sourceFile = appState.files.find((file) => file.path === sourcePath);

    if (!sourceFile) {
      setNotice(`${sourcePath} no longer exists.`);
      setTreeClipboard(null);
      return;
    }

    const targetFolderPath = targetFolderPathFor(targetItem);
    const targetPath = uniqueCopyPath(
      joinPath(targetFolderPath, baseNameFor(sourceFile.path)),
      appState.files,
      appState.folders,
    );

    try {
      const entry = appState.zip?.file(sourceFile.path);
      const bytes = entry ? await entry.async("uint8array") : null;

      if (appState.zip) {
        appState.zip.file(targetPath, bytes ?? sourceFile.content ?? "");
      }

      const nextFile = {
        ...sourceFile,
        id: fileIdFromPath(targetPath),
        name: baseNameFor(targetPath),
        path: targetPath,
      };

      setAppState((current) => {
        const files = [...current.files, nextFile];

        return {
          ...current,
          selectedFileId: nextFile.id,
          openFileIds: [...current.openFileIds, nextFile.id],
          files,
          tree: buildTree(files, current.folders),
          analysis: analyzeMod(files, current.jarName),
        };
      });
      setNotice(`Pasted ${targetPath}.`);
    } catch (error) {
      setNotice(`Could not paste ${sourceFile.path}: ${error.message}`);
    }
  }

  async function pasteFolder(targetItem, sourceFolderPath) {
    const sourceFiles = appState.files.filter((file) => isInFolder(file, sourceFolderPath));
    const sourceFolders = appState.folders.filter((folder) => isFolderPathInFolder(folder, sourceFolderPath));

    if (sourceFiles.length === 0 && sourceFolders.length === 0 && !folderPathExists(appState.files, appState.folders, sourceFolderPath)) {
      setNotice(`${sourceFolderPath} no longer exists.`);
      setTreeClipboard(null);
      return;
    }

    const targetFolderPath = targetFolderPathFor(targetItem);
    const targetRootPath = uniqueCopyPath(
      joinPath(targetFolderPath, baseNameFor(sourceFolderPath)),
      appState.files,
      appState.folders,
      true,
    );
    const mappedFolderPaths = new Set([targetRootPath]);

    for (const folder of sourceFolders) {
      mappedFolderPaths.add(`${targetRootPath}${folder.slice(sourceFolderPath.length)}`);
    }

    try {
      const copiedFiles = await Promise.all(
        sourceFiles.map(async (file) => {
          const targetPath = `${targetRootPath}${file.path.slice(sourceFolderPath.length)}`;
          const entry = appState.zip?.file(file.path);

          return {
            file: {
              ...file,
              id: fileIdFromPath(targetPath),
              name: baseNameFor(targetPath),
              path: targetPath,
            },
            bytes: entry ? await entry.async("uint8array") : null,
          };
        }),
      );

      if (appState.zip) {
        for (const folder of mappedFolderPaths) {
          appState.zip.folder(folder);
        }

        for (const copiedFile of copiedFiles) {
          appState.zip.file(copiedFile.file.path, copiedFile.bytes ?? copiedFile.file.content ?? "");
        }
      }

      setAppState((current) => {
        const files = [...current.files, ...copiedFiles.map((copiedFile) => copiedFile.file)];
        const existingFolders = new Set(current.folders);
        const folders = [
          ...current.folders,
          ...[...mappedFolderPaths].filter((folder) => !existingFolders.has(folder)),
        ];

        return {
          ...current,
          files,
          folders,
          tree: buildTree(files, folders),
          analysis: analyzeMod(files, current.jarName),
        };
      });
      setNotice(`Pasted ${targetRootPath}.`);
    } catch (error) {
      setNotice(`Could not paste ${sourceFolderPath}: ${error.message}`);
    }
  }

  function startPanelResize(panelName, event) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = panelWidths[panelName];
    const direction = panelName === "sidebar" ? 1 : -1;

    function handlePointerMove(moveEvent) {
      const nextWidth = startWidth + (moveEvent.clientX - startX) * direction;
      const limits = panelLimits[panelName];
      const clampedWidth = Math.min(
        limits.max,
        Math.max(limits.min, nextWidth),
      );

      setPanelWidths((current) => ({
        ...current,
        [panelName]: clampedWidth,
      }));
    }

    function stopResize() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      document.body.classList.remove("is-resizing-panels");
    }

    document.body.classList.add("is-resizing-panels");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize, { once: true });
  }

  return (
    <div className="app-shell">
      <TopBar
        jarName={appState.jarName}
        onOpenJar={handleOpenJar}
        onExport={handleExportJar}
      />

      <main
        className={`workspace${isAnalyzerOpen ? " analyzer-workspace" : ""}`}
        aria-label="Fabizator workspace"
        style={{
          "--sidebar-width": `${panelWidths.sidebar}px`,
          "--inspector-width": isAnalyzerOpen ? "0px" : `${panelWidths.inspector}px`,
        }}
      >
        <Sidebar
          treeItems={appState.tree}
          selectedFileId={appState.selectedFileId}
          hasClipboardItem={Boolean(treeClipboard)}
          onSelectFile={handleSelectFile}
          onAddFile={handleAddFile}
          onAddFolder={handleAddFolder}
          onCopyItem={handleCopyItem}
          onPasteItem={handlePasteItem}
          onRenameFile={handleRenameFile}
          onDeleteFile={handleDeleteFile}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onOpenAnalyzer={openAnalyzer}
        />

        <button
          type="button"
          className="resize-handle left-handle"
          onPointerDown={(event) => startPanelResize("sidebar", event)}
          aria-label="Resize archive tree panel"
        />

        <section className="editor-region" aria-label="Editor area">
          <EditorTabs
            files={openFiles}
            selectedFileId={appState.selectedFileId}
            onSelectFile={handleSelectFile}
            onCloseTab={handleCloseTab}
          />
          <EditorPane
            file={activeEditorItem}
            onChangeFileContent={handleChangeFileContent}
          />
        </section>

        {isAnalyzerOpen ? null : (
          <>
            <button
              type="button"
              className="resize-handle right-handle"
              onPointerDown={(event) => startPanelResize("inspector", event)}
              aria-label="Resize inspector panel"
            />

            <Inspector file={selectedFile} jarName={appState.jarName} />
          </>
        )}
      </main>

      <StatusBar
        notice={notice}
      />

      {showWelcomePopup ? (
        <WelcomePopup onClose={() => setShowWelcomePopup(false)} />
      ) : null}
    </div>
  );
}
