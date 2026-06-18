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


function classMapFor(files) {
  return new Map(
    files
      .filter((f) => f.classBytes != null)
      .map((f) => [f.path.replace(/\.class$/i, ""), f.classBytes])
  );
}

async function decompileClassFile(decompile, file, classMap) {
  const className = file.path.replace(/\.class$/i, "");

  try {
    const source = await decompile(className, {
      source: async (name) => classMap.get(name) ?? null,
      options: { 
          hidelangimports: "true",
          showversion: "false",
          comments: "false",
          silent: "true",
      },
    });

    return source.replace(/\/\*\s*\*\s*Decompiled with CFR\.\s*\*\//, "").slice(1);
  } catch (e) {
    return `// Decompilation failed:\n// ${e.message}`;
  }
}

export async function decompileFile(file, files) {
  const decompile = await getCfr();
  const classMap = classMapFor(files);

  return decompileClassFile(decompile, file, classMap);
}

export async function decompileAll(files, onBatch, batchSize = 8) {
  const decompile = await getCfr();
  const classFiles = files.filter((f) =>
    f.path.toLowerCase().endsWith(".class") && !f.decompiled && !f.decompiling
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
    const source = await decompileClassFile(decompile, file, classMap);

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
