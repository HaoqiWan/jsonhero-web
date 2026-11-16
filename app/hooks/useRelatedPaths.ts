import { useMemo } from "react";
import { getRelatedPathsAtPath } from "~/utilities/relatedValues";
import { useJson } from "./useJson";
import { useJsonColumnViewState } from "./useJsonColumnView";

export function useRelatedPaths(): string[] {
  const { selectedNodeId } = useJsonColumnViewState();
  const [json] = useJson();
  const cache = useMemo(() => new Map<string, Array<string>>(), [json]);

  return useMemo(() => {
    if (!selectedNodeId) return [];

    //check cache
    const cachedPaths = cache.get(selectedNodeId);
    if (cachedPaths) {
      return cachedPaths;
    }

    //fetch result
    let paths = getRelatedPathsAtPath(selectedNodeId, json);

    //cache
    for (let index = 0; index < paths.length; index++) {
      const path = paths[index];
      cache.set(path, paths);
    }

    return paths;
  }, [selectedNodeId, json, cache]);
}
