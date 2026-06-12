import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";

import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { java } from "@codemirror/lang-java";

import {LRLanguage, LanguageSupport} from "@codemirror/language";
import {parser} from "lezer-toml";
export const tomlLanguage = LRLanguage.define({ parser });
export function toml() { return new LanguageSupport(tomlLanguage); }

import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";

const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#d89cff" },
  { tag: tags.string, color: "#a8e063" },
  { tag: tags.number, color: "#f0b65a" },
  { tag: tags.bool, color: "#f0b65a" },
  { tag: tags.null, color: "#df6b6b" },
  { tag: tags.propertyName, color: "#8fc7ff" },
  { tag: tags.comment, color: "#617080" },
  { tag: tags.tagName, color: "#8fc7ff" },
  { tag: tags.attributeName, color: "#d89cff" },
]);

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "#090e14",
    color: "#c9f7bb",
    fontSize: "0.9rem",
  },
  ".cm-scroller": {
    fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
    lineHeight: "1.55",
  },
  ".cm-content": {
    padding: "1rem 0",
  },
  ".cm-line": {
    padding: "0 1rem",
  },
  ".cm-gutters": {
    backgroundColor: "#090e14",
    borderRight: "1px solid #1f2d3f",
    color: "#617080",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    minWidth: "2.5rem",
    padding: "0 0.75rem 0 0.5rem",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(124, 193, 68, 0.06)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(124, 193, 68, 0.08)",
    color: "#a8e063",
  },
  ".cm-selectionBackground": {
    backgroundColor: "rgba(124, 193, 68, 0.28) !important",
  },
  ".cm-cursor": {
    borderLeftColor: "#a8e063",
  },
  "&.cm-focused": {
    outline: "1px solid #7cc144",
  },
});

function languageExtensionsFor(path) {
  const lowerPath = path.toLowerCase();

  if (lowerPath.endsWith(".json") || lowerPath.endsWith(".mcmeta")) {
    return [json()];
  }

  if (lowerPath.endsWith(".xml")) {
    return [xml()];
  }

  if (lowerPath.endsWith(".yml") || lowerPath.endsWith(".yaml")) {
    return [yaml()];
  }

  if (lowerPath.endsWith(".toml")) {
    return [toml()];
  }

  if (lowerPath.endsWith(".class") || lowerPath.endsWith(".java")) {
    return [java()];
  }

  return [];
}

export function CodeEditor({ file, onChange }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const editor = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: file.content,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          dropCursor(),
          rectangularSelection(),
          highlightActiveLine(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          syntaxHighlighting(highlightStyle),
          editorTheme,
          EditorView.editable.of(file.editable),
          EditorState.readOnly.of(!file.editable),
          EditorState.tabSize.of(2),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && file.editable) {
              onChangeRef.current(file.id, update.state.doc.toString());
            }
          }),
          ...languageExtensionsFor(file.path),
        ],
      }),
    });

    editorRef.current = editor;

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, [file.id, file.editable, file.path]);

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor || editor.state.doc.toString() === file.content) {
      return;
    }

    editor.dispatch({
      changes: {
        from: 0,
        to: editor.state.doc.length,
        insert: file.content,
      },
    });
  }, [file.content]);

  return (
    <div
      ref={containerRef}
      className="code-editor-shell"
      aria-label={file.editable ? `${file.name} editor` : `${file.name} preview`}
    />
  );
}

export default CodeEditor;