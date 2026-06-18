import JSZip from "jszip";

const maxTextPreviewBytes = 512 * 1024;
const strictUtf8Decoder = new TextDecoder("utf-8", { fatal: true });

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
  const folders = Object.values(zip.files)
    .filter((entry) => entry.dir)
    .map((entry) => entry.name.replace(/\/$/, ""))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  const zipEntries = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .sort((left, right) => left.name.localeCompare(right.name));

  if (zipEntries.length === 0 && folders.length === 0) {
    return {
      ok: false,
      message: `${file.name} does not contain any files or folders.`,
    };
  }

  const files = await Promise.all(
    zipEntries.map(async (entry) => {
      const size = entry._data?.uncompressedSize ?? 0;
      const bytes = await entry.async("uint8array");

      return fileFromBytes(entry.name, bytes, size);
    }),
  );

  return {
    ok: true,
    jarName: file.name,
    zip,
    files,
    folders,
    tree: buildTree(files, folders),
    message: `Loaded ${file.name} with ${files.length} files and ${folders.length} folders.`,
  };
}

export function fileIdFromPath(path) {
  return `file:${path}`;
}

export function folderIdFromPath(path) {
  return `folder:${path}`;
}

export function fileFromBytes(path, bytes, size = bytes.byteLength) {
  const imageMimeType = imageMimeTypeFor(path);
  const audioMimeType = audioMimeTypeFor(path);
  const previewMimeType = imageMimeType ?? audioMimeType;
  const isClassFile = path.toLowerCase().endsWith(".class");
  const isText = isTextFile(bytes);
  const editable = isText && size <= maxTextPreviewBytes;
  const classBytes = isClassFile ? bytes : null;

  return {
    id: fileIdFromPath(path),
    name: path.split("/").at(-1),
    path,
    type: detectFileType(path, isText),
    size: formatBytes(size),
    editable,
    previewKind: imageMimeType ? "image" : audioMimeType ? "audio" : "code",
    previewDataUrl: previewMimeType ? `data:${previewMimeType};base64,${bytesToBase64(bytes)}` : null,
    classBytes,
    decompiled: false,
    content: isClassFile
      ? "// Decompiling..."
      : editable
        ? strictUtf8Decoder.decode(bytes)
        : buildBinaryPlaceholder(path, size),
  };
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function isTextFile(bytes) {
  try {
    const text = strictUtf8Decoder.decode(bytes);

    return !/[\x00-\x08\x0E-\x1F\x7F]/.test(text);
  } catch {
    return false;
  }
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

function detectFileType(path, isText) {
  const lowerPath = path.toLowerCase();
  const extension = extensionFromPath(lowerPath);

  if (extension === ".class") return "Compiled Java class";
  if (imageMimeTypes.has(extension)) return "Image";
  if (audioMimeTypes.has(extension)) return "Audio";
  if (!isText) return "Binary resource";

  if (lowerPath.endsWith("fabric.mod.json")) return "Fabric metadata";
  if (lowerPath.endsWith("mods.toml")) return "Forge metadata";
  if (lowerPath.endsWith("manifest.mf")) return "JAR manifest";
  if (lowerPath.endsWith(".mixins.json")) return "Mixin config";
  if (extension === ".json") return "JSON resource";
  if (extension === ".json") return "Localization file";
  return "Text resource";
}

export function buildTree(files, folderPaths = []) {
  const folders = new Map();
  const tree = [];

  function addFolderPath(path) {
    const pathParts = path.split("/");

    pathParts.forEach((part, index) => {
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
  }

  for (const folderPath of folderPaths) {
    addFolderPath(folderPath);
  }

  for (const file of files) {
    const pathParts = file.path.split("/");
    const folderPath = pathParts.slice(0, -1).join("/");

    if (folderPath) {
      addFolderPath(folderPath);
    }

    tree.push({
      id: file.id,
      label: file.name,
      depth: pathParts.length - 1,
      kind: "file",
      path: file.path,
    });
  }

  return tree.sort(compareTreeItems);
}

function compareTreeItems(left, right) {
  const leftParts = left.path.split("/");
  const rightParts = right.path.split("/");
  const sharedDepth = Math.min(leftParts.length, rightParts.length);

  for (let index = 0; index < sharedDepth; index += 1) {
    if (leftParts[index] === rightParts[index]) {
      continue;
    }

    const leftKind = kindAtDepth(left, index, leftParts);
    const rightKind = kindAtDepth(right, index, rightParts);

    if (leftKind !== rightKind) {
      return leftKind === "folder" ? -1 : 1;
    }

    return leftParts[index].localeCompare(rightParts[index]);
  }

  return leftParts.length - rightParts.length;
}

function kindAtDepth(item, depth, pathParts) {
  return depth < pathParts.length - 1 ? "folder" : item.kind;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function buildBinaryPlaceholder(path, size) {
  return `Binary preview is not available for ${path}.\nSize: ${formatBytes(size)}`;
}
