export function clone(group) {
  // shallow clone that preserves material instances on meshes
  const cloned = group.clone(true);
  return cloned;
}
