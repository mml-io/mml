import React, { useEffect, useRef } from "react";
import Editor, { Monaco, OnMount } from "@monaco-editor/react";
import { useEditorStore } from "../state/editorStore";

interface CodeEditorProps {
  initialCode?: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ initialCode = "" }) => {
  const { code, setCode, codeRange } = useEditorStore();
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationIdsRef = useRef<string[]>([]);

  // Sync local code from props if provided and store is empty (initial load)
  useEffect(() => {
    if (initialCode && !code) {
      setCode(initialCode);
    }
  }, [initialCode, code, setCode]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define golden age theme
    monaco.editor.defineTheme("golden-age", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "666666", fontStyle: "italic" },
        { token: "keyword", foreground: "000000", fontStyle: "bold" },
        { token: "string", foreground: "444444" },
        { token: "number", foreground: "222222" },
        { token: "tag", foreground: "000000", fontStyle: "bold" },
        { token: "attribute.name", foreground: "333333" },
        { token: "attribute.value", foreground: "444444" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#1a1a1a",
        "editorCursor.foreground": "#000000",
        "editor.lineHighlightBackground": "#eeeeee",
        "editorLineNumber.foreground": "#999999",
        "editor.selectionBackground": "#cccccc",
      },
    });

    monaco.editor.setTheme("golden-age");
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
    }
  };

  // React to selection changes from the store (e.g. from Viewport)
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    const ranges =
      codeRange?.map(
        (r) =>
          new monaco.Range(
            r.startLine,
            1, // whole line highlight
            r.endLine,
            1,
          ),
      ) ?? [];

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      ranges.map((range) => ({
        range,
        options: {
          isWholeLine: true,
          className: "mml-code-selection-highlight-line",
        },
      })),
    );

    if (ranges[0]) {
      editor.revealRangeInCenter(ranges[0]);
    }
  }, [codeRange]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Editor
        height="100%"
        defaultLanguage="html" // MML is HTML-like
        value={code}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          fontFamily: '"Geist Mono", monospace',
          fontSize: 10,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          padding: { top: 8 },
          roundedSelection: false,
          cursorBlinking: "phase",
          cursorStyle: "block",
        }}
      />
    </div>
  );
};

