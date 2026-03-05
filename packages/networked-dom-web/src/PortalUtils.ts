import {
  IDocumentFactory,
  IElementLike,
  INodeLike,
  IPortalElement,
  isElementLike,
  isPortalElement,
} from "./DocumentInterface";
import { getChildrenTarget } from "./ElementUtils";

/**
 * Resolves the correct document factory for creating children of a given parent node.
 *
 * Resolution order:
 * 1. If parent is a portal with its own factory, use that
 * 2. If parent was created with an overridden factory (descendant of a portal), inherit it
 * 3. Returns undefined if no override applies (caller should use default factory)
 */
export function resolveChildFactory(
  parentNode: INodeLike,
  elementFactoryOverride: Map<INodeLike, IDocumentFactory>,
): IDocumentFactory | undefined {
  if (isElementLike(parentNode) && isPortalElement(parentNode)) {
    const portalFactory = (parentNode as IPortalElement).getPortalDocumentFactory?.();
    if (portalFactory) {
      return portalFactory;
    }
  }
  return elementFactoryOverride.get(parentNode);
}

/**
 * After creating an element, checks if it is a portal that provides a different document factory.
 * Returns the child factory and whether a portal factory is being used.
 */
export function resolvePortalChildFactory(
  element: IElementLike,
  currentFactory: IDocumentFactory,
): { childFactory: IDocumentFactory; usingPortalFactory: boolean } {
  if (isPortalElement(element)) {
    const portalFactory = (element as IPortalElement).getPortalDocumentFactory?.();
    if (portalFactory) {
      return { childFactory: portalFactory, usingPortalFactory: true };
    }
  }
  return { childFactory: currentFactory, usingPortalFactory: false };
}

/**
 * Records a factory override for an element if it was created with a non-default factory.
 */
export function recordFactoryOverride(
  element: INodeLike,
  factory: IDocumentFactory,
  defaultFactory: IDocumentFactory,
  elementFactoryOverride: Map<INodeLike, IDocumentFactory>,
): void {
  if (factory !== defaultFactory) {
    elementFactoryOverride.set(element, factory);
  }
}

/**
 * Flushes pending portal children to their portal target elements.
 */
export function flushPendingPortalChildren(
  pendingPortalChildren: Map<IElementLike, INodeLike[]>,
): void {
  for (const [portalParent, children] of pendingPortalChildren) {
    const target = getChildrenTarget(portalParent);
    for (const child of children) {
      target.appendChild(child);
    }
  }
  pendingPortalChildren.clear();
}

/**
 * Buffers a child element for deferred attachment to a portal parent.
 */
export function bufferPortalChild(
  pendingPortalChildren: Map<IElementLike, INodeLike[]>,
  portalParent: IElementLike,
  child: INodeLike,
): void {
  const pending = pendingPortalChildren.get(portalParent) ?? [];
  pending.push(child);
  pendingPortalChildren.set(portalParent, pending);
}
