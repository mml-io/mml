import React, { useEffect, useRef } from "react";
import Editor, { Monaco, OnMount } from "@monaco-editor/react";
import { useEditorStore } from "../state/editorStore";

interface CodeEditorProps {
  initialCode?: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ initialCode = "" }) => {
  const { code, setCode, selection } = useEditorStore();
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);

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
    if (editorRef.current && selection.range) {
      const { startLine, endLine, startColumn, endColumn } = selection.range;
      
      // Reveal the range
      editorRef.current.revealRangeInCenter({
        startLineNumber: startLine,
        startColumn,
        endLineNumber: endLine,
        endColumn,
      });

      // Set selection or highlight
      editorRef.current.setSelection({
        startLineNumber: startLine,
        startColumn,
        endLineNumber: endLine,
        endColumn,
      });
      
      // Focus editor
      editorRef.current.focus();
    }
  }, [selection]);

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

