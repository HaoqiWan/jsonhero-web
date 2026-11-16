import { JSONHeroPath } from "@jsonhero/path";
import { pick } from "lodash-es";
import React, { useEffect, useRef } from "react";
import { createContext, ReactNode, useContext } from "react";
import invariant from "tiny-invariant";
import {
  ColumnViewState,
  ColumnViewAction,
  useColumnView,
  ColumnViewInstanceState,
  ColumnViewAPI,
} from "~/useColumnView";
import {
  generateColumnViewNode,
  calculateStablePath,
  firstChildToDescendant,
  generateNodesToPath,
} from "~/utilities/jsonColumnView";
import { useJson } from "./useJson";
import { useJsonDoc } from "./useJsonDoc";
import { existingPreviewPath } from "~/utilities/jsonDraft";

export type JsonColumnViewState = ColumnViewInstanceState;
export type JsonColumnViewAPI = ColumnViewAPI;

const JsonColumnViewStateContext = createContext<JsonColumnViewState>(
  {} as JsonColumnViewState
);

const JsonColumnViewAPIContext = createContext<JsonColumnViewAPI>(
  {} as JsonColumnViewAPI
);

export function JsonColumnViewProvider({ children }: { children: ReactNode }) {
  const [json] = useJson();
  const { doc, path: initialNodeId } = useJsonDoc();

  const rootNode = React.useMemo(() => {
    return generateColumnViewNode(json);
  }, [json]);

  const jsonReducer = React.useCallback(
    (
      state: ColumnViewState,
      action: ColumnViewAction,
      changes: ColumnViewState
    ): ColumnViewState => {
      if (action.type === "MOVE_UP" || action.type == "MOVE_DOWN") {
        const { selectedNodeId } = state;
        const { highlightedNodeId } = changes;

        invariant(selectedNodeId, "expected selectedNodeId");
        invariant(highlightedNodeId, "expected highlightedNodeId");

        const calculatedPath = calculateStablePath(
          selectedNodeId,
          highlightedNodeId,
          json
        );

        return {
          ...changes,
          selectedNodeId: calculatedPath,
        };
      }

      if (
        action.type === "MOVE_TO_PARENT" &&
        action.source &&
        action.source.altKey
      ) {
        const { selectedNodeId } = state;

        return {
          ...changes,
          selectedNodeId,
        };
      }

      if (action.type === "MOVE_TO_CHILDREN") {
        const { selectedNodeId, highlightedNodeId } = state;

        invariant(selectedNodeId, "expected selectedNodeId");
        invariant(highlightedNodeId, "expected highlightedNodeId");

        // If the previous highlightedNodeId is an ancestor of the previous selectedNodeId
        if (isAncestorOf(highlightedNodeId, selectedNodeId)) {
          // Get the next child of the highlightedNodeId in the path of selectedNodeId
          // And make the highlightedNodeId that next child
          // And keep the selectedNodeId unchanged
          const highlightedPath = new JSONHeroPath(highlightedNodeId);
          const selectedPath = new JSONHeroPath(selectedNodeId);

          const childPath = firstChildToDescendant(
            highlightedPath,
            selectedPath
          );

          if (!childPath) {
            return changes;
          }

          return {
            ...changes,
            highlightedNodeId: childPath,
            selectedNodeId,
          };
        } else {
          return changes;
        }
      }

      return changes;
    },
    [json]
  );

  const { state, api } = useColumnView({
    rootNode,
    initialState: initialNodeId ?? "$",
    stateReducer: jsonReducer,
  });

  const isStateRestored = useRef<boolean>(!!initialNodeId);

  // This is restoring the state
  useEffect(() => {
    if (isStateRestored.current) {
      return;
    }

    isStateRestored.current = true;

    const storage = localStorage.getItem(doc.id);
    if (storage == null) {
      api.goToNextSibling();
      return;
    }

    const restoredState = JSON.parse(storage) as ColumnViewInstanceState;
    if (!restoredState.selectedNodeId) {
      api.goToNextSibling();
      return;
    }

    api.goToNodeId(restoredState.selectedNodeId, "localStorage");
  }, [doc.id, isStateRestored.current, state, api]);

  // This is setting the state
  useEffect(() => {
    if (doc == null) {
      return;
    }
    if (!isStateRestored.current) {
      return;
    }
    localStorage.setItem(
      doc.id,
      JSON.stringify(pick(state, "selectedNodeId", "highlightedNodeId"))
    );
  }, [
    isStateRestored.current,
    doc.id,
    state.selectedNodeId,
    state.highlightedNodeId,
  ]);

  return (
    <JsonColumnViewAPIContext.Provider value={api}>
      <JsonColumnViewStateContext.Provider value={state}>
        {children}
      </JsonColumnViewStateContext.Provider>
    </JsonColumnViewAPIContext.Provider>
  );
}

export function useJsonColumnViewState(): JsonColumnViewState {
  const context = useContext(JsonColumnViewStateContext);

  invariant(
    context,
    "useJsonColumnViewState must be used within a JsonColumnViewStateContext.Provider"
  );

  return context;
}

// Scope draft navigation to the inspector so paths added in the draft cannot
// enter the saved document's tree, search results, or navigation history.
export function JsonPreviewSelectionProvider({ children, path, onSelect }: {
  children: ReactNode;
  path?: string;
  onSelect: (path: string) => void;
}) {
  const [json] = useJson();
  const savedState = useJsonColumnViewState();
  const savedApi = useJsonColumnViewAPI();
  const requested = path ?? savedState.selectedNodeId ?? "$";
  const selectedNodeId = existingPreviewPath(json, requested);
  const selectedNodes = React.useMemo(() => generateNodesToPath(json, selectedNodeId), [json, selectedNodeId]);
  const selectedPath = selectedNodes.map(node => node.id);
  const state = { ...savedState, selectedNodeId, highlightedNodeId: selectedNodeId,
    selectedNodes, selectedPath, highlightedPath: selectedPath };
  const api = { ...savedApi, goToNodeId: onSelect };
  return <JsonColumnViewAPIContext.Provider value={api}>
    <JsonColumnViewStateContext.Provider value={state}>{children}</JsonColumnViewStateContext.Provider>
  </JsonColumnViewAPIContext.Provider>;
}

export function useJsonColumnViewAPI(): JsonColumnViewAPI {
  const context = useContext(JsonColumnViewAPIContext);

  invariant(
    context,
    "useJsonColumnViewAPI must be used within a JsonColumnViewAPIContext.Provider"
  );

  return context;
}

function isAncestorOf(ancestor: string, descendant: string) {
  return ancestor != descendant && descendant.startsWith(ancestor);
}
