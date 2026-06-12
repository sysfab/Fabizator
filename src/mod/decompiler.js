let decompileFn = null;

async function getCfr() {
  if (!decompileFn) {
    const mod = await import(
      /* @vite-ignore */
      "https://cdn.jsdelivr.net/npm/@run-slicer/cfr/cfr.js"
    );
    decompileFn = mod.decompile;
  }
  return decompileFn;
}


export async function decompileAll(files, onBatch, batchSize = 8) {
  const decompile = await getCfr();

  const classFiles = files.filter((f) =>
    f.path.toLowerCase().endsWith(".class")
  );
  if (classFiles.length === 0) return 0;

  const classMap = new Map(
    files
      .filter((f) => f.classBytes != null)
      .map((f) => [f.path.replace(/\.class$/i, ""), f.classBytes])
  );

  let batch = [];
  let completed = 0;

  for (const file of classFiles) {
    const className = file.path.replace(/\.class$/i, "");
    let source;
    try {
      source = await decompile(className, {
        source: async (name) => classMap.get(name) ?? null,
        options: { 
            hidelangimports: "true",
            showversion: "false",
            comments: "false",
            silent: "true",
        },
      });
      source = source.replace(/\/\*\s*\*\s*Decompiled with CFR\.\s*\*\//, "").slice(1)
    } catch (e) {
      source = `// Decompilation failed:\n// ${e.message}`;
    }

    batch.push({ id: file.id, source });
    completed++;

    if (batch.length >= batchSize || completed === classFiles.length) {
      onBatch([...batch], completed, classFiles.length);
      batch = [];
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  return completed;
}