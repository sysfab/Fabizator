import { useEffect, useState } from "react";
import JSZip from "jszip";
import { analyzeMod } from "./mod/analyzer.js";
import { decompileAll, decompileFile } from "./mod/decompiler.js";
import { downloadBlob, exportJar } from "./mod/exporter.js";
import { buildTree, fileFromBytes, fileIdFromPath, formatBytes, importJar } from "./mod/importer.js";
import { initialState } from "./state/initialState.js";
import { EditorPane } from "./ui/EditorPane.jsx";
import { EditorTabs } from "./ui/EditorTabs.jsx";
import { ExportPopup } from "./ui/ExportPopup.jsx";
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

async function bytesForFile(zip, file) {
  const entry = zip?.file(file.path);

  if (file.editable) {
    return file.content;
  }

  if (entry) {
    return entry.async("uint8array");
  }

  return file.classBytes ?? file.content ?? "";
}

export default function App() {
  const [appState, setAppState] = useState(initialState);
  const [notice, setNotice] = useState("Ready.");
  const [panelWidths, setPanelWidths] = useState({
    sidebar: 216,
    inspector: 320,
  });
  const [treeClipboard, setTreeClipboard] = useState(null);
  const [expandedTreeFolders, setExpandedTreeFolders] = useState(() => new Set());
  const [showExportPopup, setShowExportPopup] = useState(false);
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
  const hasUndecompiledClassFiles = appState.files.some((file) =>
    file.path.toLowerCase().endsWith(".class") && !file.decompiled && !file.decompiling
  );

  useEffect(() => {
    if (selectedFile) {
      void decompileOpenedFile(selectedFile, appState.files);
    }
  }, [selectedFile, appState.files]);

  async function handleOpenJar(file) {
    setNotice(`Loading ${file.name}...`);

    try {
      const result = await importJar(file);
      if (!result.ok) {
        setNotice(result.message);
        return;
      }

      setTreeClipboard(null);
      setExpandedTreeFolders(new Set());
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

      setNotice(result.message);
    } catch (error) {
      setNotice(`Could not load ${file.name}: ${error.message}`);
    }
  }

  async function decompileOpenedFile(file, files) {
    if (!file.path.toLowerCase().endsWith(".class") || file.decompiled || file.decompiling) {
      return;
    }

    setNotice(`Decompiling ${file.name}...`);
    setAppState((current) => ({
      ...current,
      files: current.files.map((currentFile) =>
        currentFile.id === file.id && currentFile.classBytes === file.classBytes
          ? { ...currentFile, content: "// Decompiling...", decompiling: true }
          : currentFile
      ),
    }));

    try {
      const source = await decompileFile(file, files);

      setAppState((current) => ({
        ...current,
        files: current.files.map((currentFile) =>
          currentFile.id === file.id && currentFile.classBytes === file.classBytes
            ? { ...currentFile, content: source, decompiled: true, decompiling: false }
            : currentFile
        ),
      }));
      setNotice(`Decompiled ${file.name}.`);
    } catch (error) {
      setAppState((current) => ({
        ...current,
        files: current.files.map((currentFile) =>
          currentFile.id === file.id && currentFile.classBytes === file.classBytes
            ? { ...currentFile, decompiling: false }
            : currentFile
        ),
      }));
      setNotice(`Could not decompile ${file.name}: ${error.message}`);
    }
  }

  async function handleDecompileAll() {
    const pendingFileIds = appState.files
      .filter((file) => file.path.toLowerCase().endsWith(".class") && !file.decompiled && !file.decompiling)
      .map((file) => file.id);

    if (pendingFileIds.length === 0) {
      return;
    }

    const pendingFileIdSet = new Set(pendingFileIds);
    setNotice(`Decompiling ${pendingFileIds.length} class files...`);
    setAppState((current) => ({
      ...current,
      files: current.files.map((file) =>
        pendingFileIdSet.has(file.id)
          ? { ...file, content: "// Decompiling...", decompiling: true }
          : file
      ),
    }));

    try {
      await decompileAll(appState.files, (batch, completed, total) => {
        setAppState((current) => {
          const sources = new Map(batch.map((item) => [item.id, item.source]));

          return {
            ...current,
            files: current.files.map((file) =>
              sources.has(file.id)
                ? { ...file, content: sources.get(file.id), decompiled: true, decompiling: false }
                : file
            ),
          };
        });
        setNotice(`Decompiled ${completed} of ${total} class files...`);
      });

      setNotice(`Decompiled ${pendingFileIds.length} class files.`);
    } catch (error) {
      setAppState((current) => ({
        ...current,
        files: current.files.map((file) =>
          pendingFileIdSet.has(file.id) ? { ...file, decompiling: false } : file
        ),
      }));
      setNotice(`Could not decompile all class files: ${error.message}`);
    }
  }

  async function handleExportJar() {
    setNotice("Exporting JAR...");
    setShowExportPopup(false);

    try {
      const result = await exportJar(appState);
      setNotice(result.message);

      if (result.ok) {
        setShowExportPopup(true);
      }
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

    const currentFileName = baseNameFor(currentFile.path);
    const nextName = window.prompt("Rename file", currentFileName)?.trim();

    if (!nextName || nextName === currentFileName) {
      return;
    }

    if (nextName.includes("/") || nextName.includes("\\")) {
      setNotice("File names cannot contain path separators.");
      return;
    }

    const nextPath = joinPath(parentPathFor(currentFile.path), nextName);

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
      const classExtensionChanged =
        currentFile.path.toLowerCase().endsWith(".class") !== nextPath.toLowerCase().endsWith(".class");
      setAppState((current) => {
        const files = current.files.map((file) =>
          file.id === currentFile.id
            ? {
                ...file,
                id: nextId,
                name: nextPath.split("/").at(-1),
                path: nextPath,
                decompiled: classExtensionChanged ? false : file.decompiled,
                decompiling: classExtensionChanged ? false : file.decompiling,
              }
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
    const currentFolderName = baseNameFor(currentFolderPath);
    const nextFolderName = window.prompt("Rename folder", currentFolderName)?.trim();

    if (!nextFolderName || nextFolderName === currentFolderName) {
      return;
    }

    if (nextFolderName.includes("/") || nextFolderName.includes("\\")) {
      setNotice("Folder names cannot contain path separators.");
      return;
    }

    const nextFolderPath = joinPath(parentPathFor(currentFolderPath), nextFolderName);

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
      setExpandedTreeFolders((current) => {
        const next = new Set();

        for (const folderPath of current) {
          next.add(
            isFolderPathInFolder(folderPath, currentFolderPath)
              ? `${nextFolderPath}${folderPath.slice(currentFolderPath.length)}`
              : folderPath,
          );
        }

        return next;
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

  async function handleUploadFiles(parentItem, uploadedFiles) {
    if (!appState.zip) {
      setNotice("Open a JAR before uploading files.");
      return;
    }

    const targetFolderPath = targetFolderPathFor(parentItem);
    const files = [];

    try {
      for (const uploadedFile of uploadedFiles) {
        const relativePath = uploadedFile.webkitRelativePath || uploadedFile.name;
        const basePath = joinPath(targetFolderPath, relativePath);

        if (hasEmptyPathSegment(basePath)) {
          setNotice(`Skipped ${basePath}: paths cannot contain empty segments.`);
          continue;
        }

        const path = uniqueCopyPath(basePath, [...appState.files, ...files], appState.folders);
        const bytes = new Uint8Array(await uploadedFile.arrayBuffer());
        const file = fileFromBytes(path, bytes, uploadedFile.size);

        appState.zip.file(path, bytes);
        files.push(file);
      }

      if (files.length === 0) {
        return;
      }

      setAppState((current) => {
        const mergedFiles = [...current.files, ...files];

        return {
          ...current,
          selectedFileId: files.at(-1).id,
          openFileIds: [...current.openFileIds, files.at(-1).id],
          files: mergedFiles,
          tree: buildTree(mergedFiles, current.folders),
          analysis: analyzeMod(mergedFiles, current.jarName),
        };
      });
      setNotice(`Uploaded ${files.length} file(s).`);
    } catch (error) {
      setNotice(`Could not upload files: ${error.message}`);
    }
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

  async function handleDownloadItem(treeItem) {
    if (!treeItem) {
      return;
    }

    if (treeItem.kind === "file") {
      await downloadFile(treeItem);
      return;
    }

    await downloadFolder(treeItem);
  }

  async function downloadFile(treeItem) {
    const file = findFile(appState.files, treeItem.id);

    if (!file) {
      return;
    }

    try {
      downloadBlob(new Blob([await bytesForFile(appState.zip, file)]), file.name);
      setNotice(`Downloaded ${file.path}.`);
    } catch (error) {
      setNotice(`Could not download ${file.path}: ${error.message}`);
    }
  }

  async function downloadFolder(treeItem) {
    const folderPath = treeItem.path;
    const folderName = baseNameFor(folderPath);
    const zip = new JSZip();
    const folderFiles = appState.files.filter((file) => isInFolder(file, folderPath));
    const folderPaths = appState.folders.filter((folder) => isFolderPathInFolder(folder, folderPath));

    try {
      zip.folder(folderName);

      for (const folder of folderPaths) {
        zip.folder(`${folderName}${folder.slice(folderPath.length)}`);
      }

      for (const file of folderFiles) {
        zip.file(`${folderName}${file.path.slice(folderPath.length)}`, await bytesForFile(appState.zip, file));
      }

      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
      });

      downloadBlob(blob, `${folderName}.zip`);
      setNotice(`Downloaded ${folderPath}.`);
    } catch (error) {
      setNotice(`Could not download ${folderPath}: ${error.message}`);
    }
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
          expandedFolders={expandedTreeFolders}
          selectedFileId={appState.selectedFileId}
          hasClipboardItem={Boolean(treeClipboard)}
          hasUndecompiledClassFiles={hasUndecompiledClassFiles}
          onSelectFile={handleSelectFile}
          onAddFile={handleAddFile}
          onAddFolder={handleAddFolder}
          onUploadFiles={handleUploadFiles}
          onCopyItem={handleCopyItem}
          onPasteItem={handlePasteItem}
          onDownloadItem={handleDownloadItem}
          onRenameFile={handleRenameFile}
          onDeleteFile={handleDeleteFile}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onDecompileAll={handleDecompileAll}
          onOpenAnalyzer={openAnalyzer}
          onExpandedFoldersChange={setExpandedTreeFolders}
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
            jarLoaded={Boolean(appState.zip)}
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

      {showExportPopup ? (
        <ExportPopup onClose={() => setShowExportPopup(false)} />
      ) : null}
    </div>
  );
}
