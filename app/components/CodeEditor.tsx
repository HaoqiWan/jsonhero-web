import { json as jsonLang } from "@codemirror/lang-json";
import {
  EditorView,
  TransactionSpec,
  useCodeMirror,
  ViewUpdate,
} from "@uiw/react-codemirror";
import { useRef, useEffect } from "react";
import { useJsonDoc } from "~/hooks/useJsonDoc";
import { getEditorSetup } from "~/utilities/codeMirrorSetup";
import { darkTheme, lightTheme } from "~/utilities/codeMirrorTheme";
import { useTheme } from "./ThemeProvider";
import { useHotkeys } from "react-hotkeys-hook";
// Modified: support editable documents, undo/redo, and an editor toolbar.
import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { history, historyKeymap } from "@codemirror/history";

export type CodeEditorProps = {
  content: string;
  language?: "json";
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onUpdate?: (update: ViewUpdate) => void;
  selection?: { start: number; end: number };
  fillHeight?: boolean;
};

const languages = {
  json: jsonLang,
};

type CodeEditorDefaultProps = Required<
  Omit<CodeEditorProps, "content" | "onChange" | "onUpdate">
>;

const defaultProps: CodeEditorDefaultProps = {
  language: "json",
  readOnly: true,
  selection: { start: 0, end: 0 },
  fillHeight: false,
};

export function CodeEditor(opts: CodeEditorProps) {
  const { content, language, readOnly, onChange, onUpdate, selection, fillHeight } = {
    ...defaultProps,
    ...opts,
  };

  const [theme] = useTheme();

  const extensions = getEditorSetup();

  const languageExtension = languages[language];

  extensions.push(languageExtension());
  extensions.push(EditorState.readOnly.of(readOnly), history(), keymap.of([...defaultKeymap, ...historyKeymap]));
  extensions.push(EditorView.contentAttributes.of({ "aria-label": "JSON editor" }));

  const editor = useRef(null);
  const { setContainer, view, state } = useCodeMirror({
    container: editor.current,
    extensions,
    editable: !readOnly,
    contentEditable: !readOnly,
    value: content,
    autoFocus: false,
    theme: theme === "light" ? lightTheme() : darkTheme(),
    indentWithTab: false,
    basicSetup: false,
    onChange,
    onUpdate,
  });

  useEffect(() => {
    if (editor.current) {
      setContainer(editor.current);
    }
  }, [editor.current]);

  const setSelectionRef = useRef(false);

  useEffect(() => {
    if (setSelectionRef.current) {
      return;
    }

    if (view) {
      setSelectionRef.current = true;

      const selectionStart = Math.min(selection?.start ?? 0, view.state.doc.length);
      const selectionEnd = Math.min(selection?.end ?? 0, view.state.doc.length);

      const transactionSpec: TransactionSpec = {
        selection: { anchor: selectionStart, head: selectionEnd },
        effects: EditorView.scrollIntoView(selectionStart, {
          y: "start",
          yMargin: 100,
        }),
      };

      view.dispatch(transactionSpec);
    }
  }, [selection, view, setSelectionRef.current]);

  const { minimal } = useJsonDoc();

  useHotkeys(
   "ctrl+a,meta+a,command+a",
   (e) => {
     e.preventDefault();
     view?.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
   },
   [view, state]
 );


  return (
    <div className={fillHeight ? "flex-1 min-h-0 overflow-hidden" : undefined}>
      <div
        className={`${
          fillHeight ? "h-full" : minimal ? "h-jsonViewerHeightMinimal" : "h-jsonViewerHeight"
        } overflow-y-auto no-scrollbar`}
        ref={editor}
      />
    </div>
  );
}
