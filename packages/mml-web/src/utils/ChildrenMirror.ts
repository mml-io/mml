/**
 * ChildrenMirror utility class for automatically synchronizing children between HTML elements
 * without the need for constant copying/diffing.
 */
export class ChildrenMirror {
  private sourceElement: Element;
  private targetElement: Element;
  private mutationObserver: MutationObserver;
  private isDisposed: boolean = false;
  private nodeFilter: (node: Node) => boolean;
  private forwardEvents: boolean;
  private mirrorToOriginalMap = new WeakMap<Element, Element>();

  /**
   * Creates a new ChildrenMirror instance that will keep targetElement's children
   * synchronized with sourceElement's children.
   *
   * @param sourceElement The element whose children to observe and mirror
   * @param targetElement The element that will receive the mirrored children
   * @param options Configuration options
   */
  constructor(
    sourceElement: Element,
    targetElement: Element,
    options: {
      /** Whether to mirror existing children immediately (default: true) */
      mirrorExisting?: boolean;
      /** Whether to observe subtree changes (default: false) */
      subtree?: boolean;
      /** Whether to mirror attributes of children (default: true) */
      attributes?: boolean;
      /** Whether to mirror text content changes (default: true) */
      characterData?: boolean;
      /** Custom filter function to determine which nodes to mirror */
      nodeFilter?: (node: Node) => boolean;
      /** Whether to forward click events from mirrors to originals (default: true) */
      forwardEvents?: boolean;
    } = {},
  ) {
    this.sourceElement = sourceElement;
    this.targetElement = targetElement;

    const {
      mirrorExisting = true,
      subtree = false,
      attributes = true,
      characterData = true,
      nodeFilter = () => true,
      forwardEvents = true,
    } = options;

    this.nodeFilter = nodeFilter;
    this.forwardEvents = forwardEvents;

    console.log(`🚀 ChildrenMirror: Initializing with options:`, {
      mirrorExisting,
      subtree,
      attributes,
      characterData,
      forwardEvents,
      sourceElement: {
        tagName: this.sourceElement.tagName,
        id: this.sourceElement.id || 'N/A',
        className: this.sourceElement.className || 'N/A',
        childrenCount: this.sourceElement.children.length,
      },
      targetElement: {
        tagName: this.targetElement.tagName,
        id: this.targetElement.id || 'N/A',
        className: this.targetElement.className || 'N/A',
        childrenCount: this.targetElement.children.length,
      },
    });

    // Mirror existing children if requested
    if (mirrorExisting) {
      console.log(`🔄 ChildrenMirror: Mirroring existing children`);
      this.mirrorAllChildren(this.nodeFilter);
    }

    // Set up mutation observer to watch for changes
    this.mutationObserver = new MutationObserver((mutations) => {
      this.handleMutations(mutations, this.nodeFilter);
    });

    // Start observing
    console.log(`👁️ ChildrenMirror: Starting to observe mutations on source element`);
    this.mutationObserver.observe(this.sourceElement, {
      childList: true,
      subtree,
      attributes,
      characterData,
          });

    console.log(`✅ ChildrenMirror: Initialization complete`);
  }

  /**
   * Mirrors all current children from source to target
   */
  private mirrorAllChildren(nodeFilter: (node: Node) => boolean): void {
    console.log(`🔄 ChildrenMirror: Starting full mirror of children`);
    
    // Clear target children first
    const targetChildrenCount = this.targetElement.children.length;
    console.log(`🗑️ ChildrenMirror: Clearing ${targetChildrenCount} existing target children`);
    while (this.targetElement.firstChild) {
      this.targetElement.removeChild(this.targetElement.firstChild);
    }

    // Clone and append all source children that pass the filter
    const sourceNodes = Array.from(this.sourceElement.childNodes);
    const filteredNodes = sourceNodes.filter(nodeFilter);
    
    console.log(`📊 ChildrenMirror: Source has ${sourceNodes.length} total nodes, ${filteredNodes.length} pass filter`);
    
    filteredNodes.forEach((node, index) => {
      console.log(`🔗 ChildrenMirror: Cloning and mirroring node ${index}:`, {
        tagName: (node as Element).tagName || node.nodeName,
        id: (node as Element).id || 'N/A',
        className: (node as Element).className || 'N/A',
        withEventForwarding: this.forwardEvents,
      });
      
      const clonedNode = this.cloneNodeWithEventForwarding(node as Element);
      this.targetElement.appendChild(clonedNode);
    });
    
    console.log(`✅ ChildrenMirror: Full mirror complete. Target now has ${this.targetElement.children.length} children`);
  }

  /**
   * Clones a node and sets up event forwarding if enabled
   */
  private cloneNodeWithEventForwarding(originalNode: Element): Node {
    const clonedNode = originalNode.cloneNode(true);

    if (this.forwardEvents && clonedNode instanceof Element) {
      this.setupEventForwarding(clonedNode, originalNode);
    }

    return clonedNode;
  }

  /**
   * Sets up event forwarding from a mirrored element to its original
   */
  private setupEventForwarding(mirrorElement: Element, originalElement: Element): void {
    console.log(`🔗 ChildrenMirror: Setting up event forwarding:`, {
      mirror: {
        tagName: mirrorElement.tagName,
        id: mirrorElement.id || 'N/A',
        className: mirrorElement.className || 'N/A',
      },
      original: {
        tagName: originalElement.tagName,
        id: originalElement.id || 'N/A',
        className: originalElement.className || 'N/A',
      },
    });

    // Store the mapping for easy lookup
    this.mirrorToOriginalMap.set(mirrorElement, originalElement);

    // Add click event listener to the mirror
    mirrorElement.addEventListener("click", this.createEventForwarder(originalElement));

    // Recursively set up event forwarding for child elements
    const mirrorChildren = Array.from(mirrorElement.children);
    const originalChildren = Array.from(originalElement.children);

    console.log(`🔄 ChildrenMirror: Setting up event forwarding for ${Math.min(mirrorChildren.length, originalChildren.length)} child pairs`);

    for (let i = 0; i < Math.min(mirrorChildren.length, originalChildren.length); i++) {
      this.setupEventForwarding(mirrorChildren[i], originalChildren[i]);
    }
  }

  /**
   * Creates an event forwarder function that dispatches events to the original element
   */
  private createEventForwarder(originalElement: Element): (event: Event) => void {
    return (event: Event) => {
      // Prevent the event from bubbling on the mirror side
      event.stopPropagation();
      event.preventDefault();

      // Create a new event to dispatch on the original element
      const forwardedEvent = new MouseEvent(event.type, {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: (event as MouseEvent).detail,
        screenX: (event as MouseEvent).screenX,
        screenY: (event as MouseEvent).screenY,
        clientX: (event as MouseEvent).clientX,
        clientY: (event as MouseEvent).clientY,
        ctrlKey: (event as MouseEvent).ctrlKey,
        altKey: (event as MouseEvent).altKey,
        shiftKey: (event as MouseEvent).shiftKey,
        metaKey: (event as MouseEvent).metaKey,
        button: (event as MouseEvent).button,
        buttons: (event as MouseEvent).buttons,
      });

      // Dispatch the event on the original element
      originalElement.dispatchEvent(forwardedEvent);
    };
  }

  /**
   * Handles mutation observer events
   */
  private handleMutations(mutations: MutationRecord[], nodeFilter: (node: Node) => boolean): void {
    if (this.isDisposed) return;

    console.log(`🔍 ChildrenMirror: Processing ${mutations.length} mutation(s)`);

    for (const mutation of mutations) {
      console.log(`🔧 ChildrenMirror: Handling mutation type: ${mutation.type}`, {
        target: mutation.target,
        targetTagName: (mutation.target as Element).tagName || 'N/A',
        targetId: (mutation.target as Element).id || 'N/A',
        targetClassName: (mutation.target as Element).className || 'N/A',
      });

      switch (mutation.type) {
        case "childList":
          this.handleChildListMutation(mutation, nodeFilter);
          break;
        case "attributes":
          this.handleAttributeMutation(mutation);
          break;
        case "characterData":
          this.handleCharacterDataMutation(mutation);
          break;
      }
    }
  }

  /**
   * Handles child list mutations (additions/removals)
   */
  private handleChildListMutation(
    mutation: MutationRecord,
    nodeFilter: (node: Node) => boolean,
  ): void {
    console.log(`📝 ChildrenMirror: Child list mutation detected`, {
      isDirectChild: mutation.target === this.sourceElement,
      addedNodesCount: mutation.addedNodes.length,
      removedNodesCount: mutation.removedNodes.length,
      addedNodes: Array.from(mutation.addedNodes).map(node => ({
        tagName: (node as Element).tagName || node.nodeName,
        id: (node as Element).id || 'N/A',
        className: (node as Element).className || 'N/A',
        textContent: node.textContent?.substring(0, 50) + '...',
      })),
      removedNodes: Array.from(mutation.removedNodes).map(node => ({
        tagName: (node as Element).tagName || node.nodeName,
        id: (node as Element).id || 'N/A',
        className: (node as Element).className || 'N/A',
        textContent: node.textContent?.substring(0, 50) + '...',
      })),
      previousSibling: mutation.previousSibling ? {
        tagName: (mutation.previousSibling as Element).tagName || mutation.previousSibling.nodeName,
        id: (mutation.previousSibling as Element).id || 'N/A',
      } : null,
      nextSibling: mutation.nextSibling ? {
        tagName: (mutation.nextSibling as Element).tagName || mutation.nextSibling.nodeName,
        id: (mutation.nextSibling as Element).id || 'N/A',
      } : null,
    });

    // Check if this mutation is on the source element itself (direct children)
    if (mutation.target === this.sourceElement) {
      console.log(`🎯 ChildrenMirror: Handling direct children mutation`);
      // Handle direct children mutations
      this.handleDirectChildrenMutation(mutation, nodeFilter);
    } else {
      console.log(`🏠 ChildrenMirror: Handling nested mutation on`, {
        tagName: (mutation.target as Element).tagName,
        id: (mutation.target as Element).id || 'N/A',
        className: (mutation.target as Element).className || 'N/A',
      });
      // Handle nested mutations by finding the corresponding nested element in target
      this.handleNestedMutation(mutation, nodeFilter);
    }
  }

  /**
   * Handles mutations on direct children of the source element
   */
  private handleDirectChildrenMutation(
    mutation: MutationRecord,
    nodeFilter: (node: Node) => boolean,
  ): void {
    console.log(`🗑️ ChildrenMirror: Processing ${mutation.removedNodes.length} removed nodes`);
    // Handle removed nodes - use sibling information since removed nodes are no longer in DOM
    mutation.removedNodes.forEach((removedNode, index) => {
      if (!nodeFilter(removedNode)) {
        console.log(`⏭️ ChildrenMirror: Skipping removed node ${index} (filtered out):`, {
          tagName: (removedNode as Element).tagName || removedNode.nodeName,
        });
        return;
      }

      console.log(`❌ ChildrenMirror: Removing node ${index}:`, {
        tagName: (removedNode as Element).tagName || removedNode.nodeName,
        id: (removedNode as Element).id || 'N/A',
        className: (removedNode as Element).className || 'N/A',
      });

      const correspondingNode = this.findCorrespondingRemovedNode(
        mutation,
        this.targetElement,
        nodeFilter,
      );
      if (correspondingNode && correspondingNode.parentNode === this.targetElement) {
        console.log(`🗑️ ChildrenMirror: Successfully found and removing corresponding node:`, {
          tagName: (correspondingNode as Element).tagName || correspondingNode.nodeName,
          id: (correspondingNode as Element).id || 'N/A',
        });
        this.targetElement.removeChild(correspondingNode);
      } else {
        console.warn(`⚠️ ChildrenMirror: Could not find corresponding node to remove`);
      }
    });

    console.log(`➕ ChildrenMirror: Processing ${mutation.addedNodes.length} added nodes`);
    // Handle added nodes
    mutation.addedNodes.forEach((addedNode, index) => {
      if (!nodeFilter(addedNode)) {
        console.log(`⏭️ ChildrenMirror: Skipping added node ${index} (filtered out):`, {
          tagName: (addedNode as Element).tagName || addedNode.nodeName,
        });
        return;
      }

      console.log(`➕ ChildrenMirror: Adding node ${index}:`, {
        tagName: (addedNode as Element).tagName || addedNode.nodeName,
        id: (addedNode as Element).id || 'N/A',
        className: (addedNode as Element).className || 'N/A',
      });

      const clonedNode = this.cloneNodeWithEventForwarding(addedNode as Element);

      // Find the correct insertion point
      const nextSibling = this.findNextSiblingInTarget(addedNode, nodeFilter);
      if (nextSibling) {
        console.log(`📍 ChildrenMirror: Inserting before next sibling:`, {
          tagName: (nextSibling as Element).tagName || nextSibling.nodeName,
          id: (nextSibling as Element).id || 'N/A',
        });
        this.targetElement.insertBefore(clonedNode, nextSibling);
      } else {
        console.log(`📍 ChildrenMirror: Appending to end of target element`);
        this.targetElement.appendChild(clonedNode);
      }
    });

    console.log(`✅ ChildrenMirror: Direct children mutation handling complete`);
  }

  /**
   * Handles mutations on nested elements within the source tree
   */
  private handleNestedMutation(
    mutation: MutationRecord,
    nodeFilter: (node: Node) => boolean,
  ): void {
    console.log(`🏠 ChildrenMirror: Finding corresponding target for nested mutation`);
    // Find the corresponding target element for the mutation target
    const correspondingTarget = this.findCorrespondingNestedElement(mutation.target as Element);
    if (!correspondingTarget) {
      console.warn(`⚠️ ChildrenMirror: Could not find corresponding target, doing full re-sync`);
      // If we can't find the corresponding target, do a full re-sync
      this.mirrorAllChildren(nodeFilter);
      return;
    }

    console.log(`✅ ChildrenMirror: Found corresponding target:`, {
      tagName: correspondingTarget.tagName,
      id: correspondingTarget.id || 'N/A',
      className: correspondingTarget.className || 'N/A',
    });

    console.log(`🗑️ ChildrenMirror: Processing ${mutation.removedNodes.length} removed nested nodes`);
    // Handle removed nodes - use sibling information since removed nodes are no longer in DOM
    mutation.removedNodes.forEach((removedNode, index) => {
      if (!nodeFilter(removedNode)) {
        console.log(`⏭️ ChildrenMirror: Skipping removed nested node ${index} (filtered out)`);
        return;
      }

      console.log(`❌ ChildrenMirror: Removing nested node ${index}:`, {
        tagName: (removedNode as Element).tagName || removedNode.nodeName,
        id: (removedNode as Element).id || 'N/A',
      });

      const correspondingNode = this.findCorrespondingRemovedNode(
        mutation,
        correspondingTarget,
        nodeFilter,
      );
      if (correspondingNode && correspondingNode.parentNode === correspondingTarget) {
        console.log(`🗑️ ChildrenMirror: Successfully removing corresponding nested node`);
        correspondingTarget.removeChild(correspondingNode);
      } else {
        console.warn(`⚠️ ChildrenMirror: Could not find corresponding nested node to remove`);
      }
    });

    console.log(`➕ ChildrenMirror: Processing ${mutation.addedNodes.length} added nested nodes`);
    // Handle added nodes
    mutation.addedNodes.forEach((addedNode, index) => {
      if (!nodeFilter(addedNode)) {
        console.log(`⏭️ ChildrenMirror: Skipping added nested node ${index} (filtered out)`);
        return;
      }

      console.log(`➕ ChildrenMirror: Adding nested node ${index}:`, {
        tagName: (addedNode as Element).tagName || addedNode.nodeName,
        id: (addedNode as Element).id || 'N/A',
      });

      const clonedNode = this.cloneNodeWithEventForwarding(addedNode as Element);

      // Find the correct insertion point within the corresponding target
      const nextSibling = this.findNextSiblingInParent(
        addedNode,
        mutation.target as Element,
        correspondingTarget,
        nodeFilter,
      );
      if (nextSibling) {
        console.log(`📍 ChildrenMirror: Inserting nested node before next sibling`);
        correspondingTarget.insertBefore(clonedNode, nextSibling);
      } else {
        console.log(`📍 ChildrenMirror: Appending nested node to corresponding target`);
        correspondingTarget.appendChild(clonedNode);
      }
    });

    console.log(`✅ ChildrenMirror: Nested mutation handling complete`);
  }

  /**
   * Handles attribute mutations
   */
  private handleAttributeMutation(mutation: MutationRecord): void {
    console.log(`🏷️ ChildrenMirror: Handling attribute mutation:`, {
      target: {
        tagName: (mutation.target as Element).tagName,
        id: (mutation.target as Element).id || 'N/A',
        className: (mutation.target as Element).className || 'N/A',
      },
      attributeName: mutation.attributeName,
      oldValue: mutation.oldValue,
      newValue: (mutation.target as Element).getAttribute(mutation.attributeName || ''),
      isDirectChild: mutation.target === this.sourceElement,
    });

    let correspondingNode: Node | null = null;

    // Check if this is a direct child attribute mutation or a nested one
    if (mutation.target === this.sourceElement) {
      // This is an attribute mutation on the source element itself
      // In this case, we don't need to mirror it as we're observing children, not the source element
      console.log(`🏷️ ChildrenMirror: Ignoring attribute mutation on source element itself`);
      return;
    } else {
      // This is an attribute mutation on a nested element
      console.log(`🏷️ ChildrenMirror: Finding corresponding nested element for attribute mutation`);
      correspondingNode = this.findCorrespondingNestedElement(mutation.target as Element);
    }

    if (
      correspondingNode &&
      correspondingNode instanceof Element &&
      mutation.target instanceof Element
    ) {
      if (mutation.attributeName) {
        const newValue = mutation.target.getAttribute(mutation.attributeName);
        if (newValue !== null) {
          console.log(`✏️ ChildrenMirror: Setting attribute ${mutation.attributeName}="${newValue}" on corresponding node`);
          correspondingNode.setAttribute(mutation.attributeName, newValue);
        } else {
          console.log(`🗑️ ChildrenMirror: Removing attribute ${mutation.attributeName} from corresponding node`);
          correspondingNode.removeAttribute(mutation.attributeName);
        }
      }
    } else {
      console.warn(`⚠️ ChildrenMirror: Could not find corresponding node for attribute mutation`);
    }
  }

  /**
   * Handles character data mutations (text content changes)
   */
  private handleCharacterDataMutation(mutation: MutationRecord): void {
    console.log(`📝 ChildrenMirror: Handling character data mutation:`, {
      target: {
        nodeName: mutation.target.nodeName,
        parentElement: mutation.target.parentElement ? {
          tagName: (mutation.target.parentElement as Element).tagName,
          id: (mutation.target.parentElement as Element).id || 'N/A',
          className: (mutation.target.parentElement as Element).className || 'N/A',
        } : null,
        oldValue: mutation.oldValue,
        newValue: mutation.target.textContent,
      },
    });

    // For character data mutations, we need to find the corresponding text node
    // which might be nested within other elements
    const correspondingNode = this.findCorrespondingTextNode(mutation.target);
    if (correspondingNode) {
      console.log(`✏️ ChildrenMirror: Updating text content on corresponding text node`);
      correspondingNode.textContent = mutation.target.textContent;
    } else {
      console.warn(`⚠️ ChildrenMirror: Could not find corresponding text node for character data mutation. Doing full resync.`);
      // Fallback: do a full resync to ensure consistency
      this.mirrorAllChildren(this.nodeFilter);
    }
  }

  /**
   * Finds the corresponding node in the target element for a given source node
   */
  private findCorrespondingNode(
    sourceNode: Node,
    nodeFilter: (node: Node) => boolean = () => true,
  ): Node | null {
    // Get all source children and find the index of the source node
    const sourceChildren = Array.from(this.sourceElement.childNodes);
    const sourceIndex = sourceChildren.indexOf(sourceNode as ChildNode);
    if (sourceIndex === -1) return null;

    // Find the filtered index (how many filtered nodes come before this one)
    const filteredSourceIndex = sourceChildren.slice(0, sourceIndex).filter(nodeFilter).length;

    // Get the corresponding target child at the same filtered index
    const targetChildren = Array.from(this.targetElement.childNodes);
    return targetChildren[filteredSourceIndex] || null;
  }

  /**
   * Finds the next sibling in the target that should come after the given source node
   */
  private findNextSiblingInTarget(
    sourceNode: Node,
    nodeFilter: (node: Node) => boolean,
  ): Node | null {
    const sourceChildren = Array.from(this.sourceElement.childNodes);
    const sourceIndex = sourceChildren.indexOf(sourceNode as ChildNode);

    // Count how many filtered nodes should come before the insertion point
    const filteredNodesBeforeInsertion = sourceChildren
      .slice(0, sourceIndex + 1) // Include the current node
      .filter(nodeFilter).length;

    // Find the target node at that position
    const targetChildren = Array.from(this.targetElement.childNodes);
    return targetChildren[filteredNodesBeforeInsertion] || null;
  }

  /**
   * Finds the corresponding element in the target tree for a nested source element
   */
  private findCorrespondingNestedElement(sourceElement: Element): Element | null {
    // Build the path from source root to the target element
    const path: number[] = [];
    let current: Element | null = sourceElement;

    while (current && current !== this.sourceElement) {
      const parent: Element | null = current.parentElement;
      if (!parent) break;

      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(current);
      path.unshift(index);
      current = parent;
    }

    if (current !== this.sourceElement) {
      return null; // sourceElement is not within our source tree
    }

    // Follow the same path in the target tree
    let targetCurrent: Element = this.targetElement;
    for (const index of path) {
      const children = Array.from(targetCurrent.children);
      if (index >= children.length) {
        return null; // Path doesn't exist in target
      }
      targetCurrent = children[index];
    }

    return targetCurrent;
  }

  /**
   * Finds corresponding node within a specific parent element
   */
  private findCorrespondingNodeInParent(
    sourceNode: Node,
    sourceParent: Element,
    targetParent: Element,
    nodeFilter: (node: Node) => boolean,
  ): Node | null {
    const sourceChildren = Array.from(sourceParent.childNodes);
    const sourceIndex = sourceChildren.indexOf(sourceNode as ChildNode);
    if (sourceIndex === -1) return null;

    const filteredSourceIndex = sourceChildren.slice(0, sourceIndex).filter(nodeFilter).length;

    const targetChildren = Array.from(targetParent.childNodes);
    return targetChildren[filteredSourceIndex] || null;
  }

  /**
   * Finds next sibling within a specific parent element
   */
  private findNextSiblingInParent(
    sourceNode: Node,
    sourceParent: Element,
    targetParent: Element,
    nodeFilter: (node: Node) => boolean,
  ): Node | null {
    const sourceChildren = Array.from(sourceParent.childNodes);
    const sourceIndex = sourceChildren.indexOf(sourceNode as ChildNode);

    const filteredNodesBeforeInsertion = sourceChildren
      .slice(0, sourceIndex + 1)
      .filter(nodeFilter).length;

    const targetChildren = Array.from(targetParent.childNodes);
    return targetChildren[filteredNodesBeforeInsertion] || null;
  }

  /**
   * Finds the corresponding text node in the target tree for character data mutations
   */
  private findCorrespondingTextNode(sourceTextNode: Node): Node | null {
    // Get the parent element of the text node
    const parentElement = sourceTextNode.parentElement;
    if (!parentElement) {
      console.log(`📝 ChildrenMirror: Text node has no parent element`);
      return null;
    }

    // Find the corresponding parent element in the target
    let correspondingParent: Element;
    if (parentElement === this.sourceElement) {
      // Text node is a direct child of the source element
      correspondingParent = this.targetElement;
    } else {
      // Text node is nested, find the corresponding nested element
      const nestedParent = this.findCorrespondingNestedElement(parentElement);
      if (!nestedParent) {
        console.log(`📝 ChildrenMirror: Could not find corresponding parent for text node`);
        return null;
      }
      correspondingParent = nestedParent;
    }

    // Find the text node's position among its parent's child nodes
    const parentChildren = Array.from(parentElement.childNodes);
    const textNodeIndex = parentChildren.indexOf(sourceTextNode as ChildNode);
    
    if (textNodeIndex === -1) {
      console.log(`📝 ChildrenMirror: Could not find text node in parent's children`);
      return null;
    }

    // Get the corresponding child node at the same position
    const correspondingChildren = Array.from(correspondingParent.childNodes);
    const correspondingNode = correspondingChildren[textNodeIndex];

    if (correspondingNode && correspondingNode.nodeType === Node.TEXT_NODE) {
      console.log(`📝 ChildrenMirror: Found corresponding text node at index ${textNodeIndex}`);
      return correspondingNode;
    } else {
      console.log(`📝 ChildrenMirror: Node at index ${textNodeIndex} is not a text node or doesn't exist`);
      return null;
    }
  }

  /**
   * Finds the corresponding node to remove using sibling information from the mutation
   * This is needed because removed nodes are no longer in the DOM when the callback runs
   */
  private findCorrespondingRemovedNode(
    mutation: MutationRecord,
    targetParent: Element,
    nodeFilter: (node: Node) => boolean,
  ): Node | null {
    // Try to use previousSibling to find the position
    if (mutation.previousSibling) {
      let correspondingPrevious: Node | null = null;

      // For nested mutations, find the corresponding sibling in the target parent
      if (mutation.target === this.sourceElement) {
        correspondingPrevious = this.findCorrespondingNode(mutation.previousSibling, nodeFilter);
      } else {
        correspondingPrevious = this.findCorrespondingNodeInParent(
          mutation.previousSibling,
          mutation.target as Element,
          targetParent,
          nodeFilter,
        );
      }

      if (correspondingPrevious && correspondingPrevious.nextSibling) {
        return correspondingPrevious.nextSibling;
      }
    }

    // Try to use nextSibling to find the position
    if (mutation.nextSibling) {
      let correspondingNext: Node | null = null;

      // For nested mutations, find the corresponding sibling in the target parent
      if (mutation.target === this.sourceElement) {
        correspondingNext = this.findCorrespondingNode(mutation.nextSibling, nodeFilter);
      } else {
        correspondingNext = this.findCorrespondingNodeInParent(
          mutation.nextSibling,
          mutation.target as Element,
          targetParent,
          nodeFilter,
        );
      }

      if (correspondingNext && correspondingNext.previousSibling) {
        return correspondingNext.previousSibling;
      }
    }

    // Fallback: assume it was the first or last filtered child
    const targetChildren = Array.from(targetParent.childNodes).filter(nodeFilter);

    // If there are no siblings, it was likely the only/first child
    if (!mutation.previousSibling && !mutation.nextSibling) {
      return targetChildren[0] || null;
    }

    // If there's no previousSibling, it was the first child
    if (!mutation.previousSibling) {
      return targetChildren[0] || null;
    }

    // If there's no nextSibling, it was the last child
    if (!mutation.nextSibling) {
      return targetChildren[targetChildren.length - 1] || null;
    }

    return null;
  }

  /**
   * Manually trigger a full re-sync of children
   */
  public resync(nodeFilter?: (node: Node) => boolean): void {
    if (this.isDisposed) return;
    this.mirrorAllChildren(nodeFilter || this.nodeFilter);
  }

  /**
   * Dispose of the mirror and stop observing
   */
  public dispose(): void {
    if (this.isDisposed) return;

    this.mutationObserver.disconnect();
    this.isDisposed = true;
  }

  /**
   * Check if the mirror is disposed
   */
  public get disposed(): boolean {
    return this.isDisposed;
  }

  /**
   * Get the source element
   */
  public getSourceElement(): Element {
    return this.sourceElement;
  }

  /**
   * Get the target element
   */
  public getTargetElement(): Element {
    return this.targetElement;
  }
}

/**
 * Convenience function to create a children mirror
 */
export function createChildrenMirror(
  sourceElement: Element,
  targetElement: Element,
  options?: {
    /** Whether to mirror existing children immediately (default: true) */
    mirrorExisting?: boolean;
    /** Whether to observe subtree changes (default: false) */
    subtree?: boolean;
    /** Whether to mirror attributes of children (default: true) */
    attributes?: boolean;
    /** Whether to mirror text content changes (default: true) */
    characterData?: boolean;
    /** Custom filter function to determine which nodes to mirror */
    nodeFilter?: (node: Node) => boolean;
    /** Whether to forward click events from mirrors to originals (default: true) */
    forwardEvents?: boolean;
  },
): ChildrenMirror {
  return new ChildrenMirror(sourceElement, targetElement, options);
}
