const unknownAnalysis = {
  modName: "Unknown",
  modId: "unknown",
  version: "Unknown",
  platform: "Unknown",
  minecraftVersion: "Unknown",
  mixins: 0,
  assets: 0,
  dataPacks: 0,
  requirements: [],
};

export function analyzeMod(files, jarName) {
  const analysis = {
    ...unknownAnalysis,
    modName: jarName?.replace(/\.jar$/i, "") || unknownAnalysis.modName,
  };

  const fabricMetadata = findFile(files, "fabric.mod.json");
  const quiltMetadata = findFile(files, "quilt.mod.json");
  const forgeMetadata = findFile(files, "META-INF/mods.toml");
  const neoForgeMetadata = findFile(files, "META-INF/neoforge.mods.toml");

  if (fabricMetadata) {
    applyJsonMetadata(analysis, fabricMetadata.content, "Fabric");
  } else if (quiltMetadata) {
    applyQuiltMetadata(analysis, quiltMetadata.content);
  } else if (neoForgeMetadata) {
    applyTomlMetadata(analysis, neoForgeMetadata.content, "NeoForge");
  } else if (forgeMetadata) {
    applyTomlMetadata(analysis, forgeMetadata.content, detectForgePlatform(forgeMetadata.content));
  } else if (hasFile(files, "mcmod.info")) {
    analysis.platform = "Legacy Forge";
  } else if (hasFile(files, "litemod.json")) {
    analysis.platform = "LiteLoader";
  }

  analysis.mixins = countByPath(files, ".mixins.json");
  analysis.assets = countWithPrefix(files, "assets/");
  analysis.dataPacks = countWithPrefix(files, "data/");

  return analysis;
}

function findFile(files, path) {
  return files.find((file) => file.path.toLowerCase() === path.toLowerCase()) ?? null;
}

function hasFile(files, path) {
  return Boolean(findFile(files, path));
}

function applyJsonMetadata(analysis, content, platform) {
  try {
    const metadata = JSON.parse(content);

    analysis.platform = platform;
    analysis.modName = metadata.name ?? analysis.modName;
    analysis.modId = metadata.id ?? analysis.modId;
    analysis.version = metadata.version ?? analysis.version;
    analysis.minecraftVersion = dependencyVersion(metadata.depends?.minecraft)
      ?? inferMinecraftVersion(metadata.version)
      ?? analysis.minecraftVersion;
    analysis.requirements = requirementsFromDependencyObject(metadata.depends, "Required");
  } catch {
    analysis.platform = platform;
  }
}

function applyQuiltMetadata(analysis, content) {
  try {
    const metadata = JSON.parse(content);
    const quiltLoader = metadata.quilt_loader ?? {};

    analysis.platform = "Quilt";
    analysis.modName = metadata.name ?? quiltLoader.metadata?.name ?? analysis.modName;
    analysis.modId = quiltLoader.id ?? analysis.modId;
    analysis.version = quiltLoader.version ?? analysis.version;
    analysis.minecraftVersion = dependencyVersion(quiltLoader.depends?.minecraft)
      ?? inferMinecraftVersion(quiltLoader.version)
      ?? analysis.minecraftVersion;
    analysis.requirements = requirementsFromDependencyObject(quiltLoader.depends, "Required");
  } catch {
    analysis.platform = "Quilt";
  }
}

function applyTomlMetadata(analysis, content, platform) {
  analysis.platform = platform;
  analysis.modName = tomlValue(content, "displayName") ?? analysis.modName;
  analysis.modId = tomlValue(content, "modId") ?? analysis.modId;
  analysis.version = tomlValue(content, "version") ?? analysis.version;
  analysis.minecraftVersion = tomlValue(content, "minecraftVersion") ?? analysis.minecraftVersion;
  analysis.requirements = requirementsFromToml(content);
}

function detectForgePlatform(content) {
  const loader = tomlValue(content, "modLoader")?.toLowerCase() ?? "";

  if (loader.includes("neoforge")) {
    return "NeoForge";
  }

  return "Forge";
}

function tomlValue(content, key) {
  const match = content.match(new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'\\n]+)["']?`, "im"));

  return match?.[1]?.trim() ?? null;
}

function dependencyVersion(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return value.version ?? null;

  return null;
}

function requirementsFromDependencyObject(dependencies, relation) {
  if (!dependencies || typeof dependencies !== "object") {
    return [];
  }

  return Object.entries(dependencies)
    .filter(([id]) => id !== "minecraft")
    .map(([id, value]) => ({
      id,
      version: dependencyVersion(value) ?? "*",
      relation,
    }));
}

function requirementsFromToml(content) {
  const dependencyBlocks = content.match(/\[\[dependencies\.[^\]]+\]\][\s\S]*?(?=\n\s*\[\[|$)/g) ?? [];

  return dependencyBlocks
    .map((block) => ({
      id: tomlValue(block, "modId") ?? "unknown",
      version: tomlValue(block, "versionRange") ?? tomlValue(block, "version") ?? "*",
      relation: tomlValue(block, "type") ?? (tomlValue(block, "mandatory") === "false" ? "Optional" : "Required"),
    }))
    .filter((requirement) => requirement.id !== "unknown" && requirement.id !== "minecraft");
}

function inferMinecraftVersion(version) {
  if (typeof version !== "string") {
    return null;
  }

  const match = version.match(/(?:^|[+._-])mc(\d+(?:\.\d+){1,3})/i);

  return match?.[1] ?? null;
}

function countByPath(files, suffix) {
  return files.filter((file) => file.path.toLowerCase().endsWith(suffix)).length;
}

function countWithPrefix(files, prefix) {
  return files.filter((file) => file.path.toLowerCase().startsWith(prefix)).length;
}
