export async function exportJar({ jarName, files, folders = [], zip }) {
  if (!zip) {
    return {
      ok: false,
      message: "Open a JAR before exporting.",
    };
  }

  const filePaths = new Set(files.map((file) => file.path));
  const folderPaths = new Set(folders.map((folder) => `${folder}/`));

  for (const path of Object.keys(zip.files)) {
    if (!filePaths.has(path) && !folderPaths.has(path)) {
      zip.remove(path);
    }
  }

  for (const folder of folders) {
    zip.folder(folder);
  }

  for (const file of files) {
    if (file.editable) {
      zip.file(file.path, file.content);
    } else if (file.classBytes) {
      zip.file(file.path, file.classBytes);
    }
  }

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
  });

  downloadBlob(blob, outputNameFor(jarName));

  return {
    ok: true,
    message: `Exported ${outputNameFor(jarName)}.`,
  };
}

function outputNameFor(jarName) {
  if (!jarName || jarName === "No jar loaded") {
    return "fabizator-export.jar";
  }

  if (jarName.toLowerCase().endsWith(".jar")) {
    return jarName;
  }

  return `${jarName}.jar`;
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
