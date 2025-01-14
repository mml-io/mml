// TODO - there are more possible mergeable patterns
import { StaticVirtualDOMMutationIdsRecord } from "@mml-io/observable-dom-common";

export function mergeMutations(mutations: Array<StaticVirtualDOMMutationIdsRecord>) {
  if (mutations.length <= 1) {
    return mutations;
  }
  // Include the first one as the base
  const mergedMutations = [mutations[0]];
  const lastMutation = mutations[0];
  for (let i = 1; i < mutations.length; i++) {
    const currentMutation = mutations[i];
    if (
      currentMutation.type === "childList" &&
      lastMutation.type === "childList" &&
      lastMutation.targetId === currentMutation.targetId
    ) {
      const lastAddedNodeId: number | null =
        lastMutation.addedNodes.length > 0
          ? lastMutation.addedNodes[lastMutation.addedNodes.length - 1].nodeId
          : null;
      if (
        lastAddedNodeId !== null &&
        currentMutation.previousSiblingId === lastAddedNodeId &&
        currentMutation.removedNodeIds.length === 0 // Can't trivially merge if there are removed nodes because the nodes might be in the added nodes of the previous mutation
      ) {
        // Can trivially merge these as the current mutation is just adding to the end of the last mutation
        lastMutation.addedNodes.push(...currentMutation.addedNodes);
        continue;
      }
    } else if (
      currentMutation.type === "attributes" &&
      lastMutation.type === "attributes" &&
      lastMutation.targetId === currentMutation.targetId
    ) {
      // Can trivially merge these as the current mutation is just applying more attributes to the same node
      Object.assign(lastMutation.attributes, currentMutation.attributes);
      continue;
    }
    mergedMutations.push(currentMutation);
  }
  return mergedMutations;
}
