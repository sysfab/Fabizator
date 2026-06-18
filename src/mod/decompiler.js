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