import JSZip from "jszip";

const textExtensions = new Set([
  ".json",
  ".mcmeta",
  ".toml",
  ".properties",
  ".txt",
  ".md",
  ".cfg",
  ".xml",
  ".yml",
  ".yaml",
  ".accesswidener",
  ".mixins",
]);

const maxTextPreviewBytes = 512 * 1024;

const imageMimeTypes = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
]);

const audioMimeTypes = new Map([
  [".ogg", "audio/ogg"],
  [".wav", "audio/wav"],
  [".mp3", "audio/mpeg"],
]);

export async function importJar(file) {
  if (!file) {
    return {
      ok: false,
      message: "No JAR file selected.",
    };
  }

  const zip = await JSZip.loadAsync(file);
  const zipEntries = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .sort((left, right) => left.name.localeCompare(right.name));

  if (zipEntries.length === 0) {
    return {
      ok: false,
      message: `${file.name} does not contain any files.`,
    };
  }

  const files = await Promise.all(
    zipEntries.map(async (entry) => {
      const size = entry._data?.uncompressedSize ?? 0;
      const editable = isTextFile(entry.name) && size <= maxTextPreviewBytes;
      const imageMimeType = imageMimeTypeFor(entry.name);
      const audioMimeType = audioMimeTypeFor(entry.name);
      const previewMimeType = imageMimeType ?? audioMimeType;
      const previewDataUrl = previewMimeType
        ? `data:${previewMimeType};base64,${await entry.async("base64")}`
        : null;

      return {
        id: fileIdFromPath(entry.name),
        name: entry.name.split("/").at(-1),
        path: entry.name,
        type: detectFileType(entry.name),
        size: formatBytes(size),
        editable,
        previewKind: imageMimeType ? "image" : audioMimeType ? "audio" : "code",
        previewDataUrl,
        content: editable
          ? await entry.async("string")
          : buildBinaryPlaceholder(entry.name, size),
      };
    }),
  );

  return {
    ok: true,
    jarName: file.name,
    zip,
    files,
    tree: buildTree(files),
    message: `Loaded ${file.name} with ${files.length} files.`,
  };
}

function fileIdFromPath(path) {
  return `file:${path}`;
}

function folderIdFromPath(path) {
  return `folder:${path}`;
}

function isTextFile(path) {
  const lowerPath = path.toLowerCase();

  if (lowerPath.endsWith("manifest.mf")) {
    return true;
  }

  return textExtensions.has(extensionFromPath(lowerPath));
}

function imageMimeTypeFor(path) {
  return imageMimeTypes.get(extensionFromPath(path.toLowerCase())) ?? null;
}

function audioMimeTypeFor(path) {
  return audioMimeTypes.get(extensionFromPath(path.toLowerCase())) ?? null;
}

function extensionFromPath(path) {
  const fileName = path.split("/").at(-1) ?? "";
  const extensionStart = fileName.lastIndexOf(".");

  return extensionStart >= 0 ? fileName.slice(extensionStart) : "";
}

function detectFileType(path) {
  const lowerPath = path.toLowerCase();
  const extension = extensionFromPath(lowerPath);

  if (lowerPath.endsWith("fabric.mod.json")) return "Fabric metadata";
  if (lowerPath.endsWith("mods.toml")) return "Forge metadata";
  if (lowerPath.endsWith("manifest.mf")) return "JAR manifest";
  if (lowerPath.endsWith(".mixins.json")) return "Mixin config";
  if (extension === ".json") return "JSON resource";
  if (extension === ".class") return "Compiled Java class";
  if (imageMimeTypes.has(extension)) return "Image";
  if (audioMimeTypes.has(extension)) return "Audio";
  if (isTextFile(path)) return "Text resource";

  return "Binary resource";
}

function buildTree(files) {
  const folders = new Map();
  const tree = [];

  for (const file of files) {
    const pathParts = file.path.split("/");

    pathParts.slice(0, -1).forEach((part, index) => {
      const folderPath = pathParts.slice(0, index + 1).join("/");

      if (!folders.has(folderPath)) {
        const folder = {
          id: folderIdFromPath(folderPath),
          label: part,
          depth: index,
          kind: "folder",
          path: folderPath,
        };

        folders.set(folderPath, folder);
        tree.push(folder);
      }
    });

    tree.push({
      id: file.id,
      label: file.name,
      depth: pathParts.length - 1,
      kind: "file",
      path: file.path,
    });
  }

  return tree;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function buildBinaryPlaceholder(path, size) {
  return `Binary preview is not available for ${path}.\n\nSize: ${formatBytes(size)}\n\nFabizator currently previews text-based mod resources only.`;
}
