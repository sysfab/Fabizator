import { useState } from "react";
import { analyzeMod } from "./mod/analyzer.js";
import { decompileAll } from "./mod/decompiler.js";
import { exportJar } from "./mod/exporter.js";
import { formatBytes, importJar } from "./mod/importer.js";
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

export default function App() {
  const [appState, setAppState] = useState(initialState);
  const [notice, setNotice] = useState("Ready.");
  const [panelWidths, setPanelWidths] = useState({
    sidebar: 216,
    inspector: 320,
  });
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

      const analysis = analyzeMod(result.files, result.jarName);
      setAppState((current) => ({
        ...current,
        jarName: result.jarName,
        selectedFileId: analyzerTab.id,
        openFileIds: [analyzerTab.id],
        files: result.files,
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
          onSelectFile={handleSelectFile}
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
