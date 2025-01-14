export type Subjectivity = {
  visibleTo: Set<number>;
  hiddenFrom: Set<number>;
  ancestorSubjectivity: Subjectivity | null;
};

export function IsVisibleToAll(s: Subjectivity, applyV01Semantics: boolean): boolean {
  if (applyV01Semantics) {
    // In v0.1, hiddenFrom nodes should not be sent
    return (
      s.visibleTo.size === 0 &&
      s.hiddenFrom.size === 0 &&
      (s.ancestorSubjectivity == null || IsVisibleToAll(s.ancestorSubjectivity, applyV01Semantics))
    );
  }
  return (
    s.visibleTo.size === 0 &&
    (s.ancestorSubjectivity == null || IsVisibleToAll(s.ancestorSubjectivity, applyV01Semantics))
  );
}

export function IsVisibleToAnyOneOfConnectionIds(
  s: Subjectivity,
  connectionIdsMap: Map<number, number>,
  applyV01Semantics: boolean,
): boolean {
  if (IsVisibleToAll(s, applyV01Semantics)) {
    return true;
  }
  let visibleToDirectly = false;
  if (s.visibleTo.size > 0) {
    for (const connectionId of s.visibleTo) {
      if (connectionIdsMap.has(connectionId)) {
        visibleToDirectly = true;
        break;
      }
    }
    if (!visibleToDirectly) {
      // There is a visibleTo list and none of the connections are in it so this node is not visible
      return false;
    }
  }
  if (applyV01Semantics) {
    // In v0.1, hiddenFrom nodes should not be sent
    for (const connectionId of s.hiddenFrom) {
      if (connectionIdsMap.has(connectionId)) {
        // If the connection is in the HiddenFrom list then it should not be visible
        return false;
      }
    }
  }
  if (s.ancestorSubjectivity == null) {
    return true;
  }
  return IsVisibleToAnyOneOfConnectionIds(
    s.ancestorSubjectivity,
    connectionIdsMap,
    applyV01Semantics,
  );
}

export type NodeWithSubjectivity = {
  nodeId: number;
  tag: string;
  textContent?: string;
  attributes: { [key: string]: string };
  childNodes: Array<NodeWithSubjectivity>;

  subjectivity: Subjectivity;
  parent: NodeWithSubjectivity | null;
};

export function applySubjectivityToChildren(
  node: NodeWithSubjectivity,
  newSubjectivity: Subjectivity,
  previousSubjectivity: Subjectivity,
) {
  for (const child of node.childNodes) {
    if (child.subjectivity === previousSubjectivity) {
      child.subjectivity = newSubjectivity;
      applySubjectivityToChildren(child, newSubjectivity, previousSubjectivity);
    } else {
      child.subjectivity.ancestorSubjectivity = newSubjectivity;
    }
  }
}
