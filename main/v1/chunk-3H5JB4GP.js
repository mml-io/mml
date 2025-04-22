// ../../node_modules/@mml-io/networked-dom-protocol/build/index.js
var networkedDOMProtocolSubProtocol_v0_1 = "networked-dom-v0.1";
var textDecoder = new TextDecoder();
var BufferReader = class {
  constructor(buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }
  readUInt8() {
    return this.buffer[this.offset++];
  }
  readBoolean() {
    return this.readUInt8() === 1;
  }
  readUVarint(signed = false) {
    let lo = 0;
    let hi = 0;
    let i = 0;
    for (; i < 4; ++i) {
      lo = (lo | (this.buffer[this.offset] & 127) << i * 7) >>> 0;
      if (this.buffer[this.offset++] < 128) {
        return signed ? loAndHiAsSigned(lo, hi) : loAndHiAsUnsigned(lo, hi);
      }
    }
    lo = (lo | (this.buffer[this.offset] & 127) << 28) >>> 0;
    hi = (hi | (this.buffer[this.offset] & 127) >> 4) >>> 0;
    if (this.buffer[this.offset++] < 128) {
      return signed ? loAndHiAsSigned(lo, hi) : loAndHiAsUnsigned(lo, hi);
    }
    i = 0;
    for (; i < 5; ++i) {
      hi = (hi | (this.buffer[this.offset] & 127) << i * 7 + 3) >>> 0;
      if (this.buffer[this.offset++] < 128) {
        return signed ? loAndHiAsSigned(lo, hi) : loAndHiAsUnsigned(lo, hi);
      }
    }
    throw Error("invalid varint encoding");
  }
  readUVarintPrefixedString() {
    const readLength = this.readUVarint();
    let string = "";
    let hasNonAscii = false;
    for (let i = 0; i < readLength; i++) {
      const charValue = this.buffer[this.offset + i];
      if (charValue < 128) {
        string += String.fromCharCode(charValue);
      } else {
        hasNonAscii = true;
        break;
      }
    }
    if (!hasNonAscii) {
      this.offset += readLength;
      return string;
    }
    const result = textDecoder.decode(this.buffer.subarray(this.offset, this.offset + readLength));
    this.offset += readLength;
    return result;
  }
  // returns the string and a boolean indicating if the string was negative length
  readVarintPrefixedString() {
    const length = this.readVarint();
    const negativeLength = length < 0;
    const readLength = negativeLength ? -length : length;
    let string = "";
    let hasNonAscii = false;
    for (let i = 0; i < readLength; i++) {
      const charValue = this.buffer[this.offset + i];
      if (charValue < 128) {
        string += String.fromCharCode(charValue);
      } else {
        hasNonAscii = true;
        break;
      }
    }
    if (!hasNonAscii) {
      this.offset += readLength;
      return [string, negativeLength];
    }
    const result = textDecoder.decode(this.buffer.subarray(this.offset, this.offset + readLength));
    this.offset += readLength;
    return [result, negativeLength];
  }
  readVarint() {
    return this.readUVarint(true);
  }
  isEnd() {
    return this.offset >= this.buffer.length;
  }
};
function loAndHiAsSigned(lo, hi) {
  const value = lo + hi * 4294967296;
  if (value & 1) {
    return -(value + 1) / 2;
  }
  return value / 2;
}
function loAndHiAsUnsigned(lo, hi) {
  return lo + hi * 4294967296;
}
var textEncoder = new TextEncoder();
var BufferWriter = class {
  constructor(initialLength) {
    this.buffer = new Uint8Array(initialLength);
    this.offset = 0;
  }
  // Write an unsigned 8-bit integer
  writeUint8(value) {
    this.ensureCapacity(1);
    this.buffer[this.offset] = value & 255;
    this.offset += 1;
  }
  writeBoolean(bool) {
    this.writeUint8(bool ? 1 : 0);
  }
  // Write an array of bytes
  writeBytes(bytes) {
    this.ensureCapacity(bytes.byteLength);
    this.buffer.set(bytes, this.offset);
    this.offset += bytes.byteLength;
  }
  // Get the written bytes as a Uint8Array
  getBuffer() {
    return this.buffer.subarray(0, this.offset);
  }
  getWrittenLength() {
    return this.offset;
  }
  // Ensure there is enough capacity in the buffer
  ensureCapacity(neededSpace) {
    while (this.offset + neededSpace > this.buffer.length) {
      this.expandBuffer();
    }
  }
  // Expand the buffer by doubling its current length
  expandBuffer() {
    const newBuffer = new Uint8Array(this.buffer.length * 2);
    newBuffer.set(this.buffer);
    this.buffer = newBuffer;
  }
  writeUVarint(x) {
    if (x <= 268435455) {
      this.ensureCapacity(4);
      while (x >= 128) {
        this.buffer[this.offset] = x & 127 | 128;
        this.offset++;
        x >>>= 7;
      }
      this.buffer[this.offset] = x & 127;
      this.offset++;
      return;
    }
    this.ensureCapacity(10);
    let lo = 0;
    let hi = 0;
    if (x !== 0) {
      lo = x >>> 0;
      hi = (x - lo) / 4294967296 >>> 0;
    }
    while (hi) {
      this.buffer[this.offset++] = lo & 127 | 128;
      lo = (lo >>> 7 | hi << 25) >>> 0;
      hi >>>= 7;
    }
    while (lo > 127) {
      this.buffer[this.offset++] = lo & 127 | 128;
      lo = lo >>> 7;
    }
    this.buffer[this.offset++] = lo;
  }
  writeVarint(x) {
    if (x >= 0) {
      this.writeUVarint(x * 2);
    } else {
      this.writeUVarint(-x * 2 - 1);
    }
  }
  writeLengthPrefixedString(value, varint = false, negativeLength = false) {
    const originalOffset = this.offset;
    if (varint) {
      this.writeVarint(negativeLength ? -value.length : value.length);
    } else {
      this.writeUVarint(value.length);
    }
    this.ensureCapacity(value.length);
    let nonAscii = false;
    for (let i = 0; i < value.length; i++) {
      const charCode = value.charCodeAt(i);
      if (charCode > 127) {
        nonAscii = true;
        break;
      }
      this.buffer[this.offset++] = charCode;
    }
    if (!nonAscii) {
      return;
    }
    this.offset = originalOffset;
    let encodedLength = value.length;
    this.ensureCapacity(encodedLength);
    while (true) {
      this.offset = originalOffset;
      if (varint) {
        this.writeVarint(negativeLength ? -encodedLength : encodedLength);
      } else {
        this.writeUVarint(encodedLength);
      }
      const offsetAfterVarint = this.offset;
      const varintLength = offsetAfterVarint - originalOffset;
      const writeBuffer = new Uint8Array(this.buffer.buffer, this.offset);
      const { read, written } = textEncoder.encodeInto(value, writeBuffer);
      if (read !== value.length) {
        this.expandBuffer();
        continue;
      }
      if (written !== encodedLength) {
        encodedLength = written;
        this.offset = originalOffset;
        if (varint) {
          this.writeVarint(negativeLength ? -encodedLength : encodedLength);
        } else {
          this.writeUVarint(encodedLength);
        }
        const newOffsetAfterVarint = this.offset;
        const actualVarintLength = newOffsetAfterVarint - originalOffset;
        if (actualVarintLength !== varintLength) {
          continue;
        } else {
        }
      }
      this.offset += written;
      return;
    }
  }
};
function decodeAttributes(buffer) {
  const attributesLength = buffer.readUVarint();
  const attributes = [];
  for (let i = 0; i < attributesLength; i++) {
    const [key, negativeLength] = buffer.readVarintPrefixedString();
    if (negativeLength) {
      attributes.push([key, null]);
      continue;
    }
    const value = buffer.readUVarintPrefixedString();
    attributes.push([key, value]);
  }
  return attributes;
}
function decodeNodeDescription(buffer) {
  const nodeId = buffer.readUVarint();
  const tag = buffer.readUVarintPrefixedString();
  if (tag === "") {
    const text = buffer.readUVarintPrefixedString();
    return { type: "text", nodeId, text };
  }
  const attributes = decodeAttributes(buffer);
  const visibleToLength = buffer.readUVarint();
  let visibleTo;
  if (visibleToLength !== 0) {
    visibleTo = [];
    for (let i = 0; i < visibleToLength; i++) {
      visibleTo.push(buffer.readUVarint());
    }
  }
  const hiddenFromLength = buffer.readUVarint();
  let hiddenFrom;
  if (hiddenFromLength !== 0) {
    hiddenFrom = [];
    for (let i = 0; i < hiddenFromLength; i++) {
      hiddenFrom.push(buffer.readUVarint());
    }
  }
  const childrenLength = buffer.readUVarint();
  const children = [];
  for (let i = 0; i < childrenLength; i++) {
    children.push(decodeNodeDescription(buffer));
  }
  const node = {
    type: "element",
    nodeId,
    tag,
    attributes,
    children
  };
  if (visibleTo) {
    node.visibleTo = visibleTo;
  }
  if (hiddenFrom) {
    node.hiddenFrom = hiddenFrom;
  }
  return node;
}
var networkedDOMProtocolSubProtocol_v0_2 = "networked-dom-v0.2";
var SnapshotMessageType = 1;
var BatchStartMessageType = 2;
var DocumentTimeMessageType = 3;
var ChildrenAddedMessageType = 4;
var ChildrenRemovedMessageType = 5;
var AttributesChangedMessageType = 6;
var ChangeVisibleToMessageType = 7;
var ChangeHiddenFromMessageType = 8;
var TextChangedMessageType = 9;
var BatchEndMessageType = 10;
var PingMessageType = 11;
var WarningMessageType = 12;
var ErrorMessageType = 13;
var ConnectUsersMessageType = 14;
var DisconnectUsersMessageType = 15;
var EventMessageType = 16;
var PongMessageType = 17;
function encodeConnectUsers(connectUsersMessage, writer) {
  const connectionIdsLength = connectUsersMessage.connectionIds.length;
  writer.writeUint8(ConnectUsersMessageType);
  writer.writeUVarint(connectionIdsLength);
  for (let i = 0; i < connectionIdsLength; i++) {
    writer.writeUVarint(connectUsersMessage.connectionIds[i]);
  }
}
function encodeDisconnectUsers(disconnectUsersMessage, writer) {
  const connectionIdsLength = disconnectUsersMessage.connectionIds.length;
  writer.writeUint8(DisconnectUsersMessageType);
  writer.writeUVarint(connectionIdsLength);
  for (let i = 0; i < connectionIdsLength; i++) {
    writer.writeUVarint(disconnectUsersMessage.connectionIds[i]);
  }
}
function encodeEvent(event, writer) {
  writer.writeUint8(EventMessageType);
  writer.writeUVarint(event.nodeId);
  writer.writeUVarint(event.connectionId);
  writer.writeLengthPrefixedString(event.name);
  writer.writeBoolean(event.bubbles);
  writer.writeLengthPrefixedString(JSON.stringify(event.params));
}
function encodePong(pongMessage, writer) {
  writer.writeUint8(PongMessageType);
  writer.writeUVarint(pongMessage.pong);
}
function decodeAttributesChanged(buffer) {
  const nodeId = buffer.readUVarint();
  const attributes = decodeAttributes(buffer);
  return {
    type: "attributesChanged",
    nodeId,
    attributes
  };
}
var batchEndMessage = {
  type: "batchEnd"
};
var batchStartMessage = {
  type: "batchStart"
};
function decodeChangeHiddenFrom(buffer) {
  const nodeId = buffer.readUVarint();
  const addHiddenFromLength = buffer.readUVarint();
  const addHiddenFrom = [];
  for (let i = 0; i < addHiddenFromLength; i++) {
    addHiddenFrom.push(buffer.readUVarint());
  }
  const removeHiddenFromLength = buffer.readUVarint();
  const removeHiddenFrom = [];
  for (let i = 0; i < removeHiddenFromLength; i++) {
    removeHiddenFrom.push(buffer.readUVarint());
  }
  return {
    type: "changeHiddenFrom",
    nodeId,
    addHiddenFrom,
    removeHiddenFrom
  };
}
function decodeChangeVisibleTo(buffer) {
  const nodeId = buffer.readUVarint();
  const addVisibleToLength = buffer.readUVarint();
  const addVisibleTo = [];
  for (let i = 0; i < addVisibleToLength; i++) {
    addVisibleTo.push(buffer.readUVarint());
  }
  const removeVisibleToLength = buffer.readUVarint();
  const removeVisibleTo = [];
  for (let i = 0; i < removeVisibleToLength; i++) {
    removeVisibleTo.push(buffer.readUVarint());
  }
  return {
    type: "changeVisibleTo",
    nodeId,
    addVisibleTo,
    removeVisibleTo
  };
}
function decodeChildrenAdded(buffer) {
  const nodeId = buffer.readUVarint();
  const previousNodeId = buffer.readUVarint();
  const childrenLength = buffer.readUVarint();
  const children = [];
  for (let i = 0; i < childrenLength; i++) {
    children.push(decodeNodeDescription(buffer));
  }
  return {
    type: "childrenAdded",
    nodeId,
    previousNodeId: previousNodeId === 0 ? null : previousNodeId,
    addedNodes: children
  };
}
function decodeChildrenRemoved(buffer) {
  const nodeId = buffer.readUVarint();
  const removedNodesLength = buffer.readUVarint();
  const removedNodes = [];
  for (let i = 0; i < removedNodesLength; i++) {
    removedNodes.push(buffer.readUVarint());
  }
  return {
    type: "childrenRemoved",
    nodeId,
    removedNodes
  };
}
function decodeDocumentTime(buffer) {
  return {
    type: "documentTime",
    documentTime: buffer.readUVarint()
  };
}
function decodeError(buffer) {
  const message = buffer.readUVarintPrefixedString();
  return {
    type: "error",
    message
  };
}
function decodePing(buffer) {
  const ping = buffer.readUVarint();
  const documentTime = buffer.readUVarint();
  return {
    type: "ping",
    ping,
    documentTime
  };
}
function decodeSnapshot(buffer) {
  return {
    type: "snapshot",
    snapshot: decodeNodeDescription(buffer),
    documentTime: buffer.readUVarint()
  };
}
function decodeTextChanged(buffer) {
  const nodeId = buffer.readUVarint();
  const text = buffer.readUVarintPrefixedString();
  return {
    type: "textChanged",
    nodeId,
    text
  };
}
function decodeWarning(buffer) {
  const message = buffer.readUVarintPrefixedString();
  return {
    type: "warning",
    message
  };
}
function decodeServerMessages(buffer) {
  const messages = [];
  while (!buffer.isEnd()) {
    const messageType = buffer.readUInt8();
    switch (messageType) {
      case SnapshotMessageType:
        messages.push(decodeSnapshot(buffer));
        break;
      case DocumentTimeMessageType:
        messages.push(decodeDocumentTime(buffer));
        break;
      case ChildrenAddedMessageType:
        messages.push(decodeChildrenAdded(buffer));
        break;
      case ChildrenRemovedMessageType:
        messages.push(decodeChildrenRemoved(buffer));
        break;
      case AttributesChangedMessageType:
        messages.push(decodeAttributesChanged(buffer));
        break;
      case TextChangedMessageType:
        messages.push(decodeTextChanged(buffer));
        break;
      case ChangeVisibleToMessageType:
        messages.push(decodeChangeVisibleTo(buffer));
        break;
      case ChangeHiddenFromMessageType:
        messages.push(decodeChangeHiddenFrom(buffer));
        break;
      case BatchStartMessageType:
        messages.push(batchStartMessage);
        break;
      case BatchEndMessageType:
        messages.push(batchEndMessage);
        break;
      case PingMessageType:
        messages.push(decodePing(buffer));
        break;
      case WarningMessageType:
        messages.push(decodeWarning(buffer));
        break;
      case ErrorMessageType:
        messages.push(decodeError(buffer));
        break;
      default:
        throw new Error(`Unknown message type: ${messageType}`);
    }
  }
  return messages;
}
function encodeClientMessage(message, writer) {
  const type = message.type;
  switch (type) {
    case "connectUsers":
      return encodeConnectUsers(message, writer);
    case "disconnectUsers":
      return encodeDisconnectUsers(message, writer);
    case "event":
      return encodeEvent(message, writer);
    case "pong":
      return encodePong(message, writer);
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

// ../../node_modules/@mml-io/networked-dom-web/build/index.js
var DOMSanitizer = class _DOMSanitizer {
  static sanitise(node, options = {}) {
    if (node.getAttributeNames) {
      for (const attr of node.getAttributeNames()) {
        if (!_DOMSanitizer.IsValidAttributeName(attr)) {
          node.removeAttribute(attr);
        }
      }
    }
    if (node instanceof HTMLElement) {
      if (options.tagPrefix) {
        const tag = node.nodeName.toLowerCase();
        if (!tag.startsWith(options.tagPrefix.toLowerCase())) {
          node = _DOMSanitizer.replaceNodeTagName(
            node,
            options.replacementTagPrefix ? options.replacementTagPrefix + tag : `x-${tag}`
          );
        }
      }
    }
    if (node.nodeName === "SCRIPT" || node.nodeName === "OBJECT" || node.nodeName === "IFRAME") {
      node.innerHTML = "";
      _DOMSanitizer.stripAllAttributes(node);
    } else {
      if (node.getAttributeNames) {
        for (const attr of node.getAttributeNames()) {
          if (!_DOMSanitizer.shouldAcceptAttribute(attr)) {
            node.removeAttribute(attr);
          }
        }
      }
      for (let i = 0; i < node.childNodes.length; i++) {
        _DOMSanitizer.sanitise(node.childNodes[i], options);
      }
    }
    return node;
  }
  static replaceNodeTagName(node, newTagName) {
    var _a;
    const replacementNode = document.createElement(newTagName);
    let index;
    while (node.firstChild) {
      replacementNode.appendChild(node.firstChild);
    }
    for (index = node.attributes.length - 1; index >= 0; --index) {
      replacementNode.setAttribute(node.attributes[index].name, node.attributes[index].value);
    }
    (_a = node.parentNode) == null ? void 0 : _a.replaceChild(replacementNode, node);
    return replacementNode;
  }
  static stripAllAttributes(node) {
    if (node.getAttributeNames) {
      for (const attr of node.getAttributeNames()) {
        node.removeAttribute(attr);
      }
    }
  }
  static IsASCIIDigit(c) {
    return c >= "0" && c <= "9";
  }
  static IsASCIIAlpha(c) {
    return c >= "a" && c <= "z";
  }
  static IsValidAttributeName(characters) {
    const c = characters[0];
    if (!(_DOMSanitizer.IsASCIIAlpha(c) || c === ":" || c === "_")) {
      return false;
    }
    for (let i = 1; i < characters.length; i++) {
      const c2 = characters[i];
      if (!(_DOMSanitizer.IsASCIIDigit(c2) || _DOMSanitizer.IsASCIIAlpha(c2) || c2 === ":" || c2 === "_" || c2 === "-" || c2 === ".")) {
        return false;
      }
    }
    return true;
  }
  static shouldAcceptAttribute(attribute) {
    if (!_DOMSanitizer.IsValidAttributeName(attribute)) {
      console.warn("Invalid attribute name", attribute);
      return false;
    }
    return !attribute.startsWith("on");
  }
};
var NetworkedDOMWebsocketV01Adapter = class {
  constructor(websocket, parentElement, connectedCallback, timeCallback, options = {}) {
    this.websocket = websocket;
    this.parentElement = parentElement;
    this.connectedCallback = connectedCallback;
    this.timeCallback = timeCallback;
    this.options = options;
    this.idToElement = /* @__PURE__ */ new Map();
    this.elementToId = /* @__PURE__ */ new Map();
    this.currentRoot = null;
    this.websocket.binaryType = "arraybuffer";
  }
  handleEvent(element, event) {
    const nodeId = this.elementToId.get(element);
    if (nodeId === void 0 || nodeId === null) {
      throw new Error("Element not found");
    }
    const detailWithoutElement = {
      ...event.detail
    };
    delete detailWithoutElement.element;
    const remoteEvent = {
      type: "event",
      nodeId,
      name: event.type,
      bubbles: event.bubbles,
      params: detailWithoutElement
    };
    this.send(remoteEvent);
  }
  send(fromClientMessage) {
    this.websocket.send(JSON.stringify(fromClientMessage));
  }
  clearContents() {
    this.idToElement.clear();
    this.elementToId.clear();
    if (this.currentRoot) {
      this.currentRoot.remove();
      this.currentRoot = null;
      return true;
    }
    return false;
  }
  receiveMessage(event) {
    const messages = JSON.parse(event.data);
    for (const message of messages) {
      switch (message.type) {
        case "error":
          console.error("Error from server", message);
          break;
        case "warning":
          console.warn("Warning from server", message);
          break;
        default: {
          if (message.documentTime) {
            if (this.timeCallback) {
              this.timeCallback(message.documentTime);
            }
          }
          switch (message.type) {
            case "snapshot":
              this.handleSnapshot(message);
              this.connectedCallback();
              break;
            case "attributeChange":
              this.handleAttributeChange(message);
              break;
            case "childrenChanged":
              this.handleChildrenChanged(message);
              break;
            case "textChanged":
              this.handleTextChanged(message);
              break;
            case "ping":
              this.send({
                type: "pong",
                pong: message.ping
              });
              break;
            default:
              console.warn("unknown message type", message);
              break;
          }
        }
      }
    }
  }
  handleTextChanged(message) {
    const { nodeId, text } = message;
    if (nodeId === void 0 || nodeId === null) {
      console.warn("No nodeId in textChanged message");
      return;
    }
    const node = this.idToElement.get(nodeId);
    if (!node) {
      throw new Error("No node found for textChanged message");
    }
    if (!isText(node, this.parentElement)) {
      throw new Error("Node for textChanged message is not a Text node");
    }
    node.textContent = text;
  }
  handleChildrenChanged(message) {
    const { nodeId, addedNodes, removedNodes, previousNodeId } = message;
    if (nodeId === void 0 || nodeId === null) {
      console.warn("No nodeId in childrenChanged message");
      return;
    }
    const parent = this.idToElement.get(nodeId);
    if (!parent) {
      throw new Error("No parent found for childrenChanged message");
    }
    if (!parent.isConnected) {
      console.error("Parent is not connected", parent);
    }
    if (!isHTMLElement(parent, this.parentElement)) {
      throw new Error("Parent is not an HTMLElement (that supports children)");
    }
    let nextElement = null;
    let previousElement = null;
    if (previousNodeId) {
      previousElement = this.idToElement.get(previousNodeId);
      if (!previousElement) {
        throw new Error("No previous element found for childrenChanged message");
      }
      nextElement = previousElement.nextSibling;
    }
    const elementsToAdd = [];
    for (const addedNode of addedNodes) {
      const childElement = this.handleNewElement(addedNode);
      if (childElement) {
        elementsToAdd.push(childElement);
      }
    }
    if (elementsToAdd.length) {
      if (previousElement) {
        if (nextElement) {
          const docFrag = new DocumentFragment();
          docFrag.append(...elementsToAdd);
          parent.insertBefore(docFrag, nextElement);
        } else {
          parent.append(...elementsToAdd);
        }
      } else {
        parent.prepend(...elementsToAdd);
      }
    }
    for (const removedNode of removedNodes) {
      const childElement = this.idToElement.get(removedNode);
      if (!childElement) {
        throw new Error(`Child element not found: ${removedNode}`);
      }
      this.elementToId.delete(childElement);
      this.idToElement.delete(removedNode);
      parent.removeChild(childElement);
      if (isHTMLElement(childElement, this.parentElement)) {
        this.removeChildElementIds(childElement);
      }
    }
  }
  removeChildElementIds(parent) {
    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i];
      const childId = this.elementToId.get(child);
      if (!childId) {
        console.error("Inner child of removed element had no id", child);
      } else {
        this.elementToId.delete(child);
        this.idToElement.delete(childId);
      }
      this.removeChildElementIds(child);
    }
  }
  handleSnapshot(message) {
    if (this.currentRoot) {
      this.currentRoot.remove();
      this.currentRoot = null;
      this.elementToId.clear();
      this.idToElement.clear();
    }
    const element = this.handleNewElement(message.snapshot);
    if (!element) {
      throw new Error("Snapshot element not created");
    }
    if (!isHTMLElement(element, this.parentElement)) {
      throw new Error("Snapshot element is not an HTMLElement");
    }
    this.currentRoot = element;
    this.parentElement.append(element);
  }
  handleAttributeChange(message) {
    const { nodeId, attribute, newValue } = message;
    if (nodeId === void 0 || nodeId === null) {
      console.warn("No nodeId in attributeChange message");
      return;
    }
    const element = this.idToElement.get(nodeId);
    if (element) {
      if (isHTMLElement(element, this.parentElement)) {
        if (newValue === null) {
          element.removeAttribute(attribute);
        } else {
          if (DOMSanitizer.shouldAcceptAttribute(attribute)) {
            element.setAttribute(attribute, newValue);
          }
        }
      } else {
        console.error("Element is not an HTMLElement and cannot support attributes", element);
      }
    } else {
      console.error("No element found for attributeChange message");
    }
  }
  handleNewElement(message) {
    if (message.type === "text") {
      const { nodeId: nodeId2, text: text2 } = message;
      const textNode = document.createTextNode("");
      textNode.textContent = text2;
      this.idToElement.set(nodeId2, textNode);
      this.elementToId.set(textNode, nodeId2);
      return textNode;
    }
    const { tag, nodeId, attributes, children, text } = message;
    if (nodeId === void 0 || nodeId === null) {
      console.warn("No nodeId in handleNewElement message", message);
      return null;
    }
    if (this.idToElement.has(nodeId)) {
      console.error(
        "Received nodeId to add that is already present",
        nodeId,
        this.idToElement.get(nodeId)
      );
    }
    if (tag === "#text") {
      const textNode = document.createTextNode("");
      textNode.textContent = text || null;
      this.idToElement.set(nodeId, textNode);
      this.elementToId.set(textNode, nodeId);
      return textNode;
    }
    let element;
    try {
      let filteredTag = tag;
      if (this.options.tagPrefix) {
        if (!tag.toLowerCase().startsWith(this.options.tagPrefix.toLowerCase())) {
          filteredTag = this.options.replacementTagPrefix ? this.options.replacementTagPrefix + tag : `x-${tag}`;
        }
      }
      element = document.createElement(filteredTag);
    } catch (e) {
      console.error(`Error creating element: (${tag})`, e);
      element = document.createElement("x-div");
    }
    this.idToElement.set(nodeId, element);
    this.elementToId.set(element, nodeId);
    for (const key in attributes) {
      if (DOMSanitizer.shouldAcceptAttribute(key)) {
        const value = attributes[key];
        element.setAttribute(key, value);
      }
    }
    if (children) {
      for (const child of children) {
        const childElement = this.handleNewElement(child);
        if (childElement) {
          element.append(childElement);
        }
      }
    }
    return element;
  }
};
var connectionId = 1;
var hiddenTag = "x-hidden";
var NetworkedDOMWebsocketV02Adapter = class {
  constructor(websocket, parentElement, connectedCallback, timeCallback, options = {}) {
    this.websocket = websocket;
    this.parentElement = parentElement;
    this.connectedCallback = connectedCallback;
    this.timeCallback = timeCallback;
    this.options = options;
    this.idToElement = /* @__PURE__ */ new Map();
    this.elementToId = /* @__PURE__ */ new Map();
    this.hiddenPlaceholderElements = /* @__PURE__ */ new Map();
    this.currentRoot = null;
    this.batchMode = false;
    this.batchMessages = [];
    this.websocket.binaryType = "arraybuffer";
    this.send({ type: "connectUsers", connectionIds: [connectionId] });
  }
  handleEvent(element, event) {
    const nodeId = this.elementToId.get(element);
    if (nodeId === void 0 || nodeId === null) {
      console.error("Element not found for event", { nodeId, element, event });
      return;
    }
    const detailWithoutElement = {
      ...event.detail
    };
    delete detailWithoutElement.element;
    const remoteEvent = {
      type: "event",
      nodeId,
      connectionId,
      name: event.type,
      bubbles: event.bubbles,
      params: detailWithoutElement
    };
    this.send(remoteEvent);
  }
  send(message) {
    const writer = new BufferWriter(256);
    encodeClientMessage(message, writer);
    this.websocket.send(writer.getBuffer());
  }
  clearContents() {
    this.idToElement.clear();
    this.elementToId.clear();
    if (this.currentRoot) {
      this.currentRoot.remove();
      this.currentRoot = null;
      return true;
    }
    return false;
  }
  receiveMessage(event) {
    const reader = new BufferReader(new Uint8Array(event.data));
    const messages = decodeServerMessages(reader);
    for (const message of messages) {
      if (message.type === "batchStart") {
        this.batchMode = true;
      } else if (message.type === "batchEnd") {
        this.batchMode = false;
        for (const message2 of this.batchMessages) {
          this.applyMessage(message2);
        }
        this.batchMessages = [];
      } else {
        if (this.batchMode) {
          this.batchMessages.push(message);
        } else {
          this.applyMessage(message);
        }
      }
    }
  }
  applyMessage(message) {
    switch (message.type) {
      case "error":
        console.error("Error from server", message);
        break;
      case "warning":
        console.warn("Warning from server", message);
        break;
      case "snapshot":
        this.handleSnapshot(message);
        this.connectedCallback();
        break;
      case "attributesChanged":
        this.handleAttributeChange(message);
        break;
      case "documentTime":
        this.handleDocumentTime(message);
        break;
      case "childrenAdded":
        this.handleChildrenAdded(message);
        break;
      case "changeHiddenFrom":
        this.handleChangeHiddenFrom(message);
        break;
      case "changeVisibleTo":
        break;
      case "childrenRemoved":
        this.handleChildrenRemoved(message);
        break;
      case "textChanged":
        this.handleTextChanged(message);
        break;
      case "ping":
        this.handlePing(message);
        break;
      default:
        console.warn("unknown message type", message);
        break;
    }
  }
  handleTextChanged(message) {
    const { nodeId, text } = message;
    if (nodeId === void 0 || nodeId === null) {
      console.warn("No nodeId in textChanged message");
      return;
    }
    const node = this.idToElement.get(nodeId);
    if (!node) {
      throw new Error("No node found for textChanged message");
    }
    if (!isText(node, this.parentElement)) {
      throw new Error("Node for textChanged message is not a Text node");
    }
    node.textContent = text;
  }
  handleChangeHiddenFrom(message) {
    const { nodeId, addHiddenFrom, removeHiddenFrom } = message;
    const node = this.idToElement.get(nodeId);
    const hiddenElement = this.hiddenPlaceholderElements.get(nodeId);
    if (addHiddenFrom.length > 0 && addHiddenFrom.indexOf(connectionId) !== -1) {
      if (hiddenElement) {
        return;
      }
      if (!node) {
        throw new Error("No node found for changeHiddenFrom message");
      }
      const parent = node.parentElement;
      if (!parent) {
        throw new Error("Node has no parent");
      }
      const placeholder = document.createElement(hiddenTag);
      parent.replaceChild(placeholder, node);
      this.hiddenPlaceholderElements.set(nodeId, { placeholder, element: node });
    } else if (removeHiddenFrom.length > 0 && removeHiddenFrom.indexOf(connectionId) !== -1) {
      if (!hiddenElement) {
        return;
      }
      const { placeholder, element } = hiddenElement;
      const parent = placeholder.parentElement;
      if (!parent) {
        throw new Error("Placeholder has no parent");
      }
      parent.replaceChild(element, placeholder);
      this.hiddenPlaceholderElements.delete(nodeId);
    }
  }
  handleChildrenAdded(message) {
    const { nodeId, addedNodes, previousNodeId } = message;
    if (nodeId === void 0 || nodeId === null) {
      console.warn("No nodeId in childrenChanged message");
      return;
    }
    let parent = this.idToElement.get(nodeId);
    if (!parent) {
      throw new Error("No parent found for childrenChanged message");
    }
    const hiddenParent = this.hiddenPlaceholderElements.get(nodeId);
    if (hiddenParent) {
      parent = hiddenParent.element;
    } else {
      if (!parent.isConnected) {
        console.error("Parent is not connected", parent);
      }
    }
    if (!isHTMLElement(parent, this.parentElement)) {
      throw new Error("Parent is not an HTMLElement (that supports children)");
    }
    let nextElement = null;
    let previousElement = null;
    if (previousNodeId) {
      previousElement = this.idToElement.get(previousNodeId);
      if (!previousElement) {
        throw new Error("No previous element found for childrenChanged message");
      }
      nextElement = previousElement.nextSibling;
    }
    const elementsToAdd = [];
    for (const addedNode of addedNodes) {
      const childElement = this.handleNewElement(addedNode);
      if (childElement) {
        elementsToAdd.push(childElement);
      }
    }
    if (elementsToAdd.length) {
      if (previousElement) {
        if (nextElement) {
          const docFrag = new DocumentFragment();
          docFrag.append(...elementsToAdd);
          parent.insertBefore(docFrag, nextElement);
        } else {
          parent.append(...elementsToAdd);
        }
      } else {
        parent.prepend(...elementsToAdd);
      }
    }
  }
  handleChildrenRemoved(message) {
    const { nodeId, removedNodes } = message;
    if (nodeId === void 0 || nodeId === null) {
      console.warn("No nodeId in childrenChanged message");
      return;
    }
    const parent = this.idToElement.get(nodeId);
    if (!parent) {
      throw new Error("No parent found for childrenChanged message");
    }
    if (!parent.isConnected) {
      console.error("Parent is not connected", parent);
    }
    if (!isHTMLElement(parent, this.parentElement)) {
      throw new Error("Parent is not an HTMLElement (that supports children)");
    }
    for (const removedNode of removedNodes) {
      const childElement = this.idToElement.get(removedNode);
      if (!childElement) {
        throw new Error(`Child element not found: ${removedNode}`);
      }
      this.elementToId.delete(childElement);
      this.idToElement.delete(removedNode);
      this.hiddenPlaceholderElements.delete(removedNode);
      parent.removeChild(childElement);
      if (isHTMLElement(childElement, this.parentElement)) {
        this.removeChildElementIds(childElement);
      }
    }
  }
  removeChildElementIds(parent) {
    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i];
      const childId = this.elementToId.get(child);
      if (!childId) {
        console.error("Inner child of removed element had no id", child);
      } else {
        this.elementToId.delete(child);
        this.idToElement.delete(childId);
        this.hiddenPlaceholderElements.delete(childId);
      }
      this.removeChildElementIds(child);
    }
  }
  handleSnapshot(message) {
    var _a;
    if (this.currentRoot) {
      this.currentRoot.remove();
      this.currentRoot = null;
      this.elementToId.clear();
      this.idToElement.clear();
    }
    (_a = this.timeCallback) == null ? void 0 : _a.call(this, message.documentTime);
    const element = this.handleNewElement(message.snapshot);
    if (!element) {
      throw new Error("Snapshot element not created");
    }
    if (!isHTMLElement(element, this.parentElement)) {
      throw new Error("Snapshot element is not an HTMLElement");
    }
    this.currentRoot = element;
    this.parentElement.append(element);
  }
  handleDocumentTime(message) {
    var _a;
    (_a = this.timeCallback) == null ? void 0 : _a.call(this, message.documentTime);
  }
  handleAttributeChange(message) {
    const { nodeId, attributes } = message;
    if (nodeId === void 0 || nodeId === null) {
      console.warn("No nodeId in attributeChange message");
      return;
    }
    let element = this.idToElement.get(nodeId);
    const hiddenElement = this.hiddenPlaceholderElements.get(nodeId);
    if (hiddenElement) {
      element = hiddenElement.element;
    }
    if (element) {
      if (isHTMLElement(element, this.parentElement)) {
        for (const [key, newValue] of attributes) {
          if (newValue === null) {
            element.removeAttribute(key);
          } else {
            if (DOMSanitizer.shouldAcceptAttribute(key)) {
              element.setAttribute(key, newValue);
            }
          }
        }
      } else {
        console.error("Element is not an HTMLElement and cannot support attributes", element);
      }
    } else {
      console.error("No element found for attributeChange message");
    }
  }
  handleNewElement(message) {
    if (message.type === "text") {
      const { nodeId: nodeId2, text: text2 } = message;
      const textNode = document.createTextNode("");
      textNode.textContent = text2;
      this.idToElement.set(nodeId2, textNode);
      this.elementToId.set(textNode, nodeId2);
      return textNode;
    }
    const { tag, nodeId, attributes, children, text, hiddenFrom } = message;
    if (this.idToElement.has(nodeId)) {
      console.error(
        "Received nodeId to add that is already present",
        nodeId,
        this.idToElement.get(nodeId)
      );
      return null;
    }
    if (tag === "#text") {
      const textNode = document.createTextNode("");
      textNode.textContent = text || null;
      this.idToElement.set(nodeId, textNode);
      this.elementToId.set(textNode, nodeId);
      return textNode;
    }
    let element;
    try {
      let filteredTag = tag;
      if (this.options.tagPrefix) {
        if (!tag.toLowerCase().startsWith(this.options.tagPrefix.toLowerCase())) {
          filteredTag = this.options.replacementTagPrefix ? this.options.replacementTagPrefix + tag : `x-${tag}`;
        }
      }
      element = document.createElement(filteredTag);
    } catch (e) {
      console.error(`Error creating element: (${tag})`, e);
      element = document.createElement("x-div");
    }
    for (const [key, value] of attributes) {
      if (value !== null) {
        if (DOMSanitizer.shouldAcceptAttribute(key)) {
          element.setAttribute(key, value);
        }
      }
    }
    if (children) {
      for (const child of children) {
        const childElement = this.handleNewElement(child);
        if (childElement) {
          element.append(childElement);
        }
      }
    }
    if (hiddenFrom && hiddenFrom.length > 0 && hiddenFrom.indexOf(connectionId) !== -1) {
      const placeholder = document.createElement(hiddenTag);
      this.idToElement.set(nodeId, placeholder);
      this.elementToId.set(placeholder, nodeId);
      this.hiddenPlaceholderElements.set(nodeId, { placeholder, element });
      return placeholder;
    } else {
      this.idToElement.set(nodeId, element);
      this.elementToId.set(element, nodeId);
      return element;
    }
  }
  handlePing(message) {
    var _a;
    (_a = this.timeCallback) == null ? void 0 : _a.call(this, message.documentTime);
    this.send({
      type: "pong",
      pong: message.ping
    });
  }
};
var startingBackoffTimeMilliseconds = 100;
var maximumBackoffTimeMilliseconds = 1e4;
var maximumWebsocketConnectionTimeout = 5e3;
var NetworkedDOMWebsocketStatus = /* @__PURE__ */ ((NetworkedDOMWebsocketStatus2) => {
  NetworkedDOMWebsocketStatus2[NetworkedDOMWebsocketStatus2["Connecting"] = 0] = "Connecting";
  NetworkedDOMWebsocketStatus2[NetworkedDOMWebsocketStatus2["ConnectionOpen"] = 1] = "ConnectionOpen";
  NetworkedDOMWebsocketStatus2[NetworkedDOMWebsocketStatus2["Connected"] = 2] = "Connected";
  NetworkedDOMWebsocketStatus2[NetworkedDOMWebsocketStatus2["Reconnecting"] = 3] = "Reconnecting";
  NetworkedDOMWebsocketStatus2[NetworkedDOMWebsocketStatus2["Disconnected"] = 4] = "Disconnected";
  return NetworkedDOMWebsocketStatus2;
})(NetworkedDOMWebsocketStatus || {});
function NetworkedDOMWebsocketStatusToString(status) {
  switch (status) {
    case 0:
      return "Connecting...";
    case 1:
      return "Connection Open";
    case 2:
      return "Connected";
    case 3:
      return "Reconnecting...";
    case 4:
      return "Disconnected";
    default:
      return "Unknown";
  }
}
var NetworkedDOMWebsocket = class {
  constructor(url, websocketFactory, parentElement, timeCallback, statusUpdateCallback, options = {}) {
    this.url = url;
    this.websocketFactory = websocketFactory;
    this.parentElement = parentElement;
    this.timeCallback = timeCallback;
    this.statusUpdateCallback = statusUpdateCallback;
    this.options = options;
    this.websocket = null;
    this.websocketAdapter = null;
    this.stopped = false;
    this.backoffTime = startingBackoffTimeMilliseconds;
    this.status = null;
    this.setStatus(
      0
      /* Connecting */
    );
    this.startWebSocketConnectionAttempt();
  }
  static createWebSocket(url) {
    return new WebSocket(url, [
      networkedDOMProtocolSubProtocol_v0_2,
      networkedDOMProtocolSubProtocol_v0_1
    ]);
  }
  setStatus(status) {
    if (this.status !== status) {
      this.status = status;
      if (this.statusUpdateCallback) {
        this.statusUpdateCallback(status);
      }
    }
  }
  createWebsocketWithTimeout(timeout) {
    return new Promise((resolve, reject) => {
      const websocket = this.websocketFactory(this.url);
      const timeoutId = setTimeout(() => {
        reject(new Error("websocket connection timed out"));
        websocket.close();
      }, timeout);
      websocket.binaryType = "arraybuffer";
      websocket.addEventListener("open", () => {
        clearTimeout(timeoutId);
        this.websocket = websocket;
        const isV02 = websocket.protocol === networkedDOMProtocolSubProtocol_v0_2;
        let websocketAdapter;
        if (isV02) {
          websocketAdapter = new NetworkedDOMWebsocketV02Adapter(
            websocket,
            this.parentElement,
            () => {
              this.backoffTime = startingBackoffTimeMilliseconds;
              this.setStatus(
                2
                /* Connected */
              );
            },
            this.timeCallback,
            this.options
          );
        } else {
          websocketAdapter = new NetworkedDOMWebsocketV01Adapter(
            websocket,
            this.parentElement,
            () => {
              this.backoffTime = startingBackoffTimeMilliseconds;
              this.setStatus(
                2
                /* Connected */
              );
            },
            this.timeCallback,
            this.options
          );
        }
        this.websocketAdapter = websocketAdapter;
        websocket.addEventListener("message", (event) => {
          if (websocket !== this.websocket) {
            console.log("Ignoring websocket message event because it is no longer current");
            websocket.close();
            return;
          }
          websocketAdapter.receiveMessage(event);
        });
        const onWebsocketClose = async () => {
          let hadContents = false;
          if (this.websocketAdapter) {
            hadContents = this.websocketAdapter.clearContents();
          }
          if (this.stopped) {
            this.setStatus(
              4
              /* Disconnected */
            );
            return;
          }
          if (!hadContents) {
            await this.waitBackoffTime();
          }
          this.setStatus(
            3
            /* Reconnecting */
          );
          this.startWebSocketConnectionAttempt();
        };
        websocket.addEventListener("close", () => {
          if (websocket !== this.websocket) {
            console.warn("Ignoring websocket close event because it is no longer current");
            return;
          }
          onWebsocketClose();
        });
        websocket.addEventListener("error", (e) => {
          if (websocket !== this.websocket) {
            console.log("Ignoring websocket error event because it is no longer current");
            return;
          }
          console.error("NetworkedDOMWebsocket error", e);
          onWebsocketClose();
        });
        this.setStatus(
          1
          /* ConnectionOpen */
        );
        resolve(websocket);
      });
      websocket.addEventListener("error", (e) => {
        clearTimeout(timeoutId);
        reject(e);
      });
    });
  }
  async waitBackoffTime() {
    console.warn(`Websocket connection to '${this.url}' failed: retrying in ${this.backoffTime}ms`);
    await new Promise((resolve) => setTimeout(resolve, this.backoffTime));
    this.backoffTime = Math.min(
      // Introduce a small amount of randomness to prevent clients from retrying in lockstep
      this.backoffTime * (1.5 + Math.random() * 0.5),
      maximumBackoffTimeMilliseconds
    );
  }
  async startWebSocketConnectionAttempt() {
    if (this.stopped) {
      return;
    }
    while (true) {
      if (this.stopped) {
        return;
      }
      try {
        await this.createWebsocketWithTimeout(maximumWebsocketConnectionTimeout);
        break;
      } catch (e) {
        console.error("Websocket connection failed", e);
        this.setStatus(
          3
          /* Reconnecting */
        );
        await this.waitBackoffTime();
      }
    }
  }
  stop() {
    this.stopped = true;
    if (this.websocket !== null) {
      this.websocket.close();
      this.websocket = null;
    }
  }
  handleEvent(element, event) {
    if (this.websocketAdapter) {
      this.websocketAdapter.handleEvent(element, event);
    }
  }
};
function isHTMLElement(node, rootNode) {
  if (node instanceof HTMLElement) {
    return true;
  }
  if (!rootNode.ownerDocument.defaultView) {
    return false;
  }
  return node instanceof rootNode.ownerDocument.defaultView.HTMLElement;
}
function isText(node, rootNode) {
  if (node instanceof Text) {
    return true;
  }
  if (!rootNode.ownerDocument.defaultView) {
    return false;
  }
  return node instanceof rootNode.ownerDocument.defaultView.Text;
}

// ../../node_modules/@mml-io/mml-web/build/index.js
function lerpHSL(colorA, colorB, alpha) {
  const hslA = getHSL(colorA);
  const hslB = getHSL(colorB);
  const h = hslA.h + (hslB.h - hslA.h) * alpha;
  const s = hslA.s + (hslB.s - hslA.s) * alpha;
  const l = hslA.l + (hslB.l - hslA.l) * alpha;
  return hslToRGB(h, s, l);
}
function hue2RGB(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * 6 * (2 / 3 - t);
  return p;
}
function euclideanModulo(n, m) {
  return (n % m + m) % m;
}
function hslToRGB(h, s, l) {
  h = euclideanModulo(h, 1);
  s = Math.max(0, Math.min(s, 1));
  l = Math.max(0, Math.min(l, 1));
  if (s === 0) {
    return { r: l, g: l, b: l };
  } else {
    const p = l <= 0.5 ? l * (1 + s) : l + s - l * s;
    const q = 2 * l - p;
    return {
      r: hue2RGB(q, p, h + 1 / 3),
      g: hue2RGB(q, p, h),
      b: hue2RGB(q, p, h - 1 / 3)
    };
  }
}
function getHSL(source) {
  const r = source.r, g = source.g, b = source.b;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hue = 0;
  let saturation = 0;
  const lightness = (min + max) / 2;
  if (min === max) {
    hue = 0;
    saturation = 0;
  } else {
    const delta = max - min;
    saturation = lightness <= 0.5 ? delta / (max + min) : delta / (2 - max - min);
    switch (max) {
      case r:
        hue = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        hue = (b - r) / delta + 2;
        break;
      case b:
        hue = (r - g) / delta + 4;
        break;
    }
    hue /= 6;
  }
  return {
    h: hue,
    s: saturation,
    l: lightness
  };
}
var colors = {
  aliceblue: [240 / 255, 248 / 255, 255 / 255],
  antiquewhite: [250 / 255, 235 / 255, 215 / 255],
  aqua: [0 / 255, 255 / 255, 255 / 255],
  aquamarine: [127 / 255, 255 / 255, 212 / 255],
  azure: [240 / 255, 255 / 255, 255 / 255],
  beige: [245 / 255, 245 / 255, 220 / 255],
  bisque: [255 / 255, 228 / 255, 196 / 255],
  black: [0 / 255, 0 / 255, 0 / 255],
  blanchedalmond: [255 / 255, 235 / 255, 205 / 255],
  blue: [0 / 255, 0 / 255, 255 / 255],
  blueviolet: [138 / 255, 43 / 255, 226 / 255],
  brown: [165 / 255, 42 / 255, 42 / 255],
  burlywood: [222 / 255, 184 / 255, 135 / 255],
  cadetblue: [95 / 255, 158 / 255, 160 / 255],
  chartreuse: [127 / 255, 255 / 255, 0 / 255],
  chocolate: [210 / 255, 105 / 255, 30 / 255],
  coral: [255 / 255, 127 / 255, 80 / 255],
  cornflowerblue: [100 / 255, 149 / 255, 237 / 255],
  cornsilk: [255 / 255, 248 / 255, 220 / 255],
  crimson: [220 / 255, 20 / 255, 60 / 255],
  cyan: [0 / 255, 255 / 255, 255 / 255],
  darkblue: [0 / 255, 0 / 255, 139 / 255],
  darkcyan: [0 / 255, 139 / 255, 139 / 255],
  darkgoldenrod: [184 / 255, 134 / 255, 11 / 255],
  darkgray: [169 / 255, 169 / 255, 169 / 255],
  darkgreen: [0 / 255, 100 / 255, 0 / 255],
  darkgrey: [169 / 255, 169 / 255, 169 / 255],
  darkkhaki: [189 / 255, 183 / 255, 107 / 255],
  darkmagenta: [139 / 255, 0 / 255, 139 / 255],
  darkolivegreen: [85 / 255, 107 / 255, 47 / 255],
  darkorange: [255 / 255, 140 / 255, 0 / 255],
  darkorchid: [153 / 255, 50 / 255, 204 / 255],
  darkred: [139 / 255, 0 / 255, 0 / 255],
  darksalmon: [233 / 255, 150 / 255, 122 / 255],
  darkseagreen: [143 / 255, 188 / 255, 143 / 255],
  darkslateblue: [72 / 255, 61 / 255, 139 / 255],
  darkslategray: [47 / 255, 79 / 255, 79 / 255],
  darkslategrey: [47 / 255, 79 / 255, 79 / 255],
  darkturquoise: [0 / 255, 206 / 255, 209 / 255],
  darkviolet: [148 / 255, 0 / 255, 211 / 255],
  deeppink: [255 / 255, 20 / 255, 147 / 255],
  deepskyblue: [0 / 255, 191 / 255, 255 / 255],
  dimgray: [105 / 255, 105 / 255, 105 / 255],
  dimgrey: [105 / 255, 105 / 255, 105 / 255],
  dodgerblue: [30 / 255, 144 / 255, 255 / 255],
  firebrick: [178 / 255, 34 / 255, 34 / 255],
  floralwhite: [255 / 255, 250 / 255, 240 / 255],
  forestgreen: [34 / 255, 139 / 255, 34 / 255],
  fuchsia: [255 / 255, 0 / 255, 255 / 255],
  gainsboro: [220 / 255, 220 / 255, 220 / 255],
  ghostwhite: [248 / 255, 248 / 255, 255 / 255],
  gold: [255 / 255, 215 / 255, 0 / 255],
  goldenrod: [218 / 255, 165 / 255, 32 / 255],
  gray: [128 / 255, 128 / 255, 128 / 255],
  green: [0 / 255, 128 / 255, 0 / 255],
  greenyellow: [173 / 255, 255 / 255, 47 / 255],
  grey: [128 / 255, 128 / 255, 128 / 255],
  honeydew: [240 / 255, 255 / 255, 240 / 255],
  hotpink: [255 / 255, 105 / 255, 180 / 255],
  indianred: [205 / 255, 92 / 255, 92 / 255],
  indigo: [75 / 255, 0 / 255, 130 / 255],
  ivory: [255 / 255, 255 / 255, 240 / 255],
  khaki: [240 / 255, 230 / 255, 140 / 255],
  lavender: [230 / 255, 230 / 255, 250 / 255],
  lavenderblush: [255 / 255, 240 / 255, 245 / 255],
  lawngreen: [124 / 255, 252 / 255, 0 / 255],
  lemonchiffon: [255 / 255, 250 / 255, 205 / 255],
  lightblue: [173 / 255, 216 / 255, 230 / 255],
  lightcoral: [240 / 255, 128 / 255, 128 / 255],
  lightcyan: [224 / 255, 255 / 255, 255 / 255],
  lightgoldenrodyellow: [250 / 255, 250 / 255, 210 / 255],
  lightgray: [211 / 255, 211 / 255, 211 / 255],
  lightgreen: [144 / 255, 238 / 255, 144 / 255],
  lightgrey: [211 / 255, 211 / 255, 211 / 255],
  lightpink: [255 / 255, 182 / 255, 193 / 255],
  lightsalmon: [255 / 255, 160 / 255, 122 / 255],
  lightseagreen: [32 / 255, 178 / 255, 170 / 255],
  lightskyblue: [135 / 255, 206 / 255, 250 / 255],
  lightslategray: [119 / 255, 136 / 255, 153 / 255],
  lightslategrey: [119 / 255, 136 / 255, 153 / 255],
  lightsteelblue: [176 / 255, 196 / 255, 222 / 255],
  lightyellow: [255 / 255, 255 / 255, 224 / 255],
  lime: [0 / 255, 255 / 255, 0 / 255],
  limegreen: [50 / 255, 205 / 255, 50 / 255],
  linen: [250 / 255, 240 / 255, 230 / 255],
  magenta: [255 / 255, 0 / 255, 255 / 255],
  maroon: [128 / 255, 0 / 255, 0 / 255],
  mediumaquamarine: [102 / 255, 205 / 255, 170 / 255],
  mediumblue: [0 / 255, 0 / 255, 205 / 255],
  mediumorchid: [186 / 255, 85 / 255, 211 / 255],
  mediumpurple: [147 / 255, 112 / 255, 219 / 255],
  mediumseagreen: [60 / 255, 179 / 255, 113 / 255],
  mediumslateblue: [123 / 255, 104 / 255, 238 / 255],
  mediumspringgreen: [0 / 255, 250 / 255, 154 / 255],
  mediumturquoise: [72 / 255, 209 / 255, 204 / 255],
  mediumvioletred: [199 / 255, 21 / 255, 133 / 255],
  midnightblue: [25 / 255, 25 / 255, 112 / 255],
  mintcream: [245 / 255, 255 / 255, 250 / 255],
  mistyrose: [255 / 255, 228 / 255, 225 / 255],
  moccasin: [255 / 255, 228 / 255, 181 / 255],
  navajowhite: [255 / 255, 222 / 255, 173 / 255],
  navy: [0 / 255, 0 / 255, 128 / 255],
  oldlace: [253 / 255, 245 / 255, 230 / 255],
  olive: [128 / 255, 128 / 255, 0 / 255],
  olivedrab: [107 / 255, 142 / 255, 35 / 255],
  orange: [255 / 255, 165 / 255, 0 / 255],
  orangered: [255 / 255, 69 / 255, 0 / 255],
  orchid: [218 / 255, 112 / 255, 214 / 255],
  palegoldenrod: [238 / 255, 232 / 255, 170 / 255],
  palegreen: [152 / 255, 251 / 255, 152 / 255],
  paleturquoise: [175 / 255, 238 / 255, 238 / 255],
  palevioletred: [219 / 255, 112 / 255, 147 / 255],
  papayawhip: [255 / 255, 239 / 255, 213 / 255],
  peachpuff: [255 / 255, 218 / 255, 185 / 255],
  peru: [205 / 255, 133 / 255, 63 / 255],
  pink: [255 / 255, 192 / 255, 203 / 255],
  plum: [221 / 255, 160 / 255, 221 / 255],
  powderblue: [176 / 255, 224 / 255, 230 / 255],
  purple: [128 / 255, 0 / 255, 128 / 255],
  rebeccapurple: [102 / 255, 51 / 255, 153 / 255],
  red: [255 / 255, 0 / 255, 0 / 255],
  rosybrown: [188 / 255, 143 / 255, 143 / 255],
  royalblue: [65 / 255, 105 / 255, 225 / 255],
  saddlebrown: [139 / 255, 69 / 255, 19 / 255],
  salmon: [250 / 255, 128 / 255, 114 / 255],
  sandybrown: [244 / 255, 164 / 255, 96 / 255],
  seagreen: [46 / 255, 139 / 255, 87 / 255],
  seashell: [255 / 255, 245 / 255, 238 / 255],
  sienna: [160 / 255, 82 / 255, 45 / 255],
  silver: [192 / 255, 192 / 255, 192 / 255],
  skyblue: [135 / 255, 206 / 255, 235 / 255],
  slateblue: [106 / 255, 90 / 255, 205 / 255],
  slategray: [112 / 255, 128 / 255, 144 / 255],
  slategrey: [112 / 255, 128 / 255, 144 / 255],
  snow: [255 / 255, 250 / 255, 250 / 255],
  springgreen: [0 / 255, 255 / 255, 127 / 255],
  steelblue: [70 / 255, 130 / 255, 180 / 255],
  tan: [210 / 255, 180 / 255, 140 / 255],
  teal: [0 / 255, 128 / 255, 128 / 255],
  thistle: [216 / 255, 191 / 255, 216 / 255],
  tomato: [255 / 255, 99 / 255, 71 / 255],
  turquoise: [64 / 255, 224 / 255, 208 / 255],
  violet: [238 / 255, 130 / 255, 238 / 255],
  wheat: [245 / 255, 222 / 255, 179 / 255],
  white: [255 / 255, 255 / 255, 255 / 255],
  whitesmoke: [245 / 255, 245 / 255, 245 / 255],
  yellow: [255 / 255, 255 / 255, 0 / 255],
  yellowgreen: [154 / 255, 205 / 255, 50 / 255]
};
var AttributeHandler = class {
  constructor(map) {
    this.map = map;
  }
  getAttributes() {
    return Object.keys(this.map);
  }
  handle(instance, name, newValue) {
    const handler = this.map[name];
    if (handler) {
      handler(instance, newValue);
      return true;
    }
    return false;
  }
};
function parseRGB(value) {
  value = value.trim();
  const validStart = value.startsWith("rgb(") || value.startsWith("rgba(");
  const validEnd = value.endsWith(")");
  if (!validStart || !validEnd) return null;
  const content = value.substring(value.indexOf("(") + 1, value.length - 1).split(",");
  if (content.length < 3 || content.length > 4) return null;
  if (value.startsWith("rgb(") && content.length !== 3) return null;
  if (value.startsWith("rgba(") && content.length !== 4) return null;
  const numbers = content.map((n) => parseFloat(n.trim()));
  if (numbers.some((n) => isNaN(n))) return null;
  return {
    r: Math.min(255, Math.max(0, numbers[0])) / 255,
    g: Math.min(255, Math.max(0, numbers[1])) / 255,
    b: Math.min(255, Math.max(0, numbers[2])) / 255,
    a: numbers.length === 4 ? Math.min(1, Math.max(0, numbers[3])) : void 0
  };
}
function parseHSL(value) {
  value = value.trim();
  const validStart = value.startsWith("hsl(") || value.startsWith("hsla(");
  const validEnd = value.endsWith(")");
  if (!validStart || !validEnd) return null;
  const content = value.substring(value.indexOf("(") + 1, value.length - 1).split(",");
  if (content.length < 3 || content.length > 4) return null;
  if (value.startsWith("hsl(") && content.length !== 3) return null;
  if (value.startsWith("hsla(") && content.length !== 4) return null;
  const numbers = content.map((n) => parseFloat(n.trim()));
  if (numbers.some((n) => isNaN(n))) return null;
  let [h, s, l] = numbers;
  h = h / 360;
  h = h === 0 ? 1e-4 : h === 1 ? 0.9999 : h;
  s = s / 100;
  s = s === 0 ? 1e-4 : s === 1 ? 0.9999 : s;
  l = l / 100;
  l = l === 0 ? 1e-4 : l === 1 ? 0.9999 : l;
  const rgb = hslToRGB(h, s, l);
  return {
    r: rgb.r,
    g: rgb.g,
    b: rgb.b,
    a: numbers.length === 4 ? Math.min(1, Math.max(0, numbers[3])) : void 0
  };
}
function parseColorAttribute(value, defaultValue) {
  return parseAttribute(value, defaultValue, (value2) => {
    const colorNameValues = colors[value2.trim()];
    if (colorNameValues) {
      return {
        r: colorNameValues[0],
        g: colorNameValues[1],
        b: colorNameValues[2]
      };
    }
    if (value2.length === 7) {
      const hex = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(value2);
      if (hex) {
        return {
          r: parseInt(hex[1], 16) / 255,
          g: parseInt(hex[2], 16) / 255,
          b: parseInt(hex[3], 16) / 255
        };
      }
    }
    if (value2.length === 4) {
      const hex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(value2);
      if (hex) {
        return {
          r: parseInt(hex[1] + hex[1], 16) / 255,
          g: parseInt(hex[2] + hex[2], 16) / 255,
          b: parseInt(hex[3] + hex[3], 16) / 255
        };
      }
    }
    if (value2.indexOf("rgb(") === 0) {
      return parseRGB(value2);
    }
    if (value2.indexOf("rgba(") === 0) {
      return parseRGB(value2);
    }
    if (value2.indexOf("hsl(") === 0) {
      return parseHSL(value2);
    }
    if (value2.indexOf("hsla(") === 0) {
      return parseHSL(value2);
    }
    return null;
  });
}
function parseAttribute(value, defaultValue, parser) {
  if (value === null) {
    return defaultValue;
  }
  const parsed = parser(value);
  if (parsed === null) {
    return defaultValue;
  }
  return parsed;
}
function floatParser(value) {
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    return null;
  }
  return parsed;
}
function boolParser(value) {
  if (value === "true") {
    return true;
  } else if (value === "false") {
    return false;
  }
  return null;
}
function parseFloatAttribute(value, defaultValue) {
  return parseAttribute(value, defaultValue, floatParser);
}
function parseBoolAttribute(value, defaultValue) {
  return parseAttribute(value, defaultValue, boolParser);
}
function parseEnumAttribute(value, enumValues, defaultValue) {
  return parseAttribute(value, defaultValue, (value2) => {
    if (Object.keys(enumValues).indexOf(value2) === -1) {
      return null;
    }
    return value2;
  });
}
var scene = null;
var documentTimeManager = null;
function getGlobalMMLScene() {
  if (!scene) {
    throw new Error("GlobalMMLScene not set");
  }
  return scene;
}
function getGlobalDocumentTimeManager() {
  if (!documentTimeManager) {
    throw new Error("GlobalMMLScene not set");
  }
  return documentTimeManager;
}
var MELEMENT_PROPERTY_NAME = "m-element-property";
var consumeEventEventName = "consume-event";
var MElement = class _MElement extends HTMLElement {
  constructor() {
    super();
    this.mElementGraphics = null;
    this.isMElement = true;
  }
  // This allows switching which document this HTMLElement subclass extends so that it can be placed into iframes
  static overwriteSuperclass(newSuperclass) {
    _MElement.__proto__ = newSuperclass;
  }
  static get observedAttributes() {
    return [];
  }
  static isMElement(element) {
    return element.isMElement;
  }
  static getMElementFromObject(object) {
    return object[MELEMENT_PROPERTY_NAME] || null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addSideEffectChild(child) {
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  removeSideEffectChild(child) {
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  attributeChangedCallback(name, oldValue, newValue) {
  }
  getScene() {
    const remoteDocumentElement = this.getInitiatedRemoteDocument();
    if (remoteDocumentElement) {
      return remoteDocumentElement.getMMLScene();
    }
    const globalScene = getGlobalMMLScene();
    if (!globalScene) {
      throw new Error("No scene attachment found and no global scene found");
    }
    return globalScene;
  }
  getInitiatedRemoteDocument() {
    for (let parentNode = this; parentNode; parentNode = parentNode.parentNode) {
      if (parentNode.nodeName === "M-REMOTE-DOCUMENT" && parentNode.getMMLScene()) {
        return parentNode;
      }
    }
    return null;
  }
  contentSrcToContentAddress(src) {
    const documentLocation = this.getDocumentHost();
    try {
      const url = new URL(src);
      return url.toString();
    } catch {
    }
    let protocol = documentLocation.protocol;
    if (protocol === "ws:") {
      protocol = "http:";
    } else if (protocol === "wss:") {
      protocol = "https:";
    }
    if (src.startsWith("/")) {
      return `${protocol}//${documentLocation.host}${src}`;
    } else {
      const path = documentLocation.pathname;
      const lastSlashIndex = path.lastIndexOf("/");
      if (lastSlashIndex === -1) {
        return `${protocol}//${documentLocation.host}/${src}`;
      }
      const pathWithoutFilename = path.substring(0, lastSlashIndex + 1);
      return `${protocol}//${documentLocation.host}${pathWithoutFilename}${src}`;
    }
  }
  getDocumentHost() {
    const remoteDocument = this.getInitiatedRemoteDocument();
    if (remoteDocument) {
      const remoteDocumentAddress = remoteDocument.getDocumentAddress();
      if (remoteDocumentAddress) {
        const url = new URL(remoteDocumentAddress);
        return url;
      }
    }
    return window.location;
  }
  getDocumentTime() {
    const documentTimeContextProvider = this.getDocumentTimeManager();
    if (documentTimeContextProvider) {
      return documentTimeContextProvider.getDocumentTime();
    }
    return Number(document.timeline.currentTime);
  }
  getWindowTime() {
    const documentTimeContextProvider = this.getDocumentTimeManager();
    if (documentTimeContextProvider) {
      return documentTimeContextProvider.getWindowTime();
    }
    return Number(document.timeline.currentTime);
  }
  getLoadingProgressManager() {
    var _a;
    const scene2 = this.getScene();
    if (scene2) {
      return ((_a = scene2.getLoadingProgressManager) == null ? void 0 : _a.call(scene2)) || null;
    }
    return null;
  }
  getDocumentTimeManager() {
    const remoteDocument = this.getInitiatedRemoteDocument();
    if (remoteDocument) {
      return remoteDocument.getDocumentTimeManager();
    }
    const globalDocumentTimeManager = getGlobalDocumentTimeManager();
    if (globalDocumentTimeManager) {
      return globalDocumentTimeManager;
    }
    return null;
  }
  addDocumentTimeListener(cb) {
    const documentTimeManager2 = this.getDocumentTimeManager();
    if (documentTimeManager2) {
      documentTimeManager2.addDocumentTimeListenerCallback(cb);
      return {
        remove: () => {
          documentTimeManager2.removeDocumentTimeListenerCallback(cb);
        }
      };
    } else {
      console.warn("No document time context provider found to add listener to");
      return {
        remove: () => {
        }
      };
    }
  }
  addDocumentTimeTickListener(cb) {
    const documentTimeManager2 = this.getDocumentTimeManager();
    if (documentTimeManager2) {
      documentTimeManager2.addDocumentTimeTickListenerCallback(cb);
      return {
        remove: () => {
          documentTimeManager2.removeDocumentTimeTickListenerCallback(cb);
        }
      };
    } else {
      console.warn("No document time context provider found to add listener to");
      return {
        remove: () => {
        }
      };
    }
  }
  getContainer() {
    var _a;
    const container = (_a = this.mElementGraphics) == null ? void 0 : _a.getContainer();
    if (!container) {
      throw new Error("No container found");
    }
    return container;
  }
  getUserPositionAndRotation() {
    const remoteDocument = this.getScene();
    if (!remoteDocument) {
      throw new Error("No scene to retrieve user position from");
    }
    return remoteDocument.getUserPositionAndRotation();
  }
  dispatchEvent(event) {
    const remoteDocument = this.getInitiatedRemoteDocument();
    if (remoteDocument) {
      remoteDocument.dispatchEvent(
        new CustomEvent(consumeEventEventName, {
          bubbles: false,
          detail: { element: this, originalEvent: event }
        })
      );
      return super.dispatchEvent(event);
    } else {
      if (event.type !== "click") {
        const script = this.getAttribute("on" + event.type.toLowerCase());
        if (script) {
          const handler = window["eval"](`(function(event){ ${script} })`);
          handler.apply(this, [event]);
        }
      }
      return super.dispatchEvent(event);
    }
  }
  getMElementParent() {
    let parentNode = this.parentNode;
    while (parentNode != null) {
      if (_MElement.isMElement(parentNode)) {
        return parentNode;
      }
      parentNode = parentNode.parentNode;
    }
    return null;
  }
  connectedCallback() {
    if (!this.getScene().hasGraphicsAdapter() || this.mElementGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.mElementGraphics = graphicsAdapter.getGraphicsAdapterFactory().MElementGraphicsInterface(this);
  }
  disconnectedCallback() {
    var _a;
    (_a = this.mElementGraphics) == null ? void 0 : _a.dispose();
    this.mElementGraphics = null;
  }
};
var defaultAttribute = null;
var defaultStart = 0;
var defaultEnd = 0;
var defaultLoop = true;
var defaultPingPong = false;
var defaultEasing = "";
var defaultStartTime = 0;
var defaultPauseTime = null;
var defaultAnimDuration = 1e3;
var defaultPingPongDelay = 0;
var defaultColor = { r: 1, g: 1, b: 1 };
var _AttributeAnimation = class _AttributeAnimation2 extends MElement {
  constructor() {
    super();
    this.props = {
      attr: defaultAttribute,
      start: defaultStart,
      end: defaultEnd,
      loop: defaultLoop,
      pingPong: defaultPingPong,
      pingPongDelay: defaultPingPongDelay,
      easing: defaultEasing,
      startTime: defaultStartTime,
      pauseTime: defaultPauseTime,
      animDuration: defaultAnimDuration
    };
    this.registeredParentAttachment = null;
    this.isAttributeAnimation = true;
  }
  static isAttributeAnimation(element) {
    return element.isAttributeAnimation;
  }
  static get observedAttributes() {
    return [..._AttributeAnimation2.attributeHandler.getAttributes()];
  }
  enable() {
  }
  disable() {
  }
  getContentBounds() {
    return null;
  }
  getAnimatedAttributeName() {
    return this.props.attr;
  }
  parentTransformed() {
  }
  isClickable() {
    return false;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    _AttributeAnimation2.attributeHandler.handle(this, name, newValue);
  }
  connectedCallback() {
    super.connectedCallback();
    if (this.parentElement && MElement.isMElement(this.parentElement)) {
      this.registeredParentAttachment = this.parentElement;
      if (this.props.attr) {
        this.registeredParentAttachment.addSideEffectChild(this);
      }
    }
  }
  disconnectedCallback() {
    if (this.registeredParentAttachment && this.props.attr) {
      this.registeredParentAttachment.removeSideEffectChild(this);
    }
    this.registeredParentAttachment = null;
    super.disconnectedCallback();
  }
  getColorValueForTime(docTimeMs) {
    const [ratio, state] = getEasedRatioForTime(docTimeMs, this.props);
    if (typeof this.props.start !== "object" || typeof this.props.end !== "object") {
      return [defaultColor, state];
    }
    if (ratio === StartOfAnimationSymbol) {
      return [this.props.start, state];
    } else if (ratio === EndOfAnimationSymbol) {
      return [this.props.end, state];
    } else {
      const value = lerpHSL(this.props.start, this.props.end, ratio);
      return [value, state];
    }
  }
  getFloatValueForTime(docTimeMs) {
    const [ratio, state] = getEasedRatioForTime(docTimeMs, this.props);
    if (typeof this.props.start !== "number" || typeof this.props.end !== "number") {
      return [0, state];
    }
    if (ratio === StartOfAnimationSymbol) {
      return [this.props.start, state];
    } else if (ratio === EndOfAnimationSymbol) {
      return [this.props.end, state];
    } else {
      const value = ratio * (this.props.end - this.props.start) + this.props.start;
      return [value, state];
    }
  }
};
_AttributeAnimation.tagName = "m-attr-anim";
_AttributeAnimation.attributeHandler = new AttributeHandler({
  attr: (instance, newValue) => {
    if (instance.registeredParentAttachment && instance.props.attr) {
      instance.registeredParentAttachment.removeSideEffectChild(instance);
    }
    instance.props.attr = newValue || defaultAttribute;
    if (instance.registeredParentAttachment && instance.props.attr) {
      instance.registeredParentAttachment.addSideEffectChild(instance);
    }
  },
  start: (instance, newValue) => {
    let parsedValue = parseFloatAttribute(newValue, null);
    if (parsedValue === null) {
      parsedValue = parseColorAttribute(newValue, null);
    }
    if (parsedValue === null) {
      instance.props.start = defaultStart;
    } else {
      instance.props.start = parsedValue;
    }
  },
  end: (instance, newValue) => {
    let parsedValue = parseFloatAttribute(newValue, null);
    if (parsedValue === null) {
      parsedValue = parseColorAttribute(newValue, null);
    }
    if (parsedValue === null) {
      instance.props.end = defaultStart;
    } else {
      instance.props.end = parsedValue;
    }
  },
  loop: (instance, newValue) => {
    instance.props.loop = parseBoolAttribute(newValue, defaultLoop);
  },
  "ping-pong": (instance, newValue) => {
    instance.props.pingPong = parseBoolAttribute(newValue, defaultPingPong);
  },
  "ping-pong-delay": (instance, newValue) => {
    instance.props.pingPongDelay = parseFloatAttribute(newValue, defaultPingPongDelay);
  },
  easing: (instance, newValue) => {
    instance.props.easing = newValue || defaultEasing;
  },
  "start-time": (instance, newValue) => {
    instance.props.startTime = parseFloatAttribute(newValue, defaultStartTime);
  },
  "pause-time": (instance, newValue) => {
    instance.props.pauseTime = parseFloatAttribute(newValue, defaultPauseTime);
  },
  duration: (instance, newValue) => {
    instance.props.animDuration = parseFloatAttribute(newValue, defaultAnimDuration);
  }
});
var AttributeAnimation = _AttributeAnimation;
var defaultAttribute2 = "all";
var defaultEasing2 = "";
var defaultLerpDuration = 1e3;
var _AttributeLerp = class _AttributeLerp2 extends MElement {
  constructor() {
    super();
    this.props = {
      attr: defaultAttribute2,
      easing: defaultEasing2,
      lerpDuration: defaultLerpDuration
    };
    this.registeredParentAttachment = null;
    this.isAttributeLerp = true;
  }
  static isAttributeLerp(element) {
    return element.isAttributeLerp;
  }
  static get observedAttributes() {
    return [..._AttributeLerp2.attributeHandler.getAttributes()];
  }
  enable() {
  }
  disable() {
  }
  getContentBounds() {
    return null;
  }
  getAnimatedAttributeName() {
    return this.props.attr;
  }
  parentTransformed() {
  }
  isClickable() {
    return false;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    _AttributeLerp2.attributeHandler.handle(this, name, newValue);
  }
  connectedCallback() {
    super.connectedCallback();
    if (this.parentElement && MElement.isMElement(this.parentElement)) {
      this.registeredParentAttachment = this.parentElement;
      this.registeredParentAttachment.addSideEffectChild(this);
    }
  }
  disconnectedCallback() {
    if (this.registeredParentAttachment) {
      this.registeredParentAttachment.removeSideEffectChild(this);
    }
    this.registeredParentAttachment = null;
    super.disconnectedCallback();
  }
  getColorValueForTime(windowTime, elementValueSetTime, elementValue, previousValue) {
    const ratio = this.getLerpRatio(windowTime, elementValueSetTime);
    if (ratio >= 1) {
      return elementValue;
    }
    return lerpHSL(previousValue, elementValue, ratio);
  }
  getFloatValueForTime(windowTime, elementValueSetTime, elementValue, previousValue, isDegrees) {
    let from = previousValue;
    const to = elementValue;
    const ratio = this.getLerpRatio(windowTime, elementValueSetTime);
    if (ratio >= 1) {
      return to;
    }
    if (isDegrees) {
      if (to - from > 180) {
        from += 360;
      } else if (from - to > 180) {
        from -= 360;
      }
    }
    return from + (to - from) * ratio;
  }
  getLerpRatio(windowTime, elementValueSetTime) {
    const duration = this.props.lerpDuration;
    const timePassed = (windowTime || 0) - elementValueSetTime;
    const ratioOfTimePassed = Math.min(timePassed / duration, 1);
    const easing = this.props.easing;
    let ratio;
    const easingFunction = easingsByName[easing];
    if (easingFunction) {
      ratio = easingFunction(ratioOfTimePassed, 0, 1, 1);
    } else {
      ratio = ratioOfTimePassed;
    }
    return ratio;
  }
};
_AttributeLerp.tagName = "m-attr-lerp";
_AttributeLerp.attributeHandler = new AttributeHandler({
  attr: (instance, newValue) => {
    if (instance.registeredParentAttachment) {
      instance.registeredParentAttachment.removeSideEffectChild(instance);
    }
    instance.props.attr = newValue !== null ? newValue : defaultAttribute2;
    if (instance.registeredParentAttachment) {
      instance.registeredParentAttachment.addSideEffectChild(instance);
    }
  },
  easing: (instance, newValue) => {
    instance.props.easing = newValue || defaultEasing2;
  },
  duration: (instance, newValue) => {
    instance.props.lerpDuration = Math.max(0, parseFloatAttribute(newValue, defaultLerpDuration));
  }
});
var AttributeLerp = _AttributeLerp;
function TupleToState(tuple) {
  return {
    previousValue: null,
    elementValue: null,
    elementValueSetTime: null,
    type: tuple[0],
    latestValue: tuple[1],
    defaultValue: tuple[1],
    handler: tuple[2]
  };
}
function updateIfChangedValue(state, newValue) {
  if (newValue === null) {
    newValue = state.attributeState.defaultValue;
  }
  if (state.attributeState.latestValue !== newValue) {
    state.attributeState.latestValue = newValue;
    state.attributeState.handler(newValue);
  }
}
function isColorAttribute(attributeState) {
  return attributeState.type === 2;
}
function isDegreesAttribute(attributeState) {
  return attributeState.type === 1;
}
function isNumberAttribute(attributeState) {
  return attributeState.type === 0;
}
var AnimatedAttributeHelper = class {
  constructor(element, handlers) {
    this.element = element;
    this.handlers = handlers;
    this.stateByAttribute = {};
    this.allAnimations = /* @__PURE__ */ new Set();
    this.allLerps = /* @__PURE__ */ new Set();
    this.documentTimeTickListener = null;
    this.hasTicked = false;
    this.element = element;
    this.reset();
  }
  addSideEffectChild(child) {
    if (AttributeAnimation.isAttributeAnimation(child)) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.addAnimation(child, attr);
      }
    } else if (AttributeLerp.isAttributeLerp(child)) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.addLerp(child, attr);
      }
    }
  }
  removeSideEffectChild(child) {
    if (AttributeAnimation.isAttributeAnimation(child)) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.removeAnimation(child, attr);
      }
    } else if (AttributeLerp.isAttributeLerp(child)) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.removeLerp(child, attr);
      }
    }
  }
  elementSetAttribute(key, newValue) {
    const state = this.stateByAttribute[key];
    if (!state) {
      return;
    }
    state.attributeState.elementValue = newValue;
    if (this.hasTicked) {
      state.attributeState.previousValue = state.attributeState.latestValue;
    } else {
      state.attributeState.previousValue = newValue;
    }
    if (this.element.isConnected) {
      state.attributeState.elementValueSetTime = this.element.getWindowTime();
    } else {
      state.attributeState.elementValueSetTime = null;
    }
    if (state.animationsSet.size > 0 || state.lerpsSet.size > 0) {
      return;
    }
    updateIfChangedValue(state, newValue);
  }
  getAttributesForAttributeValue(attr) {
    if (attr === "all") {
      return Object.keys(this.stateByAttribute);
    }
    return attr.split(",").map((a) => a.trim()).filter((a) => this.stateByAttribute[a]);
  }
  addLerp(lerp, attributeValue) {
    const attributes = this.getAttributesForAttributeValue(attributeValue);
    for (const key of attributes) {
      const state = this.stateByAttribute[key];
      if (!state) {
        return;
      }
      if (state.animationsSet.size === 0 && state.lerpsSet.size === 0) {
        this.documentTimeTickListener = this.element.addDocumentTimeTickListener((documentTime) => {
          this.updateTime(documentTime);
        });
      }
      this.allLerps.add(lerp);
      state.lerpsSet.add(lerp);
      state.lerpsInOrder = [];
      const elementChildren = Array.from(this.element.children);
      for (const child of elementChildren) {
        if (state.lerpsSet.has(child)) {
          state.lerpsInOrder.push(child);
        }
      }
    }
  }
  removeLerp(lerp, attributeValue) {
    const attributes = this.getAttributesForAttributeValue(attributeValue);
    for (const key of attributes) {
      const state = this.stateByAttribute[key];
      if (!state) {
        return;
      }
      state.lerpsInOrder.splice(state.lerpsInOrder.indexOf(lerp), 1);
      state.lerpsSet.delete(lerp);
      if (state.animationsSet.size === 0) {
        updateIfChangedValue(state, state.attributeState.elementValue);
      }
      this.allLerps.delete(lerp);
      if (this.allLerps.size === 0) {
        if (this.documentTimeTickListener) {
          this.documentTimeTickListener.remove();
          this.documentTimeTickListener = null;
        }
      }
    }
  }
  addAnimation(animation, key) {
    const state = this.stateByAttribute[key];
    if (!state) {
      return;
    }
    if (state.animationsSet.size === 0 && state.lerpsSet.size === 0) {
      this.documentTimeTickListener = this.element.addDocumentTimeTickListener((documentTime) => {
        this.updateTime(documentTime);
      });
    }
    this.allAnimations.add(animation);
    state.animationsSet.add(animation);
    state.animationsInOrder = [];
    const elementChildren = Array.from(this.element.children);
    for (const child of elementChildren) {
      if (state.animationsSet.has(child)) {
        state.animationsInOrder.push(child);
      }
    }
  }
  removeAnimation(animation, key) {
    const state = this.stateByAttribute[key];
    if (!state) {
      return;
    }
    state.animationsInOrder.splice(state.animationsInOrder.indexOf(animation), 1);
    state.animationsSet.delete(animation);
    if (state.animationsSet.size === 0) {
      updateIfChangedValue(state, state.attributeState.elementValue);
    }
    this.allAnimations.delete(animation);
    if (this.allAnimations.size === 0) {
      if (this.documentTimeTickListener) {
        this.documentTimeTickListener.remove();
        this.documentTimeTickListener = null;
      }
    }
  }
  updateTime(documentTime) {
    this.hasTicked = true;
    for (const key in this.stateByAttribute) {
      let stale = null;
      const state = this.stateByAttribute[key];
      for (const animation of state.animationsInOrder) {
        const [newValue, active] = state.attributeState.type === 2 ? animation.getColorValueForTime(documentTime) : animation.getFloatValueForTime(documentTime);
        if (active === 0) {
          updateIfChangedValue(state, newValue);
          stale = null;
          break;
        } else {
          if (stale === null) {
            stale = { value: newValue, state: active };
          } else {
            const isAboutToStartRatherThanEnded = stale.state > 0 && active < 0;
            const isMoreRecentEnd = stale.state > 0 && active > 0 && stale.state > active;
            const isSoonerToStart = stale.state < 0 && active < 0 && stale.state < active;
            if (isAboutToStartRatherThanEnded || isMoreRecentEnd || isSoonerToStart) {
              stale = { value: newValue, state: active };
            }
          }
        }
      }
      if (stale !== null) {
        updateIfChangedValue(state, stale.value);
        continue;
      }
      if (state.lerpsInOrder.length > 0) {
        const lerp = state.lerpsInOrder[0];
        const config = state.attributeState;
        if (config.elementValueSetTime !== null && config.previousValue !== null && config.elementValue !== null) {
          if (isColorAttribute(config)) {
            updateIfChangedValue(
              state,
              lerp.getColorValueForTime(
                this.element.getWindowTime(),
                config.elementValueSetTime,
                config.elementValue,
                config.previousValue
              )
            );
          } else if (isDegreesAttribute(config)) {
            updateIfChangedValue(
              state,
              lerp.getFloatValueForTime(
                this.element.getWindowTime(),
                config.elementValueSetTime,
                config.elementValue,
                config.previousValue,
                true
              )
            );
          } else if (isNumberAttribute(config)) {
            updateIfChangedValue(
              state,
              lerp.getFloatValueForTime(
                this.element.getWindowTime(),
                config.elementValueSetTime,
                config.elementValue,
                config.previousValue,
                false
              )
            );
          }
        }
      }
    }
  }
  reset() {
    for (const key in this.handlers) {
      const state = TupleToState(this.handlers[key]);
      this.stateByAttribute[key] = {
        attributeState: state,
        animationsInOrder: [],
        animationsSet: /* @__PURE__ */ new Set(),
        lerpsInOrder: [],
        lerpsSet: /* @__PURE__ */ new Set()
      };
    }
  }
};
var easingFunctions = {
  easeInQuad(t, b, c, d) {
    return c * (t /= d) * t + b;
  },
  easeOutQuad(t, b, c, d) {
    return -c * (t /= d) * (t - 2) + b;
  },
  easeInOutQuad(t, b, c, d) {
    if ((t /= d / 2) < 1) return c / 2 * t * t + b;
    return -c / 2 * (--t * (t - 2) - 1) + b;
  },
  easeInCubic(t, b, c, d) {
    return c * (t /= d) * t * t + b;
  },
  easeOutCubic(t, b, c, d) {
    return c * ((t = t / d - 1) * t * t + 1) + b;
  },
  easeInOutCubic(t, b, c, d) {
    if ((t /= d / 2) < 1) return c / 2 * t * t * t + b;
    return c / 2 * ((t -= 2) * t * t + 2) + b;
  },
  easeInQuart(t, b, c, d) {
    return c * (t /= d) * t * t * t + b;
  },
  easeOutQuart(t, b, c, d) {
    return -c * ((t = t / d - 1) * t * t * t - 1) + b;
  },
  easeInOutQuart(t, b, c, d) {
    if ((t /= d / 2) < 1) return c / 2 * t * t * t * t + b;
    return -c / 2 * ((t -= 2) * t * t * t - 2) + b;
  },
  easeInQuint(t, b, c, d) {
    return c * (t /= d) * t * t * t * t + b;
  },
  easeOutQuint(t, b, c, d) {
    return c * ((t = t / d - 1) * t * t * t * t + 1) + b;
  },
  easeInOutQuint(t, b, c, d) {
    if ((t /= d / 2) < 1) return c / 2 * t * t * t * t * t + b;
    return c / 2 * ((t -= 2) * t * t * t * t + 2) + b;
  },
  easeInSine(t, b, c, d) {
    return -c * Math.cos(t / d * (Math.PI / 2)) + c + b;
  },
  easeOutSine(t, b, c, d) {
    return c * Math.sin(t / d * (Math.PI / 2)) + b;
  },
  easeInOutSine(t, b, c, d) {
    return -c / 2 * (Math.cos(Math.PI * t / d) - 1) + b;
  },
  easeInExpo(t, b, c, d) {
    return t === 0 ? b : c * Math.pow(2, 10 * (t / d - 1)) + b;
  },
  easeOutExpo(t, b, c, d) {
    return t === d ? b + c : c * (-Math.pow(2, -10 * t / d) + 1) + b;
  },
  easeInOutExpo(t, b, c, d) {
    if (t === 0) return b;
    if (t === d) return b + c;
    if ((t /= d / 2) < 1) return c / 2 * Math.pow(2, 10 * (t - 1)) + b;
    return c / 2 * (-Math.pow(2, -10 * --t) + 2) + b;
  },
  easeInCirc(t, b, c, d) {
    return -c * (Math.sqrt(1 - (t /= d) * t) - 1) + b;
  },
  easeOutCirc(t, b, c, d) {
    return c * Math.sqrt(1 - (t = t / d - 1) * t) + b;
  },
  easeInOutCirc(t, b, c, d) {
    if ((t /= d / 2) < 1) return -c / 2 * (Math.sqrt(1 - t * t) - 1) + b;
    return c / 2 * (Math.sqrt(1 - (t -= 2) * t) + 1) + b;
  },
  easeInElastic(t, b, c, d) {
    let s = 1.70158;
    let p = 0;
    let a = c;
    if (t === 0) return b;
    if ((t /= d) === 1) return b + c;
    if (!p) p = d * 0.3;
    if (a < Math.abs(c)) {
      a = c;
      s = p / 4;
    } else {
      s = p / (2 * Math.PI) * Math.asin(c / a);
    }
    return -(a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p)) + b;
  },
  easeOutElastic(t, b, c, d) {
    let s = 1.70158;
    let p = 0;
    let a = c;
    if (t === 0) return b;
    if ((t /= d) === 1) return b + c;
    if (!p) p = d * 0.3;
    if (a < Math.abs(c)) {
      a = c;
      s = p / 4;
    } else {
      s = p / (2 * Math.PI) * Math.asin(c / a);
    }
    return a * Math.pow(2, -10 * t) * Math.sin((t * d - s) * (2 * Math.PI) / p) + c + b;
  },
  easeInOutElastic(t, b, c, d) {
    let s = 1.70158;
    let p = 0;
    let a = c;
    if (t === 0) return b;
    if ((t /= d / 2) === 2) return b + c;
    if (!p) p = d * (0.3 * 1.5);
    if (a < Math.abs(c)) {
      a = c;
      s = p / 4;
    } else {
      s = p / (2 * Math.PI) * Math.asin(c / a);
    }
    if (t < 1)
      return -0.5 * (a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p)) + b;
    return a * Math.pow(2, -10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p) * 0.5 + c + b;
  },
  easeInBack(t, b, c, d) {
    const s = 1.70158;
    return c * (t /= d) * t * ((s + 1) * t - s) + b;
  },
  easeOutBack(t, b, c, d) {
    const s = 1.70158;
    return c * ((t = t / d - 1) * t * ((s + 1) * t + s) + 1) + b;
  },
  easeInOutBack(t, b, c, d) {
    let s = 1.70158;
    if ((t /= d / 2) < 1) return c / 2 * (t * t * (((s *= 1.525) + 1) * t - s)) + b;
    return c / 2 * ((t -= 2) * t * (((s *= 1.525) + 1) * t + s) + 2) + b;
  },
  easeInBounce(t, b, c, d) {
    return c - easingFunctions.easeOutBounce(d - t, 0, c, d) + b;
  },
  easeOutBounce(t, b, c, d) {
    if ((t /= d) < 1 / 2.75) {
      return c * (7.5625 * t * t) + b;
    } else if (t < 2 / 2.75) {
      return c * (7.5625 * (t -= 1.5 / 2.75) * t + 0.75) + b;
    } else if (t < 2.5 / 2.75) {
      return c * (7.5625 * (t -= 2.25 / 2.75) * t + 0.9375) + b;
    } else {
      return c * (7.5625 * (t -= 2.625 / 2.75) * t + 0.984375) + b;
    }
  },
  easeInOutBounce(t, b, c, d) {
    if (t < d / 2) return easingFunctions.easeInBounce(t * 2, 0, c, d) * 0.5 + b;
    return easingFunctions.easeOutBounce(t * 2 - d, 0, c, d) * 0.5 + c * 0.5 + b;
  }
};
var easingsByName = easingFunctions;
var StartOfAnimationSymbol = Symbol("Start");
var EndOfAnimationSymbol = Symbol("End");
function getEasedRatioForTime(docTimeMs, props) {
  if (props.pauseTime !== null && docTimeMs >= props.pauseTime) {
    docTimeMs = props.pauseTime;
  }
  let elapsedTime = docTimeMs - props.startTime;
  if (elapsedTime < 0) {
    return [StartOfAnimationSymbol, elapsedTime];
  } else if (elapsedTime < props.animDuration || props.loop) {
    if (props.loop) {
      elapsedTime = elapsedTime % props.animDuration;
    }
    let elapsedRatio = elapsedTime / props.animDuration;
    if (props.pingPong) {
      let pingPongDelayRatio = props.pingPongDelay / props.animDuration;
      if (pingPongDelayRatio < 0) {
        pingPongDelayRatio = 0;
      }
      if (pingPongDelayRatio > 0.5) {
        pingPongDelayRatio = 0.5;
      }
      if (elapsedRatio < pingPongDelayRatio / 2) {
        elapsedRatio = 0;
      } else if (elapsedRatio > 0.5 - pingPongDelayRatio / 2 && elapsedRatio < 0.5 + pingPongDelayRatio / 2) {
        elapsedRatio = 1;
      } else if (elapsedRatio > 1 - pingPongDelayRatio / 2) {
        elapsedRatio = 0;
      } else {
        if (elapsedRatio > 0.5) {
          elapsedRatio = (elapsedRatio - 0.5 - pingPongDelayRatio / 2) * 2 / (1 - pingPongDelayRatio * 2);
          elapsedRatio = 1 - elapsedRatio;
        } else {
          elapsedRatio = (elapsedRatio - pingPongDelayRatio / 2) * 2 / (1 - pingPongDelayRatio * 2);
        }
      }
    }
    let newValue;
    const easingFunction = easingsByName[props.easing];
    if (easingFunction) {
      newValue = easingFunction(elapsedRatio, 0, 1, 1);
    } else {
      newValue = elapsedRatio;
    }
    return [newValue, 0];
  } else {
    if (props.pingPong) {
      return [StartOfAnimationSymbol, elapsedTime - props.animDuration];
    }
    return [EndOfAnimationSymbol, elapsedTime - props.animDuration];
  }
}
var Quat = class _Quat {
  constructor(x, y, z, w) {
    if (x instanceof _Quat) {
      this.x = x.x;
      this.y = x.y;
      this.z = x.z;
      this.w = x.w;
      return;
    }
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
    this.w = w || 1;
  }
  copy(other) {
    this.x = other.x || 0;
    this.y = other.y || 0;
    this.z = other.z || 0;
    this.w = other.w || 0;
    return this;
  }
  multiply(q) {
    return this.multiplyQuaternions(this, q);
  }
  premultiply(q) {
    return this.multiplyQuaternions(q, this);
  }
  multiplyQuaternions(a, b) {
    const qax = a.x;
    const qay = a.y;
    const qaz = a.z;
    const qaw = a.w;
    const qbx = b.x;
    const qby = b.y;
    const qbz = b.z;
    const qbw = b.w;
    this.x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
    this.y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
    this.z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
    this.w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;
    return this;
  }
  setFromEulerXYZ(euler) {
    const x = euler.x;
    const y = euler.y;
    const z = euler.z;
    const cos = Math.cos;
    const sin = Math.sin;
    const c1 = cos(x / 2);
    const c2 = cos(y / 2);
    const c3 = cos(z / 2);
    const s1 = sin(x / 2);
    const s2 = sin(y / 2);
    const s3 = sin(z / 2);
    this.x = s1 * c2 * c3 + c1 * s2 * s3;
    this.y = c1 * s2 * c3 - s1 * c2 * s3;
    this.z = c1 * c2 * s3 + s1 * s2 * c3;
    this.w = c1 * c2 * c3 - s1 * s2 * s3;
    return this;
  }
  setFromRotationMatrix(m) {
    const te = m.data, m11 = te[0], m12 = te[4], m13 = te[8], m21 = te[1], m22 = te[5], m23 = te[9], m31 = te[2], m32 = te[6], m33 = te[10], trace = m11 + m22 + m33;
    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1);
      this.w = 0.25 / s;
      this.x = (m32 - m23) * s;
      this.y = (m13 - m31) * s;
      this.z = (m21 - m12) * s;
    } else if (m11 > m22 && m11 > m33) {
      const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
      this.w = (m32 - m23) / s;
      this.x = 0.25 * s;
      this.y = (m12 + m21) / s;
      this.z = (m13 + m31) / s;
    } else if (m22 > m33) {
      const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
      this.w = (m13 - m31) / s;
      this.x = (m12 + m21) / s;
      this.y = 0.25 * s;
      this.z = (m23 + m32) / s;
    } else {
      const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
      this.w = (m21 - m12) / s;
      this.x = (m13 + m31) / s;
      this.y = (m23 + m32) / s;
      this.z = 0.25 * s;
    }
    return this;
  }
  setFromAxisAngle(axis, angle) {
    const halfAngle = angle / 2;
    const s = Math.sin(halfAngle);
    this.x = axis.x * s;
    this.y = axis.y * s;
    this.z = axis.z * s;
    this.w = Math.cos(halfAngle);
    return this;
  }
  clone() {
    return new _Quat(this);
  }
  set(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }
};
var Vect3 = class _Vect3 {
  constructor(x, y, z) {
    if (x && typeof x === "object") {
      this.x = x.x;
      this.y = x.y;
      this.z = x.z;
      return;
    }
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
  }
  copy(other) {
    this.x = other.x || 0;
    this.y = other.y || 0;
    this.z = other.z || 0;
    return this;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  lengthSquared() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  clone() {
    return new _Vect3(this);
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  applyMatrix4(matrix) {
    const x = this.x;
    const y = this.y;
    const z = this.z;
    const e = matrix.data;
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    return this;
  }
  add(other) {
    this.x += other.x || 0;
    this.y += other.y || 0;
    this.z += other.z || 0;
    return this;
  }
  sub(other) {
    this.x -= other.x || 0;
    this.y -= other.y || 0;
    this.z -= other.z || 0;
    return this;
  }
};
var Vect3Zeroes = { x: 0, y: 0, z: 0 };
var Vect3Ones = { x: 1, y: 1, z: 1 };
var _Matr4 = class _Matr42 {
  constructor(data) {
    if (data instanceof _Matr42) {
      this.data = [...data.data];
    } else if (data instanceof Array) {
      this.data = [...data];
    } else if (data instanceof Float32Array) {
      this.data = [...data];
    } else {
      this.data = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    }
  }
  identity() {
    this.data = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    return this;
  }
  copy(m) {
    this.data = [...m.data];
    return this;
  }
  set(...args) {
    if (args[0] instanceof Array) {
      this.data = args[0];
    } else {
      this.data = args;
    }
    return this;
  }
  setRotationFromQuaternion(q) {
    return this.compose(Vect3Zeroes, q, Vect3Ones);
  }
  clone() {
    return new _Matr42(this.data);
  }
  determinant() {
    const te = this.data;
    const n11 = te[0], n12 = te[4], n13 = te[8], n14 = te[12];
    const n21 = te[1], n22 = te[5], n23 = te[9], n24 = te[13];
    const n31 = te[2], n32 = te[6], n33 = te[10], n34 = te[14];
    const n41 = te[3], n42 = te[7], n43 = te[11], n44 = te[15];
    return n41 * (+n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34) + n42 * (+n11 * n23 * n34 - n11 * n24 * n33 + n14 * n21 * n33 - n13 * n21 * n34 + n13 * n24 * n31 - n14 * n23 * n31) + n43 * (+n11 * n24 * n32 - n11 * n22 * n34 - n14 * n21 * n32 + n12 * n21 * n34 + n14 * n22 * n31 - n12 * n24 * n31) + n44 * (-n13 * n22 * n31 - n11 * n23 * n32 + n11 * n22 * n33 + n13 * n21 * n32 - n12 * n21 * n33 + n12 * n23 * n31);
  }
  makeRotationX(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    this.set(1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1);
    return this;
  }
  makeRotationY(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    this.set(c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1);
    return this;
  }
  makeRotationZ(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    this.set(c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    return this;
  }
  makeTranslation(x, y, z) {
    this.set(1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1);
    return this;
  }
  makeScale(x, y, z) {
    this.set(x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1);
    return this;
  }
  compose(position, quaternion, scale) {
    const te = this.data;
    const x = quaternion.x, y = quaternion.y, z = quaternion.z, w = quaternion.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = scale.x, sy = scale.y, sz = scale.z;
    te[0] = (1 - (yy + zz)) * sx;
    te[1] = (xy + wz) * sx;
    te[2] = (xz - wy) * sx;
    te[3] = 0;
    te[4] = (xy - wz) * sy;
    te[5] = (1 - (xx + zz)) * sy;
    te[6] = (yz + wx) * sy;
    te[7] = 0;
    te[8] = (xz + wy) * sz;
    te[9] = (yz - wx) * sz;
    te[10] = (1 - (xx + yy)) * sz;
    te[11] = 0;
    te[12] = position.x;
    te[13] = position.y;
    te[14] = position.z;
    te[15] = 1;
    return this;
  }
  decompose(position, quaternion, scale) {
    const te = this.data;
    const _v1 = _Matr42.tempVect3;
    let sx = _v1.set(te[0], te[1], te[2]).length();
    const sy = _v1.set(te[4], te[5], te[6]).length();
    const sz = _v1.set(te[8], te[9], te[10]).length();
    const det = this.determinant();
    if (det < 0) sx = -sx;
    position.x = te[12];
    position.y = te[13];
    position.z = te[14];
    const _m1 = _Matr42.tempMatr4;
    _m1.copy(this);
    const invSX = 1 / sx;
    const invSY = 1 / sy;
    const invSZ = 1 / sz;
    _m1.data[0] *= invSX;
    _m1.data[1] *= invSX;
    _m1.data[2] *= invSX;
    _m1.data[4] *= invSY;
    _m1.data[5] *= invSY;
    _m1.data[6] *= invSY;
    _m1.data[8] *= invSZ;
    _m1.data[9] *= invSZ;
    _m1.data[10] *= invSZ;
    const _q1 = _Matr42.tempQuat;
    _q1.setFromRotationMatrix(_m1);
    quaternion.x = _q1.x;
    quaternion.y = _q1.y;
    quaternion.z = _q1.z;
    quaternion.w = _q1.w;
    scale.x = sx;
    scale.y = sy;
    scale.z = sz;
    return this;
  }
  multiply(m) {
    return this.multiplyMatrices(this, m);
  }
  premultiply(m) {
    return this.multiplyMatrices(m, this);
  }
  multiplyMatrices(a, b) {
    const ae = a.data;
    const be = b.data;
    const te = this.data;
    const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
    const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
    const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
    const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];
    const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
    const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
    const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
    const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];
    te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
    te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
    te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
    te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
    return this;
  }
  invert() {
    const te = this.data, n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3], n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7], n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11], n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15], t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44, t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44, t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44, t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;
    const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
    if (det === 0) {
      return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
    const detInv = 1 / det;
    te[0] = t11 * detInv;
    te[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv;
    te[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv;
    te[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv;
    te[4] = t12 * detInv;
    te[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv;
    te[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv;
    te[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv;
    te[8] = t13 * detInv;
    te[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv;
    te[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv;
    te[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv;
    te[12] = t14 * detInv;
    te[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv;
    te[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv;
    te[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv;
    return this;
  }
};
_Matr4.tempMatr4 = new _Matr4();
_Matr4.tempVect3 = new Vect3();
_Matr4.tempQuat = new Quat();
var Matr4 = _Matr4;
var epsilon = 1e-4;
var matrix1 = new Matr4();
var vector1 = new Vect3();
var OrientedBoundingBox = class _OrientedBoundingBox {
  constructor(size, matr4, centerOffset = null) {
    this.size = size;
    this.matr4 = matr4;
    this.centerOffset = centerOffset;
  }
  static fromSizeAndMatrixWorld(size, matr4) {
    return new _OrientedBoundingBox(size, matr4);
  }
  static fromSizeMatrixWorldAndCenter(size, matr4, centerOffset) {
    return new _OrientedBoundingBox(size, matr4, centerOffset);
  }
  static fromMatrixWorld(matr4) {
    return new _OrientedBoundingBox(new Vect3(), matr4);
  }
  getCorners() {
    const corners = [];
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        for (let z = -1; z <= 1; z += 2) {
          const point = vector1.set(
            x * (this.size.x / 2),
            y * (this.size.y / 2),
            z * (this.size.z / 2)
          );
          if (this.centerOffset !== null) {
            point.add(this.centerOffset);
          }
          point.applyMatrix4(this.matr4);
          corners.push(point.clone());
        }
      }
    }
    return corners;
  }
  completelyContainsBoundingBox(childOBB) {
    const invertedMatrix = matrix1.copy(this.matr4).invert();
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        for (let z = -1; z <= 1; z += 2) {
          const point = vector1.set(
            x * (childOBB.size.x / 2),
            y * (childOBB.size.y / 2),
            z * (childOBB.size.z / 2)
          );
          if (childOBB.centerOffset !== null) {
            point.add(childOBB.centerOffset);
          }
          point.applyMatrix4(childOBB.matr4);
          const localPoint = point.applyMatrix4(invertedMatrix);
          if (this.centerOffset !== null) {
            localPoint.sub(this.centerOffset);
          }
          const isWithin = Math.abs(localPoint.x) <= this.size.x / 2 + epsilon && Math.abs(localPoint.y) <= this.size.y / 2 + epsilon && Math.abs(localPoint.z) <= this.size.z / 2 + epsilon;
          if (!isWithin) {
            return false;
          }
        }
      }
    }
    return true;
  }
  containsPoint(point) {
    const invertedMatrix = matrix1.copy(this.matr4).invert();
    const localPoint = vector1.copy(point).applyMatrix4(invertedMatrix);
    if (this.centerOffset !== null) {
      localPoint.sub(this.centerOffset);
    }
    return Math.abs(localPoint.x) <= this.size.x / 2 + epsilon && Math.abs(localPoint.y) <= this.size.y / 2 + epsilon && Math.abs(localPoint.z) <= this.size.z / 2 + epsilon;
  }
};
var CanvasText = class {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.context = this.canvas.getContext("2d");
  }
  renderText(message, options) {
    const fontsize = options.fontSize;
    const textColor = options.textColorRGB255A1;
    const backgroundColor = options.backgroundColorRGB255A1 || { r: 255, g: 255, b: 255, a: 1 };
    const padding = options.paddingPx || 0;
    const font = options.font || "Arial";
    const fontString = (options.bold ? "bold " : "") + fontsize + "px " + font;
    const textAlign = options.alignment ?? "left";
    if (options.dimensions) {
      this.canvas.width = options.dimensions.width;
      this.canvas.height = options.dimensions.height;
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.context.font = fontString;
      this.context.textAlign = textAlign;
      this.context.fillStyle = `rgba(${backgroundColor.r}, ${backgroundColor.g}, ${backgroundColor.b}, ${backgroundColor.a})`;
      this.context.lineWidth = 0;
      this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.context.fillStyle = `rgba(${textColor.r}, ${textColor.g}, ${textColor.b}, ${textColor.a})`;
      this.context.font = fontString;
      printAtWordWrap(
        this.context,
        message,
        textAlign,
        fontsize,
        fontsize,
        this.canvas.width,
        padding
      );
    } else {
      this.context.font = fontString;
      const metrics = this.context.measureText(message);
      const textWidth = metrics.width;
      const textHeight = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
      this.canvas.width = textWidth + padding * 2;
      this.canvas.height = textHeight + padding;
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.context.font = fontString;
      this.context.textAlign = textAlign;
      this.context.fillStyle = `rgba(${backgroundColor.r}, ${backgroundColor.g}, ${backgroundColor.b}, ${backgroundColor.a})`;
      this.context.lineWidth = 0;
      this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.context.fillStyle = `rgba(${textColor.r}, ${textColor.g}, ${textColor.b}, ${textColor.a})`;
      this.context.font = fontString;
      this.context.fillText(
        message,
        padding + getTextAlignOffset(textAlign, textWidth),
        textHeight
      );
    }
    return this.canvas;
  }
};
function printAtWordWrap(context, fullText, textAlign, y, lineHeight, fitWidth, padding) {
  const x = getTextAlignOffset(textAlign, fitWidth - padding * 2);
  const lines = fullText.split("\n");
  let currentLine = 0;
  for (const text of lines) {
    fitWidth = fitWidth || 0;
    if (fitWidth <= 0) {
      context.fillText(text, x, y + lineHeight * currentLine);
      currentLine++;
      continue;
    }
    let words = text.split(" ");
    let lastWordIndex = 1;
    while (words.length > 0 && lastWordIndex <= words.length) {
      const str = words.slice(0, lastWordIndex).join(" ");
      const textWidth = context.measureText(str).width;
      if (textWidth + padding * 2 > fitWidth) {
        if (lastWordIndex === 1) {
          lastWordIndex = 2;
        }
        context.fillText(
          words.slice(0, lastWordIndex - 1).join(" "),
          x + padding,
          y + lineHeight * currentLine + padding
        );
        currentLine++;
        words = words.splice(lastWordIndex - 1);
        lastWordIndex = 1;
      } else {
        lastWordIndex++;
      }
    }
    if (lastWordIndex > 0 && words.length > 0) {
      context.fillText(words.join(" "), x + padding, y + lineHeight * currentLine + padding);
      currentLine++;
    }
  }
}
function getTextAlignOffset(textAlign, width) {
  switch (textAlign) {
    case "center":
      return width / 2;
    case "right":
      return width;
    default:
      return 0;
  }
}
var collideAttributeName = "collide";
var collisionIntervalAttributeName = "collision-interval";
var defaultCollideable = true;
var _CollideableHelper = class _CollideableHelper2 {
  constructor(element) {
    this.props = {
      collide: defaultCollideable
    };
    this.scene = null;
    this.collider = null;
    this.added = false;
    this.enabled = true;
    this.element = element;
  }
  enable() {
    if (this.enabled) {
      return;
    }
    this.enabled = true;
    this.updateCollider(this.collider);
  }
  disable() {
    if (!this.enabled) {
      return;
    }
    this.enabled = false;
    this.updateCollider(this.collider);
  }
  updateCollider(collider) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!this.element.isConnected) {
      this.collider = collider;
      return;
    }
    this.scene = this.element.getScene();
    const previousCollider = this.collider;
    const colliderChanged = previousCollider !== collider;
    if (colliderChanged) {
      this.added = false;
    }
    this.collider = collider;
    const shouldEnableCollider = this.props.collide && this.enabled;
    if (!shouldEnableCollider && previousCollider === null) {
      this.added = false;
      return;
    }
    if (shouldEnableCollider) {
      if (colliderChanged && previousCollider !== null) {
        (_b = (_a = this.scene).removeCollider) == null ? void 0 : _b.call(_a, previousCollider, this.element);
      }
      if (collider !== null) {
        if (this.added) {
          (_d = (_c = this.scene).updateCollider) == null ? void 0 : _d.call(_c, collider, this.element);
        } else {
          this.added = true;
          (_f = (_e = this.scene).addCollider) == null ? void 0 : _f.call(_e, collider, this.element);
        }
      }
    } else {
      if (previousCollider !== null) {
        this.added = false;
        (_h = (_g = this.scene).removeCollider) == null ? void 0 : _h.call(_g, previousCollider, this.element);
      }
    }
  }
  removeColliders() {
    var _a;
    const scene2 = this.scene;
    if (!scene2) {
      return;
    }
    if (!this.collider) {
      return;
    }
    (_a = scene2.removeCollider) == null ? void 0 : _a.call(scene2, this.collider, this.element);
    this.scene = null;
  }
  handle(name, newValue) {
    _CollideableHelper2.AttributeHandler.handle(this, name, newValue);
  }
  parentTransformed() {
    this.updateCollider(this.collider);
  }
};
_CollideableHelper.AttributeHandler = new AttributeHandler({
  [collideAttributeName]: (instance, newValue) => {
    const collide = parseBoolAttribute(newValue, defaultCollideable);
    if (collide !== instance.props.collide) {
      instance.props.collide = collide;
      instance.updateCollider(instance.collider);
    }
  },
  [collisionIntervalAttributeName]: () => {
  }
});
_CollideableHelper.observedAttributes = _CollideableHelper.AttributeHandler.getAttributes();
var CollideableHelper = _CollideableHelper;
var debugAttributeName = "debug";
var DebugHelper = class {
  constructor(element) {
    this.element = element;
    this.debugGraphics = null;
  }
  getContainer() {
    return this.element.getContainer();
  }
  handle(name, newValue) {
    var _a;
    if (name === debugAttributeName) {
      if (parseBoolAttribute(newValue, false)) {
        if (!this.debugGraphics) {
          this.debugGraphics = this.element.getScene().getGraphicsAdapter().getGraphicsAdapterFactory().MMLDebugHelperGraphicsInterface(this);
        }
      } else {
        (_a = this.debugGraphics) == null ? void 0 : _a.dispose();
        this.debugGraphics = null;
      }
    }
  }
};
DebugHelper.observedAttributes = [debugAttributeName];
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
var _EulXYZ = class _EulXYZ2 {
  constructor(x, y, z) {
    if (x instanceof _EulXYZ2) {
      this.x = x.x;
      this.y = x.y;
      this.z = x.z;
      return;
    }
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
  }
  setFromRotationMatrix(m) {
    const d = m.data;
    const m11 = d[0];
    const m12 = d[4];
    const m13 = d[8];
    const m22 = d[5];
    const m23 = d[9];
    const m32 = d[6];
    const m33 = d[10];
    this.y = Math.asin(clamp(m13, -1, 1));
    if (Math.abs(m13) < 0.9999999) {
      this.x = Math.atan2(-m23, m33);
      this.z = Math.atan2(-m12, m11);
    } else {
      this.x = Math.atan2(m32, m22);
      this.z = 0;
    }
    return this;
  }
  setFromQuaternion(q) {
    const matrix = _EulXYZ2.tempMatrix;
    matrix.setRotationFromQuaternion(q);
    return this.setFromRotationMatrix(matrix);
  }
  copy(other) {
    this.x = other.x || 0;
    this.y = other.y || 0;
    this.z = other.z || 0;
    return this;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  lengthSquared() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  clone() {
    return new _EulXYZ2(this);
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
};
_EulXYZ.tempMatrix = new Matr4();
var EulXYZ = _EulXYZ;
function radToDeg(rad) {
  return rad * (180 / Math.PI);
}
function degToRad(deg) {
  return deg * (Math.PI / 180);
}
function minimumNonZero(value) {
  return value === 0 ? 1e-6 : value;
}
var defaultVisible = true;
var _TransformableElement = class _TransformableElement2 extends MElement {
  constructor() {
    super(...arguments);
    this.isTransformableElement = true;
    this.transformableElementProps = {
      socket: null,
      x: 0,
      y: 0,
      z: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      sx: 1,
      sy: 1,
      sz: 1
    };
    this.desiredVisible = defaultVisible;
    this.appliedBounds = /* @__PURE__ */ new Map();
    this.directlyDisabledByBounds = false;
    this.disabledByParent = false;
    this.transformableElementGraphics = null;
    this.transformableAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
      x: [
        0,
        0,
        (newValue) => {
          var _a;
          this.transformableElementProps.x = newValue;
          (_a = this.transformableElementGraphics) == null ? void 0 : _a.setX(newValue, this.transformableElementProps);
          this.didUpdateTransformation();
        }
      ],
      y: [
        0,
        0,
        (newValue) => {
          var _a;
          this.transformableElementProps.y = newValue;
          (_a = this.transformableElementGraphics) == null ? void 0 : _a.setY(newValue, this.transformableElementProps);
          this.didUpdateTransformation();
        }
      ],
      z: [
        0,
        0,
        (newValue) => {
          var _a;
          this.transformableElementProps.z = newValue;
          (_a = this.transformableElementGraphics) == null ? void 0 : _a.setZ(newValue, this.transformableElementProps);
          this.didUpdateTransformation();
        }
      ],
      rx: [
        1,
        0,
        (newValue) => {
          var _a;
          this.transformableElementProps.rx = newValue;
          (_a = this.transformableElementGraphics) == null ? void 0 : _a.setRotationX(newValue, this.transformableElementProps);
          this.didUpdateTransformation();
        }
      ],
      ry: [
        1,
        0,
        (newValue) => {
          var _a;
          this.transformableElementProps.ry = newValue;
          (_a = this.transformableElementGraphics) == null ? void 0 : _a.setRotationY(newValue, this.transformableElementProps);
          this.didUpdateTransformation();
        }
      ],
      rz: [
        1,
        0,
        (newValue) => {
          var _a;
          this.transformableElementProps.rz = newValue;
          (_a = this.transformableElementGraphics) == null ? void 0 : _a.setRotationZ(newValue, this.transformableElementProps);
          this.didUpdateTransformation();
        }
      ],
      sx: [
        0,
        1,
        (newValue) => {
          var _a;
          this.transformableElementProps.sx = newValue;
          (_a = this.transformableElementGraphics) == null ? void 0 : _a.setScaleX(
            minimumNonZero(newValue),
            this.transformableElementProps
          );
          this.didUpdateTransformation();
        }
      ],
      sy: [
        0,
        1,
        (newValue) => {
          var _a;
          this.transformableElementProps.sy = newValue;
          (_a = this.transformableElementGraphics) == null ? void 0 : _a.setScaleY(
            minimumNonZero(newValue),
            this.transformableElementProps
          );
          this.didUpdateTransformation();
        }
      ],
      sz: [
        0,
        1,
        (newValue) => {
          var _a;
          this.transformableElementProps.sz = newValue;
          (_a = this.transformableElementGraphics) == null ? void 0 : _a.setScaleZ(
            minimumNonZero(newValue),
            this.transformableElementProps
          );
          this.didUpdateTransformation();
        }
      ]
    });
    this.debugHelper = new DebugHelper(this);
  }
  static isTransformableElement(element) {
    return element.isTransformableElement;
  }
  getTransformableElementParent() {
    let parentNode = this.parentNode;
    while (parentNode != null) {
      if (_TransformableElement2.isTransformableElement(parentNode)) {
        return parentNode;
      }
      parentNode = parentNode.parentNode;
    }
    return null;
  }
  calculateLocalMatrix(matrix) {
    const pos = {
      x: this.transformableElementProps.x,
      y: this.transformableElementProps.y,
      z: this.transformableElementProps.z
    };
    const eulerXYZRotation = {
      x: degToRad(this.transformableElementProps.rx),
      y: degToRad(this.transformableElementProps.ry),
      z: degToRad(this.transformableElementProps.rz)
    };
    const scale = {
      x: this.transformableElementProps.sx,
      y: this.transformableElementProps.sy,
      z: this.transformableElementProps.sz
    };
    const quaternion = _TransformableElement2.tempQuat;
    quaternion.setFromEulerXYZ(eulerXYZRotation);
    matrix.compose(pos, quaternion, scale);
  }
  connectedCallback() {
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter() || this.transformableElementGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.transformableElementGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLTransformableGraphicsInterface(this);
    const mElementParent = this.getTransformableElementParent();
    if (mElementParent) {
      const parentBounds = mElementParent.getAppliedBounds();
      parentBounds.forEach((orientedBox, ref) => {
        this.addOrUpdateParentBound(ref, orientedBox);
      });
      return;
    }
  }
  disconnectedCallback() {
    var _a;
    this.transformableAnimatedAttributeHelper.reset();
    (_a = this.transformableElementGraphics) == null ? void 0 : _a.dispose();
    this.transformableElementGraphics = null;
    super.disconnectedCallback();
  }
  static get observedAttributes() {
    return [
      ..._TransformableElement2.TransformableElementAttributeHandler.getAttributes(),
      ...DebugHelper.observedAttributes
    ];
  }
  addSideEffectChild(child) {
    this.transformableAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }
  removeSideEffectChild(child) {
    this.transformableAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }
  applyBounds() {
    if (!this.transformableElementGraphics) {
      return;
    }
    const appliedBounds = this.getAppliedBounds();
    if (appliedBounds.size > 0) {
      const thisElementBounds = this.getContentBounds();
      if (thisElementBounds) {
        for (const [, orientedBox] of appliedBounds) {
          if (!orientedBox.completelyContainsBoundingBox(thisElementBounds)) {
            if (!this.directlyDisabledByBounds) {
              this.disabledByBounds();
            }
            return;
          }
        }
      }
    }
    this.reenableByBounds();
  }
  didUpdateTransformation() {
    this.applyBounds();
    this.parentTransformed();
    traverseImmediateTransformableElementChildren(this, (child) => {
      child.didUpdateTransformation();
    });
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.transformableElementGraphics) {
      return;
    }
    _TransformableElement2.TransformableElementAttributeHandler.handle(this, name, newValue);
    this.debugHelper.handle(name, newValue);
  }
  getAppliedBounds() {
    return this.appliedBounds;
  }
  addOrUpdateParentBound(ref, orientedBox) {
    this.appliedBounds.set(ref, orientedBox);
    traverseImmediateTransformableElementChildren(this, (child) => {
      child.addOrUpdateParentBound(ref, orientedBox);
    });
    this.applyBounds();
  }
  removeParentBound(ref) {
    this.appliedBounds.delete(ref);
    traverseImmediateTransformableElementChildren(this, (child) => {
      child.removeParentBound(ref);
    });
    this.applyBounds();
  }
  disabledByBounds() {
    if (this.directlyDisabledByBounds) {
      return;
    }
    this.directlyDisabledByBounds = true;
    this.updateVisibility();
    if (this.disabledByParent) {
      return;
    }
    this.disable();
    traverseImmediateTransformableElementChildren(this, (child) => {
      child.disabledByParentBounds();
    });
  }
  isDisabled() {
    return this.directlyDisabledByBounds || this.disabledByParent;
  }
  disabledByParentBounds() {
    if (this.disabledByParent) {
      return;
    }
    this.disabledByParent = true;
    this.updateVisibility();
    if (this.directlyDisabledByBounds) {
      return;
    }
    this.disable();
    traverseImmediateTransformableElementChildren(this, (child) => {
      child.disabledByParentBounds();
    });
  }
  reenableByBounds() {
    if (!this.directlyDisabledByBounds) {
      return;
    }
    this.directlyDisabledByBounds = false;
    if (!this.disabledByParent) {
      this.updateVisibility();
      this.enable();
      traverseImmediateTransformableElementChildren(this, (child) => {
        child.reenableByParentBounds();
      });
    }
  }
  reenableByParentBounds() {
    if (!this.disabledByParent) {
      return;
    }
    this.disabledByParent = false;
    if (!this.directlyDisabledByBounds) {
      this.updateVisibility();
      this.enable();
      traverseImmediateTransformableElementChildren(this, (child) => {
        child.reenableByParentBounds();
      });
    }
  }
  updateVisibility() {
    var _a;
    (_a = this.transformableElementGraphics) == null ? void 0 : _a.setVisible(
      this.desiredVisible && !this.isDisabled(),
      this.transformableElementProps
    );
  }
};
_TransformableElement.tempQuat = new Quat();
_TransformableElement.TransformableElementAttributeHandler = new AttributeHandler({
  x: (instance, newValue) => {
    instance.transformableAnimatedAttributeHelper.elementSetAttribute(
      "x",
      parseFloatAttribute(newValue, 0)
    );
  },
  y: (instance, newValue) => {
    instance.transformableAnimatedAttributeHelper.elementSetAttribute(
      "y",
      parseFloatAttribute(newValue, 0)
    );
  },
  z: (instance, newValue) => {
    instance.transformableAnimatedAttributeHelper.elementSetAttribute(
      "z",
      parseFloatAttribute(newValue, 0)
    );
  },
  rx: (instance, newValue) => {
    instance.transformableAnimatedAttributeHelper.elementSetAttribute(
      "rx",
      parseFloatAttribute(newValue, 0)
    );
  },
  ry: (instance, newValue) => {
    instance.transformableAnimatedAttributeHelper.elementSetAttribute(
      "ry",
      parseFloatAttribute(newValue, 0)
    );
  },
  rz: (instance, newValue) => {
    instance.transformableAnimatedAttributeHelper.elementSetAttribute(
      "rz",
      parseFloatAttribute(newValue, 0)
    );
  },
  sx: (instance, newValue) => {
    instance.transformableAnimatedAttributeHelper.elementSetAttribute(
      "sx",
      parseFloatAttribute(newValue, 1)
    );
  },
  sy: (instance, newValue) => {
    instance.transformableAnimatedAttributeHelper.elementSetAttribute(
      "sy",
      parseFloatAttribute(newValue, 1)
    );
  },
  sz: (instance, newValue) => {
    instance.transformableAnimatedAttributeHelper.elementSetAttribute(
      "sz",
      parseFloatAttribute(newValue, 1)
    );
  },
  visible: (instance, newValue) => {
    instance.desiredVisible = parseBoolAttribute(newValue, defaultVisible);
    instance.updateVisibility();
  },
  socket: (instance, newValue) => {
    var _a;
    instance.transformableElementProps.socket = newValue;
    (_a = instance.transformableElementGraphics) == null ? void 0 : _a.setSocket(
      newValue,
      instance.transformableElementProps
    );
    instance.applyBounds();
  }
});
var TransformableElement = _TransformableElement;
function traverseImmediateTransformableElementChildren(element, callback) {
  element.childNodes.forEach((child) => {
    if (TransformableElement.isTransformableElement(child)) {
      callback(child);
    } else {
      traverseImmediateTransformableElementChildren(child, callback);
    }
  });
}
var defaultAudioVolume = 1;
var defaultAudioLoop = true;
var defaultAudioEnabled = true;
var defaultAudioStartTime = 0;
var defaultAudioPauseTime = null;
var defaultAudioSrc = null;
var defaultAudioInnerConeAngle = 360;
var defaultAudioOuterConeAngle = 0;
var defaultAudioDebug = false;
function clampAudioConeAngle(angle) {
  return Math.max(Math.min(angle, 360), 0);
}
var _Audio = class _Audio2 extends TransformableElement {
  constructor() {
    super();
    this.props = {
      src: defaultAudioSrc,
      startTime: defaultAudioStartTime,
      pauseTime: defaultAudioPauseTime,
      loop: defaultAudioLoop,
      loopDuration: null,
      enabled: defaultAudioEnabled,
      volume: defaultAudioVolume,
      coneAngle: defaultAudioInnerConeAngle,
      coneFalloffAngle: defaultAudioOuterConeAngle,
      debug: false
    };
    this.audioGraphics = null;
    this.audioAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
      volume: [
        0,
        defaultAudioVolume,
        (newValue) => {
          var _a;
          this.props.volume = newValue;
          (_a = this.audioGraphics) == null ? void 0 : _a.setVolume(newValue, this.props);
        }
      ],
      "cone-angle": [
        0,
        defaultAudioInnerConeAngle,
        (newValue) => {
          var _a;
          this.props.coneAngle = newValue === null ? defaultAudioInnerConeAngle : clampAudioConeAngle(newValue);
          (_a = this.audioGraphics) == null ? void 0 : _a.setConeAngle(this.props.coneAngle, this.props);
        }
      ],
      "cone-falloff-angle": [
        0,
        defaultAudioOuterConeAngle,
        (newValue) => {
          var _a;
          this.props.coneFalloffAngle = clampAudioConeAngle(newValue);
          (_a = this.audioGraphics) == null ? void 0 : _a.setConeFalloffAngle(this.props.coneFalloffAngle, this.props);
        }
      ]
    });
  }
  static get observedAttributes() {
    return [...TransformableElement.observedAttributes, ..._Audio2.attributeHandler.getAttributes()];
  }
  enable() {
    var _a;
    (_a = this.audioGraphics) == null ? void 0 : _a.syncAudioTime();
  }
  disable() {
    var _a;
    (_a = this.audioGraphics) == null ? void 0 : _a.syncAudioTime();
  }
  getContentBounds() {
    if (!this.transformableElementGraphics) {
      return null;
    }
    return OrientedBoundingBox.fromMatrixWorld(this.transformableElementGraphics.getWorldMatrix());
  }
  addSideEffectChild(child) {
    this.audioAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }
  removeSideEffectChild(child) {
    this.audioAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }
  parentTransformed() {
  }
  isClickable() {
    return true;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.audioGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    _Audio2.attributeHandler.handle(this, name, newValue);
  }
  documentTimeChanged() {
    var _a;
    (_a = this.audioGraphics) == null ? void 0 : _a.syncAudioTime();
  }
  connectedCallback() {
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter() || this.audioGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.audioGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLAudioGraphicsInterface(this);
    this.documentTimeListener = this.addDocumentTimeListener(() => {
      this.documentTimeChanged();
    });
    for (const name of _Audio2.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }
  disconnectedCallback() {
    var _a;
    this.audioAnimatedAttributeHelper.reset();
    (_a = this.audioGraphics) == null ? void 0 : _a.dispose();
    this.audioGraphics = null;
    this.documentTimeListener.remove();
    super.disconnectedCallback();
  }
};
_Audio.tagName = "m-audio";
_Audio.attributeHandler = new AttributeHandler({
  enabled: (instance, newValue) => {
    var _a;
    instance.props.enabled = parseBoolAttribute(newValue, defaultAudioEnabled);
    (_a = instance.audioGraphics) == null ? void 0 : _a.setEnabled(instance.props.enabled, instance.props);
  },
  loop: (instance, newValue) => {
    var _a;
    instance.props.loop = parseBoolAttribute(newValue, defaultAudioLoop);
    (_a = instance.audioGraphics) == null ? void 0 : _a.setLoop(instance.props.loop, instance.props);
  },
  "loop-duration": (instance, newValue) => {
    var _a;
    instance.props.loopDuration = parseFloatAttribute(newValue, null);
    (_a = instance.audioGraphics) == null ? void 0 : _a.setLoopDuration(instance.props.loopDuration, instance.props);
  },
  "start-time": (instance, newValue) => {
    var _a;
    instance.props.startTime = parseFloatAttribute(newValue, defaultAudioStartTime);
    (_a = instance.audioGraphics) == null ? void 0 : _a.setStartTime(instance.props.startTime, instance.props);
  },
  "pause-time": (instance, newValue) => {
    var _a;
    instance.props.pauseTime = parseFloatAttribute(newValue, defaultAudioPauseTime);
    (_a = instance.audioGraphics) == null ? void 0 : _a.setPauseTime(instance.props.pauseTime, instance.props);
  },
  src: (instance, newValue) => {
    var _a;
    instance.props.src = newValue;
    (_a = instance.audioGraphics) == null ? void 0 : _a.setSrc(newValue, instance.props);
  },
  volume: (instance, newValue) => {
    instance.audioAnimatedAttributeHelper.elementSetAttribute(
      "volume",
      parseFloatAttribute(newValue, defaultAudioVolume)
    );
  },
  "cone-angle": (instance, newValue) => {
    instance.audioAnimatedAttributeHelper.elementSetAttribute(
      "cone-angle",
      parseFloatAttribute(newValue, null)
    );
  },
  "cone-falloff-angle": (instance, newValue) => {
    instance.audioAnimatedAttributeHelper.elementSetAttribute(
      "cone-falloff-angle",
      parseFloatAttribute(newValue, defaultAudioOuterConeAngle)
    );
  },
  debug: (instance, newValue) => {
    var _a;
    instance.props.debug = parseBoolAttribute(newValue, defaultAudioDebug);
    (_a = instance.audioGraphics) == null ? void 0 : _a.setDebug(instance.props.debug, instance.props);
  }
});
var Audio = _Audio;
var defaultModelSrc = null;
var defaultModelAnim = null;
var defaultModelAnimLoop = true;
var defaultModelAnimEnabled = true;
var defaultModelAnimStartTime = 0;
var defaultModelAnimPauseTime = null;
var defaultModelCastShadows = true;
var defaultModelDebug = false;
var _Model = class _Model2 extends TransformableElement {
  constructor() {
    super();
    this.props = {
      src: defaultModelSrc,
      anim: defaultModelAnim,
      animStartTime: defaultModelAnimStartTime,
      animPauseTime: defaultModelAnimPauseTime,
      animLoop: defaultModelAnimLoop,
      animEnabled: defaultModelAnimEnabled,
      castShadows: defaultModelCastShadows,
      debug: defaultModelDebug
    };
    this.collideableHelper = new CollideableHelper(this);
    this.modelGraphics = null;
    this.isModel = true;
  }
  static isModel(element) {
    return element.isModel;
  }
  enable() {
    this.collideableHelper.enable();
  }
  disable() {
    this.collideableHelper.disable();
  }
  static get observedAttributes() {
    return [
      ...TransformableElement.observedAttributes,
      ..._Model2.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes
    ];
  }
  getContentBounds() {
    var _a;
    if (!this.transformableElementGraphics) {
      return null;
    }
    const boundingBox = (_a = this.modelGraphics) == null ? void 0 : _a.getBoundingBox();
    if (boundingBox) {
      return OrientedBoundingBox.fromSizeMatrixWorldAndCenter(
        boundingBox.size,
        this.transformableElementGraphics.getWorldMatrix(),
        boundingBox.centerOffset
      );
    }
    return null;
  }
  parentTransformed() {
    var _a;
    this.collideableHelper.parentTransformed();
    (_a = this.modelGraphics) == null ? void 0 : _a.transformed();
  }
  isClickable() {
    return true;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.modelGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    _Model2.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
    if (TransformableElement.observedAttributes.includes(name)) {
      this.modelGraphics.transformed();
    }
  }
  connectedCallback() {
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter() || this.modelGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.modelGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLModelGraphicsInterface(this, () => {
      var _a;
      this.applyBounds();
      this.collideableHelper.updateCollider((_a = this.modelGraphics) == null ? void 0 : _a.getCollisionElement());
    });
    for (const name of _Model2.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }
  disconnectedCallback() {
    var _a;
    this.collideableHelper.removeColliders();
    (_a = this.modelGraphics) == null ? void 0 : _a.dispose();
    this.modelGraphics = null;
    super.disconnectedCallback();
  }
};
_Model.tagName = "m-model";
_Model.attributeHandler = new AttributeHandler({
  src: (instance, newValue) => {
    var _a;
    instance.props.src = newValue;
    (_a = instance.modelGraphics) == null ? void 0 : _a.setSrc(newValue, instance.props);
  },
  anim: (instance, newValue) => {
    var _a;
    instance.props.anim = newValue;
    (_a = instance.modelGraphics) == null ? void 0 : _a.setAnim(newValue, instance.props);
  },
  debug: (instance, newValue) => {
    var _a;
    instance.props.debug = parseBoolAttribute(newValue, defaultModelDebug);
    (_a = instance.modelGraphics) == null ? void 0 : _a.setDebug(instance.props.debug, instance.props);
  },
  "cast-shadows": (instance, newValue) => {
    var _a;
    instance.props.castShadows = parseBoolAttribute(newValue, defaultModelCastShadows);
    (_a = instance.modelGraphics) == null ? void 0 : _a.setCastShadows(instance.props.castShadows, instance.props);
  },
  "anim-enabled": (instance, newValue) => {
    var _a;
    instance.props.animEnabled = parseBoolAttribute(newValue, defaultModelAnimEnabled);
    (_a = instance.modelGraphics) == null ? void 0 : _a.setAnimEnabled(instance.props.animEnabled, instance.props);
  },
  "anim-loop": (instance, newValue) => {
    var _a;
    instance.props.animLoop = parseBoolAttribute(newValue, defaultModelAnimLoop);
    (_a = instance.modelGraphics) == null ? void 0 : _a.setAnimLoop(instance.props.animLoop, instance.props);
  },
  "anim-start-time": (instance, newValue) => {
    var _a;
    instance.props.animStartTime = parseFloatAttribute(newValue, defaultModelAnimStartTime);
    (_a = instance.modelGraphics) == null ? void 0 : _a.setAnimStartTime(instance.props.animStartTime, instance.props);
  },
  "anim-pause-time": (instance, newValue) => {
    var _a;
    instance.props.animPauseTime = parseFloatAttribute(newValue, defaultModelAnimPauseTime);
    (_a = instance.modelGraphics) == null ? void 0 : _a.setAnimPauseTime(instance.props.animPauseTime, instance.props);
  }
});
var Model = _Model;
var Character = class extends Model {
  static get observedAttributes() {
    return [...Model.observedAttributes];
  }
  constructor() {
    super();
  }
  parentTransformed() {
  }
  isClickable() {
    return true;
  }
  connectedCallback() {
    super.connectedCallback();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
  }
};
Character.tagName = "m-character";
var tempContainerMatrix = new Matr4();
var tempTargetMatrix = new Matr4();
var tempPositionVector = new Vect3();
var tempRotationEuler = new EulXYZ();
var tempRotationQuaternion = new Quat();
var tempScaleVector = new Vect3();
function getRelativePositionAndRotationRelativeToObject(positionAndRotation, container) {
  const { x, y, z } = positionAndRotation.position;
  const { x: rx, y: ry, z: rz } = positionAndRotation.rotation;
  tempContainerMatrix.identity();
  const tempMatr4 = new Matr4();
  for (let obj = container; obj; obj = obj.parentNode) {
    if (TransformableElement.isTransformableElement(obj)) {
      obj.calculateLocalMatrix(tempMatr4);
      tempContainerMatrix.premultiply(tempMatr4);
    }
  }
  tempContainerMatrix.invert();
  tempPositionVector.set(x, y, z);
  tempRotationEuler.set(degToRad(rx), degToRad(ry), degToRad(rz));
  tempRotationQuaternion.setFromEulerXYZ(tempRotationEuler);
  tempScaleVector.set(1, 1, 1);
  tempTargetMatrix.compose(tempPositionVector, tempRotationQuaternion, tempScaleVector);
  tempTargetMatrix.premultiply(tempContainerMatrix);
  tempTargetMatrix.decompose(tempPositionVector, tempRotationQuaternion, tempScaleVector);
  tempRotationEuler.setFromQuaternion(tempRotationQuaternion);
  return {
    position: {
      x: tempPositionVector.x,
      y: tempPositionVector.y,
      z: tempPositionVector.z
    },
    rotation: {
      x: radToDeg(tempRotationEuler.x),
      y: radToDeg(tempRotationEuler.y),
      z: radToDeg(tempRotationEuler.z)
    }
  };
}
var defaultChatProbeRange = 10;
var defaultChatProbeDebug = false;
var chatProbeChatEventName = "chat";
var _ChatProbe = class _ChatProbe2 extends TransformableElement {
  constructor() {
    super();
    this.chatProbeGraphics = null;
    this.registeredScene = null;
    this.chatProbeAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
      range: [
        0,
        defaultChatProbeRange,
        (newValue) => {
          var _a;
          this.props.range = newValue;
          (_a = this.chatProbeGraphics) == null ? void 0 : _a.setRange(newValue, this.props);
          this.applyBounds();
        }
      ]
    });
    this.props = {
      debug: defaultChatProbeDebug,
      range: defaultChatProbeRange
    };
  }
  static get observedAttributes() {
    return [
      ...TransformableElement.observedAttributes,
      ..._ChatProbe2.attributeHandler.getAttributes()
    ];
  }
  enable() {
  }
  disable() {
  }
  getContentBounds() {
    if (!this.transformableElementGraphics) {
      return null;
    }
    return OrientedBoundingBox.fromSizeAndMatrixWorld(
      new Vect3(this.props.range * 2, this.props.range * 2, this.props.range * 2),
      this.transformableElementGraphics.getWorldMatrix()
    );
  }
  addSideEffectChild(child) {
    this.chatProbeAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }
  removeSideEffectChild(child) {
    this.chatProbeAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }
  parentTransformed() {
    var _a, _b;
    (_b = (_a = this.registeredScene) == null ? void 0 : _a.updateChatProbe) == null ? void 0 : _b.call(_a, this);
  }
  isClickable() {
    return false;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    _ChatProbe2.attributeHandler.handle(this, name, newValue);
  }
  trigger(message) {
    const userPositionAndRotation = this.getUserPositionAndRotation();
    const elementRelative = getRelativePositionAndRotationRelativeToObject(
      userPositionAndRotation,
      this
    );
    const distance = new Vect3().copy(elementRelative.position).length();
    let withinBounds = true;
    this.getAppliedBounds().forEach((bounds) => {
      if (!bounds.containsPoint(userPositionAndRotation.position)) {
        withinBounds = false;
      }
    });
    if (withinBounds && distance <= this.props.range) {
      this.dispatchEvent(
        new CustomEvent(chatProbeChatEventName, {
          detail: {
            message
          }
        })
      );
    }
  }
  connectedCallback() {
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter() || this.chatProbeGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.chatProbeGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLChatProbeGraphicsInterface(this);
    for (const name of _ChatProbe2.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
    this.applyBounds();
    this.registerChatProbe();
  }
  disconnectedCallback() {
    var _a;
    this.unregisterChatProbe();
    this.chatProbeAnimatedAttributeHelper.reset();
    (_a = this.chatProbeGraphics) == null ? void 0 : _a.dispose();
    this.chatProbeGraphics = null;
    super.disconnectedCallback();
  }
  registerChatProbe() {
    var _a;
    const scene2 = this.getScene();
    this.registeredScene = scene2;
    (_a = scene2.addChatProbe) == null ? void 0 : _a.call(scene2, this);
  }
  unregisterChatProbe() {
    var _a, _b;
    if (this.registeredScene !== null) {
      (_b = (_a = this.registeredScene).removeChatProbe) == null ? void 0 : _b.call(_a, this);
      this.registeredScene = null;
    }
  }
};
_ChatProbe.tagName = "m-chat-probe";
_ChatProbe.attributeHandler = new AttributeHandler({
  range: (instance, newValue) => {
    instance.chatProbeAnimatedAttributeHelper.elementSetAttribute(
      "range",
      parseFloatAttribute(newValue, defaultChatProbeRange)
    );
  },
  debug: (instance, newValue) => {
    var _a;
    instance.props.debug = parseBoolAttribute(newValue, defaultChatProbeDebug);
    (_a = instance.chatProbeGraphics) == null ? void 0 : _a.setDebug(instance.props.debug, instance.props);
  }
});
var ChatProbe = _ChatProbe;
var defaultCubeColor = { r: 1, g: 1, b: 1 };
var defaultCubeWidth = 1;
var defaultCubeHeight = 1;
var defaultCubeDepth = 1;
var defaultCubeOpacity = 1;
var defaultCubeCastShadows = true;
var _Cube = class _Cube2 extends TransformableElement {
  constructor() {
    super();
    this.cubeGraphics = null;
    this.props = {
      width: defaultCubeWidth,
      height: defaultCubeHeight,
      depth: defaultCubeDepth,
      color: defaultCubeColor,
      opacity: defaultCubeOpacity,
      castShadows: defaultCubeCastShadows
    };
    this.cubeAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
      color: [
        2,
        defaultCubeColor,
        (newValue) => {
          var _a;
          this.props.color = newValue;
          (_a = this.cubeGraphics) == null ? void 0 : _a.setColor(newValue, this.props);
        }
      ],
      width: [
        0,
        defaultCubeWidth,
        (newValue) => {
          var _a, _b;
          this.props.width = newValue;
          (_a = this.cubeGraphics) == null ? void 0 : _a.setWidth(newValue, this.props);
          this.applyBounds();
          this.collideableHelper.updateCollider((_b = this.cubeGraphics) == null ? void 0 : _b.getCollisionElement());
        }
      ],
      height: [
        0,
        defaultCubeHeight,
        (newValue) => {
          var _a, _b;
          this.props.height = newValue;
          (_a = this.cubeGraphics) == null ? void 0 : _a.setHeight(newValue, this.props);
          this.applyBounds();
          this.collideableHelper.updateCollider((_b = this.cubeGraphics) == null ? void 0 : _b.getCollisionElement());
        }
      ],
      depth: [
        0,
        defaultCubeDepth,
        (newValue) => {
          var _a, _b;
          this.props.depth = newValue;
          (_a = this.cubeGraphics) == null ? void 0 : _a.setDepth(newValue, this.props);
          this.applyBounds();
          this.collideableHelper.updateCollider((_b = this.cubeGraphics) == null ? void 0 : _b.getCollisionElement());
        }
      ],
      opacity: [
        0,
        defaultCubeOpacity,
        (newValue) => {
          var _a;
          this.props.opacity = newValue;
          (_a = this.cubeGraphics) == null ? void 0 : _a.setOpacity(newValue, this.props);
        }
      ]
    });
    this.collideableHelper = new CollideableHelper(this);
  }
  enable() {
    this.collideableHelper.enable();
  }
  disable() {
    this.collideableHelper.disable();
  }
  getContentBounds() {
    if (!this.transformableElementGraphics) {
      return null;
    }
    return OrientedBoundingBox.fromSizeAndMatrixWorld(
      new Vect3(this.props.width, this.props.height, this.props.depth),
      this.transformableElementGraphics.getWorldMatrix()
    );
  }
  static get observedAttributes() {
    return [
      ...TransformableElement.observedAttributes,
      ..._Cube2.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes
    ];
  }
  addSideEffectChild(child) {
    this.cubeAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }
  removeSideEffectChild(child) {
    this.cubeAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }
  parentTransformed() {
    this.collideableHelper.parentTransformed();
  }
  isClickable() {
    return true;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.cubeGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    _Cube2.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }
  connectedCallback() {
    var _a;
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter() || this.cubeGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.cubeGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLCubeGraphicsInterface(this);
    for (const name of _Cube2.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
    this.applyBounds();
    this.collideableHelper.updateCollider((_a = this.cubeGraphics) == null ? void 0 : _a.getCollisionElement());
  }
  disconnectedCallback() {
    var _a;
    this.collideableHelper.removeColliders();
    this.cubeAnimatedAttributeHelper.reset();
    (_a = this.cubeGraphics) == null ? void 0 : _a.dispose();
    this.cubeGraphics = null;
    super.disconnectedCallback();
  }
};
_Cube.tagName = "m-cube";
_Cube.attributeHandler = new AttributeHandler({
  width: (instance, newValue) => {
    instance.cubeAnimatedAttributeHelper.elementSetAttribute(
      "width",
      parseFloatAttribute(newValue, defaultCubeWidth)
    );
  },
  height: (instance, newValue) => {
    instance.cubeAnimatedAttributeHelper.elementSetAttribute(
      "height",
      parseFloatAttribute(newValue, defaultCubeHeight)
    );
  },
  depth: (instance, newValue) => {
    instance.cubeAnimatedAttributeHelper.elementSetAttribute(
      "depth",
      parseFloatAttribute(newValue, defaultCubeDepth)
    );
  },
  color: (instance, newValue) => {
    instance.cubeAnimatedAttributeHelper.elementSetAttribute(
      "color",
      parseColorAttribute(newValue, defaultCubeColor)
    );
  },
  opacity: (instance, newValue) => {
    instance.cubeAnimatedAttributeHelper.elementSetAttribute(
      "opacity",
      parseFloatAttribute(newValue, defaultCubeOpacity)
    );
  },
  "cast-shadows": (instance, newValue) => {
    var _a;
    instance.props.castShadows = parseBoolAttribute(newValue, defaultCubeCastShadows);
    (_a = instance.cubeGraphics) == null ? void 0 : _a.setCastShadows(instance.props.castShadows, instance.props);
  }
});
var Cube = _Cube;
var defaultCylinderColor = { r: 1, g: 1, b: 1 };
var defaultCylinderRadius = 0.5;
var defaultCylinderHeight = 1;
var defaultCylinderOpacity = 1;
var defaultCylinderCastShadows = true;
var _Cylinder = class _Cylinder2 extends TransformableElement {
  constructor() {
    super();
    this.props = {
      radius: defaultCylinderRadius,
      height: defaultCylinderHeight,
      color: defaultCylinderColor,
      opacity: defaultCylinderOpacity,
      castShadows: defaultCylinderCastShadows
    };
    this.cylinderAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
      color: [
        2,
        defaultCylinderColor,
        (newValue) => {
          var _a;
          this.props.color = newValue;
          (_a = this.cylinderGraphics) == null ? void 0 : _a.setColor(newValue, this.props);
        }
      ],
      radius: [
        0,
        defaultCylinderRadius,
        (newValue) => {
          var _a, _b;
          this.props.radius = newValue;
          (_a = this.cylinderGraphics) == null ? void 0 : _a.setRadius(newValue, this.props);
          this.applyBounds();
          this.collideableHelper.updateCollider((_b = this.cylinderGraphics) == null ? void 0 : _b.getCollisionElement());
        }
      ],
      height: [
        0,
        defaultCylinderHeight,
        (newValue) => {
          var _a, _b;
          this.props.height = newValue;
          (_a = this.cylinderGraphics) == null ? void 0 : _a.setHeight(newValue, this.props);
          this.applyBounds();
          this.collideableHelper.updateCollider((_b = this.cylinderGraphics) == null ? void 0 : _b.getCollisionElement());
        }
      ],
      opacity: [
        0,
        defaultCylinderOpacity,
        (newValue) => {
          var _a;
          this.props.opacity = newValue;
          (_a = this.cylinderGraphics) == null ? void 0 : _a.setOpacity(newValue, this.props);
        }
      ]
    });
    this.collideableHelper = new CollideableHelper(this);
  }
  enable() {
    this.collideableHelper.enable();
  }
  disable() {
    this.collideableHelper.disable();
  }
  getContentBounds() {
    if (!this.transformableElementGraphics) {
      return null;
    }
    return OrientedBoundingBox.fromSizeAndMatrixWorld(
      new Vect3(this.props.radius * 2, this.props.height, this.props.radius * 2),
      this.transformableElementGraphics.getWorldMatrix()
    );
  }
  static get observedAttributes() {
    return [
      ...TransformableElement.observedAttributes,
      ..._Cylinder2.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes
    ];
  }
  addSideEffectChild(child) {
    this.cylinderAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }
  removeSideEffectChild(child) {
    this.cylinderAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }
  parentTransformed() {
    this.collideableHelper.parentTransformed();
  }
  isClickable() {
    return true;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.cylinderGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    _Cylinder2.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }
  connectedCallback() {
    var _a;
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter() || this.cylinderGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.cylinderGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLCylinderGraphicsInterface(this);
    for (const name of _Cylinder2.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
    this.applyBounds();
    this.collideableHelper.updateCollider((_a = this.cylinderGraphics) == null ? void 0 : _a.getCollisionElement());
  }
  disconnectedCallback() {
    var _a;
    this.collideableHelper.removeColliders();
    this.cylinderAnimatedAttributeHelper.reset();
    (_a = this.cylinderGraphics) == null ? void 0 : _a.dispose();
    this.cylinderGraphics = null;
    super.disconnectedCallback();
  }
};
_Cylinder.tagName = "m-cylinder";
_Cylinder.attributeHandler = new AttributeHandler({
  radius: (instance, newValue) => {
    instance.cylinderAnimatedAttributeHelper.elementSetAttribute(
      "radius",
      parseFloatAttribute(newValue, defaultCylinderRadius)
    );
  },
  height: (instance, newValue) => {
    instance.cylinderAnimatedAttributeHelper.elementSetAttribute(
      "height",
      parseFloatAttribute(newValue, defaultCylinderHeight)
    );
  },
  color: (instance, newValue) => {
    instance.cylinderAnimatedAttributeHelper.elementSetAttribute(
      "color",
      parseColorAttribute(newValue, defaultCylinderColor)
    );
  },
  opacity: (instance, newValue) => {
    instance.cylinderAnimatedAttributeHelper.elementSetAttribute(
      "opacity",
      parseFloatAttribute(newValue, defaultCylinderOpacity)
    );
  },
  "cast-shadows": (instance, newValue) => {
    var _a;
    instance.props.castShadows = parseBoolAttribute(newValue, defaultCylinderCastShadows);
    (_a = instance.cylinderGraphics) == null ? void 0 : _a.setCastShadows(instance.props.castShadows, instance.props);
  }
});
var Cylinder = _Cylinder;
function createWrappedScene(scene2, loadingProgressManager) {
  return {
    addCollider(collider, element) {
      if (scene2.addCollider) {
        scene2.addCollider(collider, element);
      }
    },
    updateCollider(collider, element) {
      if (scene2.updateCollider) {
        scene2.updateCollider(collider, element);
      }
    },
    removeCollider(collider, element) {
      if (scene2.removeCollider) {
        scene2.removeCollider(collider, element);
      }
    },
    addInteraction(interaction) {
      if (scene2.addInteraction) {
        scene2.addInteraction(interaction);
      }
    },
    updateInteraction(interaction) {
      if (scene2.updateInteraction) {
        scene2.updateInteraction(interaction);
      }
    },
    removeInteraction(interaction) {
      if (scene2.removeInteraction) {
        scene2.removeInteraction(interaction);
      }
    },
    addChatProbe(chatProbe) {
      if (scene2.addChatProbe) {
        scene2.addChatProbe(chatProbe);
      }
    },
    updateChatProbe(chatProbe) {
      if (scene2.updateChatProbe) {
        scene2.updateChatProbe(chatProbe);
      }
    },
    removeChatProbe(chatProbe) {
      if (scene2.removeChatProbe) {
        scene2.removeChatProbe(chatProbe);
      }
    },
    hasGraphicsAdapter() {
      return scene2.hasGraphicsAdapter();
    },
    getGraphicsAdapter() {
      return scene2.getGraphicsAdapter();
    },
    prompt(promptProps, abortSignal, callback) {
      scene2.prompt(promptProps, abortSignal, callback);
    },
    link(linkProps, abortSignal, windowCallback) {
      scene2.link(linkProps, abortSignal, windowCallback);
    },
    getUserPositionAndRotation: () => {
      return scene2.getUserPositionAndRotation();
    },
    getLoadingProgressManager: () => {
      return loadingProgressManager;
    }
  };
}
var noManagerSymbol = Symbol("NoLoadingProgressManagerProvided");
var LoadingInstanceManager = class {
  constructor(type) {
    this.type = type;
    this.currentlyLoadingProgressManager = null;
  }
  start(loadingProgressManager, url) {
    if (this.currentlyLoadingProgressManager !== null) {
      if (this.currentlyLoadingProgressManager === noManagerSymbol && !loadingProgressManager) {
        return;
      }
      if (this.currentlyLoadingProgressManager !== loadingProgressManager) {
        throw new Error("Already loading with a different progress manager");
      }
    } else {
      if (!loadingProgressManager) {
        this.currentlyLoadingProgressManager = noManagerSymbol;
      } else {
        this.currentlyLoadingProgressManager = loadingProgressManager;
        this.currentlyLoadingProgressManager.addLoadingAsset(this, url, this.type);
      }
    }
  }
  setProgress(ratio) {
    if (!this.currentlyLoadingProgressManager) {
      throw new Error("Not currently loading - cannot finish");
    }
    if (this.currentlyLoadingProgressManager !== noManagerSymbol) {
      this.currentlyLoadingProgressManager.updateAssetProgress(this, ratio);
    }
  }
  // The content being loaded is no longer needed, but the instance may still request content load start again
  abortIfLoading() {
    if (this.currentlyLoadingProgressManager && this.currentlyLoadingProgressManager !== noManagerSymbol) {
      this.currentlyLoadingProgressManager.disposeOfLoadingAsset(this);
    }
    this.currentlyLoadingProgressManager = null;
  }
  // The instance is no longer needed, and will not request content load start again (content may not be loading)
  dispose() {
    this.abortIfLoading();
  }
  finish() {
    if (!this.currentlyLoadingProgressManager) {
      throw new Error("Not currently loading - cannot finish");
    }
    if (this.currentlyLoadingProgressManager !== noManagerSymbol) {
      this.currentlyLoadingProgressManager.completedLoadingAsset(this);
    }
  }
  error(err) {
    if (!this.currentlyLoadingProgressManager) {
      throw new Error("Not currently loading - cannot error");
    }
    if (this.currentlyLoadingProgressManager !== noManagerSymbol) {
      if (err) {
        this.currentlyLoadingProgressManager.errorLoadingAsset(this, err);
      } else {
        this.currentlyLoadingProgressManager.errorLoadingAsset(this, new Error("Unknown error"));
      }
    }
  }
};
var LoadingProgressManager = class {
  constructor() {
    this.summary = {
      totalLoaded: 0,
      totalErrored: 0,
      totalToLoad: 0
    };
    this.initialLoad = false;
    this.loadingAssets = /* @__PURE__ */ new Map();
    this.summaryByType = /* @__PURE__ */ new Map();
    this.loadingDocuments = /* @__PURE__ */ new Map();
    this.onProgressCallbacks = /* @__PURE__ */ new Set();
  }
  addProgressCallback(callback) {
    this.onProgressCallbacks.add(callback);
  }
  removeProgressCallback(callback) {
    this.onProgressCallbacks.delete(callback);
  }
  onProgress() {
    for (const callback of this.onProgressCallbacks) {
      callback();
    }
  }
  addLoadingAsset(ref, url, type) {
    if (this.loadingAssets.has(ref)) {
      throw new Error("Asset reference already exists");
    }
    const assetRecord = { type, assetUrl: url, progressRatio: 0, loadStatus: false };
    this.loadingAssets.set(ref, assetRecord);
    let typeSummary = this.summaryByType.get(type);
    if (!typeSummary) {
      typeSummary = { totalLoaded: 0, totalToLoad: 0, totalErrored: 0, assets: /* @__PURE__ */ new Map() };
      this.summaryByType.set(type, typeSummary);
    }
    typeSummary.assets.set(ref, assetRecord);
    typeSummary.totalToLoad++;
    this.summary.totalToLoad++;
    this.onProgress();
  }
  setInitialLoad(result) {
    if (result instanceof Error) {
      this.initialLoad = result;
    } else {
      this.initialLoad = true;
    }
    this.onProgress();
  }
  disposeOfLoadingAsset(ref) {
    const asset = this.loadingAssets.get(ref);
    if (asset) {
      this.loadingAssets.delete(ref);
      const { type, loadStatus } = asset;
      const typeSummary = this.summaryByType.get(type);
      if (typeSummary) {
        typeSummary.assets.delete(ref);
        typeSummary.totalToLoad--;
        this.summary.totalToLoad--;
        if (loadStatus === true) {
          typeSummary.totalLoaded--;
          this.summary.totalLoaded--;
        } else if (loadStatus instanceof Error) {
          typeSummary.totalErrored--;
          this.summary.totalErrored--;
        }
        this.onProgress();
      }
    }
  }
  errorLoadingAsset(ref, err) {
    const asset = this.loadingAssets.get(ref);
    if (asset) {
      const { type } = asset;
      asset.loadStatus = err;
      const typeSummary = this.summaryByType.get(type);
      if (typeSummary) {
        typeSummary.totalErrored++;
        this.summary.totalErrored++;
        this.onProgress();
      }
    }
  }
  updateAssetProgress(ref, progressRatio) {
    const asset = this.loadingAssets.get(ref);
    if (asset) {
      asset.progressRatio = progressRatio;
      this.onProgress();
    }
  }
  completedLoadingAsset(ref) {
    const asset = this.loadingAssets.get(ref);
    if (asset) {
      const { type } = asset;
      asset.loadStatus = true;
      const typeSummary = this.summaryByType.get(type);
      if (typeSummary) {
        typeSummary.totalLoaded++;
        this.summary.totalLoaded++;
        this.onProgress();
      }
    }
  }
  addLoadingDocument(ref, documentUrl, progressManager) {
    this.loadingDocuments.set(ref, { documentUrl, progressManager });
    this.onProgress();
  }
  removeLoadingDocument(ref) {
    this.loadingDocuments.delete(ref);
    this.onProgress();
  }
  updateDocumentProgress(ref) {
    const loadingDocument = this.loadingDocuments.get(ref);
    if (loadingDocument) {
      this.onProgress();
    }
  }
  toSummary() {
    const loadingProgressSummary = {
      initialLoad: this.initialLoad,
      summary: { ...this.summary },
      summaryByType: {},
      innerDocuments: []
    };
    for (const [key, ofType] of this.summaryByType) {
      const ofTypeSummary = {
        totalToLoad: ofType.totalToLoad,
        totalLoaded: ofType.totalLoaded,
        totalErrored: ofType.totalErrored,
        assetErrors: []
      };
      if (ofType.totalErrored > 0) {
        for (const [, asset] of ofType.assets) {
          if (asset.loadStatus instanceof Error) {
            ofTypeSummary.assetErrors.push([asset.assetUrl, asset.loadStatus]);
          }
        }
      }
      loadingProgressSummary.summaryByType[key] = ofTypeSummary;
    }
    for (const [, innerDocProgress] of this.loadingDocuments) {
      loadingProgressSummary.innerDocuments.push([
        innerDocProgress.documentUrl,
        innerDocProgress.progressManager.toSummary()
      ]);
    }
    return loadingProgressSummary;
  }
  static LoadingProgressSummaryToString(loadingProgressSummary) {
    const text = [];
    const showDocProgress = (docUrl, docProgress) => {
      if (docProgress.initialLoad instanceof Error) {
        text.push(`${docUrl}: Error: ${docProgress.initialLoad.message}`);
        return;
      } else if (!docProgress.initialLoad) {
        text.push(`${docUrl}: Loading...`);
        return;
      }
      text.push(
        `${docUrl}: (${docProgress.summary.totalLoaded} loaded, ${docProgress.summary.totalErrored} errors) / (${docProgress.summary.totalToLoad} to load) = ${docProgress.summary.totalLoaded + docProgress.summary.totalErrored}/${docProgress.summary.totalToLoad}`
      );
      for (const key in docProgress.summaryByType) {
        const ofType = docProgress.summaryByType[key];
        text.push(
          ` - ${key}: (${ofType.totalLoaded} loaded, ${ofType.totalErrored} errors) / (${ofType.totalToLoad} to load) = ${ofType.totalLoaded + ofType.totalErrored}/${ofType.totalToLoad}`
        );
        if (ofType.totalErrored > 0) {
          text.push(`   - Errors:`);
          for (const [assetUrl, error] of ofType.assetErrors) {
            text.push(`     - ${assetUrl}: ${error.message}`);
          }
        }
      }
      for (const [innerDocumentUrl, innerDocProgress] of docProgress.innerDocuments) {
        showDocProgress(innerDocumentUrl, innerDocProgress);
      }
    };
    showDocProgress("root", loadingProgressSummary);
    return text.join("\n");
  }
  toRatio() {
    if (!this.initialLoad) {
      return [0, false];
    }
    if (this.initialLoad instanceof Error) {
      return [1, true];
    }
    let totalRatio = 0;
    let complete = true;
    let numberOfDocuments = this.loadingDocuments.size;
    if (this.summary.totalToLoad > 0) {
      numberOfDocuments += 1;
      const loadedAndErrored = this.summary.totalLoaded + this.summary.totalErrored;
      complete = complete && loadedAndErrored === this.summary.totalToLoad;
      let directAssetsLoadedRatio = 0;
      for (const [, asset] of this.loadingAssets) {
        if (asset.loadStatus instanceof Error || asset.loadStatus) {
          directAssetsLoadedRatio += 1;
        } else {
          directAssetsLoadedRatio += asset.progressRatio;
        }
      }
      directAssetsLoadedRatio /= this.summary.totalToLoad;
      totalRatio += directAssetsLoadedRatio / numberOfDocuments;
    } else if (this.loadingDocuments.size === 0) {
      return [1, true];
    }
    for (const [, innerDocument] of this.loadingDocuments) {
      const [innerDocumentRatio, innerDocumentComplete] = innerDocument.progressManager.toRatio();
      totalRatio += innerDocumentRatio / numberOfDocuments;
      complete = complete && innerDocumentComplete;
    }
    return [totalRatio, complete];
  }
};
var LoadingProgressBar = class {
  constructor(loadingProgressManager) {
    this.loadingProgressManager = loadingProgressManager;
    this.hasCompleted = false;
    this.element = document.createElement("div");
    this.element.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    this.element.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });
    this.element.addEventListener("mousemove", (event) => {
      event.stopPropagation();
    });
    this.element.addEventListener("mouseup", (event) => {
      event.stopPropagation();
    });
    this.progressDebugView = document.createElement("div");
    this.progressDebugView.style.position = "absolute";
    this.progressDebugView.style.backgroundColor = "rgba(128, 128, 128, 0.25)";
    this.progressDebugView.style.top = "20px";
    this.progressDebugView.style.left = "0";
    this.progressDebugView.style.border = "1px solid black";
    this.progressDebugView.style.maxHeight = "calc(100% - 20px)";
    this.progressDebugView.style.maxWidth = "100%";
    this.progressDebugView.style.overflow = "auto";
    this.element.append(this.progressDebugView);
    this.debugCheckbox = document.createElement("input");
    this.debugCheckbox.type = "checkbox";
    this.debugCheckbox.addEventListener("change", () => {
      this.progressDebugElement.style.display = this.debugCheckbox.checked ? "block" : "none";
      if (this.hasCompleted) {
        this.dispose();
      }
    });
    this.debugLabel = document.createElement("label");
    this.debugLabel.textContent = "Debug loading";
    this.debugLabel.style.fontFamily = "sans-serif";
    this.debugLabel.style.padding = "5px";
    this.debugLabel.style.display = "inline-block";
    this.debugLabel.style.userSelect = "none";
    this.debugLabel.append(this.debugCheckbox);
    this.progressDebugView.append(this.debugLabel);
    this.progressDebugElement = document.createElement("pre");
    this.progressDebugElement.style.margin = "0";
    this.progressDebugElement.style.display = this.debugCheckbox.checked ? "block" : "none";
    this.progressDebugView.append(this.progressDebugElement);
    this.progressBarHolder = document.createElement("div");
    this.progressBarHolder.style.position = "absolute";
    this.progressBarHolder.style.top = "0";
    this.progressBarHolder.style.left = "0";
    this.progressBarHolder.style.width = "100%";
    this.progressBarHolder.style.backgroundColor = "gray";
    this.progressBarHolder.style.height = "20px";
    this.element.append(this.progressBarHolder);
    this.progressBar = document.createElement("div");
    this.progressBar.style.position = "absolute";
    this.progressBar.style.top = "0";
    this.progressBar.style.left = "0";
    this.progressBar.style.width = "0";
    this.progressBar.style.height = "100%";
    this.progressBar.style.backgroundColor = "#0050a4";
    this.progressBarHolder.append(this.progressBar);
    this.loadingStatusText = document.createElement("div");
    this.loadingStatusText.style.position = "absolute";
    this.loadingStatusText.style.top = "0";
    this.loadingStatusText.style.left = "0";
    this.loadingStatusText.style.width = "100%";
    this.loadingStatusText.style.height = "100%";
    this.loadingStatusText.style.color = "white";
    this.loadingStatusText.style.textAlign = "center";
    this.loadingStatusText.style.verticalAlign = "middle";
    this.loadingStatusText.style.lineHeight = "20px";
    this.loadingStatusText.style.fontFamily = "sans-serif";
    this.loadingStatusText.textContent = "Loading...";
    this.progressBarHolder.append(this.loadingStatusText);
    this.loadingCallback = () => {
      const [loadingRatio, completedLoading] = this.loadingProgressManager.toRatio();
      if (completedLoading) {
        if (!this.hasCompleted) {
          this.hasCompleted = true;
          if (!this.debugCheckbox.checked) {
            this.dispose();
          }
        }
        this.loadingStatusText.textContent = "Completed";
        this.progressBar.style.width = "100%";
      } else {
        this.loadingStatusText.textContent = `Loading... ${(loadingRatio * 100).toFixed(2)}%`;
        this.progressBar.style.width = `${loadingRatio * 100}%`;
      }
      this.progressDebugElement.textContent = LoadingProgressManager.LoadingProgressSummaryToString(
        this.loadingProgressManager.toSummary()
      );
    };
    this.loadingProgressManager.addProgressCallback(this.loadingCallback);
  }
  dispose() {
    this.loadingProgressManager.removeProgressCallback(this.loadingCallback);
    this.element.remove();
  }
};
var domParser;
async function fetchRemoteStaticMML(address) {
  const response = await fetch(address);
  const text = await response.text();
  if (!domParser) {
    domParser = new DOMParser();
  }
  const remoteDocumentAsHTMLNode = domParser.parseFromString(text, "text/html");
  return DOMSanitizer.sanitise(remoteDocumentAsHTMLNode.body, {
    tagPrefix: "m-",
    replacementTagPrefix: "x-"
  });
}
var RemoteDocumentWrapper = class {
  constructor(address, targetWindow, mmlScene, handleEvent) {
    this.remoteDocument = targetWindow.document.createElement(
      RemoteDocument.tagName
    );
    this.remoteDocument.addEventListener(consumeEventEventName, (wrappedEvent) => {
      const { originalEvent, element } = wrappedEvent.detail;
      handleEvent(element, originalEvent);
    });
    this.remoteDocument.init(mmlScene, address);
  }
  setDocumentTime(documentTime) {
    this.remoteDocument.getDocumentTimeManager().setDocumentTime(documentTime);
  }
  overrideDocumentTime(documentTime) {
    this.remoteDocument.getDocumentTimeManager().overrideDocumentTime(documentTime);
  }
};
var StaticHTMLFrameInstance = class {
  constructor(targetElement, src, scene2) {
    var _a, _b;
    this.targetForWrapper = targetElement;
    this.src = src;
    this.scene = scene2;
    const windowTarget = targetElement.ownerDocument.defaultView;
    this.loadingProgressManager = new LoadingProgressManager();
    this.loadingProgressManager.addProgressCallback(() => {
      var _a2, _b2;
      (_b2 = (_a2 = scene2.getLoadingProgressManager) == null ? void 0 : _a2.call(scene2)) == null ? void 0 : _b2.updateDocumentProgress(this);
    });
    const address = this.targetForWrapper.contentSrcToContentAddress(this.src);
    (_b = (_a = scene2.getLoadingProgressManager) == null ? void 0 : _a.call(scene2)) == null ? void 0 : _b.addLoadingDocument(this, address, this.loadingProgressManager);
    const wrappedScene = createWrappedScene(this.scene, this.loadingProgressManager);
    this.remoteDocumentWrapper = new RemoteDocumentWrapper(
      address,
      windowTarget,
      wrappedScene,
      () => {
      }
    );
    this.targetForWrapper.append(this.remoteDocumentWrapper.remoteDocument);
    fetchRemoteStaticMML(address).then((remoteDocumentBody) => {
      this.remoteDocumentWrapper.remoteDocument.append(remoteDocumentBody);
      this.loadingProgressManager.setInitialLoad(true);
    }).catch((err) => {
      this.loadingProgressManager.setInitialLoad(err);
    });
  }
  dispose() {
    this.targetForWrapper.removeChild(this.remoteDocumentWrapper.remoteDocument);
    this.loadingProgressManager.removeLoadingDocument(this);
  }
};
var WebSocketFrameInstance = class {
  constructor(targetElement, src, scene2) {
    var _a, _b;
    this.targetForWrapper = targetElement;
    this.src = src;
    this.scene = scene2;
    const windowTarget = targetElement.ownerDocument.defaultView;
    let overriddenHandler = null;
    const eventHandler = (element, event) => {
      if (!overriddenHandler) {
        throw new Error("overriddenHandler not set");
      }
      overriddenHandler(element, event);
    };
    this.loadingProgressManager = new LoadingProgressManager();
    this.loadingProgressManager.addProgressCallback(() => {
      var _a2, _b2;
      (_b2 = (_a2 = scene2.getLoadingProgressManager) == null ? void 0 : _a2.call(scene2)) == null ? void 0 : _b2.updateDocumentProgress(this);
    });
    const websocketAddress = this.srcToAddress(this.src);
    (_b = (_a = scene2.getLoadingProgressManager) == null ? void 0 : _a.call(scene2)) == null ? void 0 : _b.addLoadingDocument(this, websocketAddress, this.loadingProgressManager);
    const wrappedScene = createWrappedScene(this.scene, this.loadingProgressManager);
    this.remoteDocumentWrapper = new RemoteDocumentWrapper(
      websocketAddress,
      windowTarget,
      wrappedScene,
      () => {
      }
    );
    this.targetForWrapper.append(this.remoteDocumentWrapper.remoteDocument);
    this.remoteDocumentWrapper.remoteDocument.addEventListener(
      consumeEventEventName,
      (wrappedEvent) => {
        const { originalEvent, element } = wrappedEvent.detail;
        eventHandler(element, originalEvent);
      }
    );
    this.domWebsocket = new NetworkedDOMWebsocket(
      websocketAddress,
      NetworkedDOMWebsocket.createWebSocket,
      this.remoteDocumentWrapper.remoteDocument,
      (time) => {
        this.remoteDocumentWrapper.remoteDocument.getDocumentTimeManager().setDocumentTime(time);
      },
      (status) => {
        if (status === NetworkedDOMWebsocketStatus.Reconnecting) {
          this.remoteDocumentWrapper.remoteDocument.showError(true);
          this.loadingProgressManager.setInitialLoad(new Error("Failed to connect"));
        } else if (status === NetworkedDOMWebsocketStatus.Connected) {
          this.remoteDocumentWrapper.remoteDocument.showError(false);
          this.loadingProgressManager.setInitialLoad(true);
        } else {
          this.remoteDocumentWrapper.remoteDocument.showError(false);
        }
      },
      {
        tagPrefix: "m-"
      }
    );
    overriddenHandler = (element, event) => {
      this.domWebsocket.handleEvent(element, event);
    };
  }
  srcToAddress(src) {
    const insecurePrefix = "ws:///";
    const securePrefix = "wss:///";
    if (src.startsWith(insecurePrefix)) {
      return `ws://${this.getDocumentHost()}/${src.substring(insecurePrefix.length)}`;
    } else if (src.startsWith(securePrefix)) {
      return `wss://${this.getDocumentHost()}/${src.substring(securePrefix.length)}`;
    } else {
      return src;
    }
  }
  getDocumentHost() {
    const remoteDocument = this.targetForWrapper.getInitiatedRemoteDocument();
    if (remoteDocument) {
      const remoteDocumentAddress = remoteDocument.getDocumentAddress();
      if (remoteDocumentAddress) {
        const url = new URL(remoteDocumentAddress);
        return url.host;
      }
    }
    return window.location.host;
  }
  dispose() {
    var _a, _b, _c;
    this.domWebsocket.stop();
    this.targetForWrapper.removeChild(this.remoteDocumentWrapper.remoteDocument);
    (_c = (_b = (_a = this.scene).getLoadingProgressManager) == null ? void 0 : _b.call(_a)) == null ? void 0 : _c.removeLoadingDocument(this);
  }
};
var defaultUnloadRange = 1;
var defaultFrameDebug = false;
var _Frame = class _Frame2 extends TransformableElement {
  constructor() {
    super();
    this.hasInitialized = false;
    this.frameContentsInstance = null;
    this.isActivelyLoaded = false;
    this.timer = null;
    this.props = {
      src: null,
      loadRange: null,
      unloadRange: defaultUnloadRange,
      debug: defaultFrameDebug,
      minX: null,
      maxX: null,
      minY: null,
      maxY: null,
      minZ: null,
      maxZ: null
    };
  }
  enable() {
  }
  disable() {
  }
  boundsUpdated() {
    if (!this.transformableElementGraphics) {
      return;
    }
    const boxBounds = this.getDefinedBoxBounds();
    if (boxBounds) {
      const [minX, maxX, minY, maxY, minZ, maxZ] = boxBounds;
      const obb = OrientedBoundingBox.fromSizeMatrixWorldAndCenter(
        new Vect3(maxX - minX, maxY - minY, maxZ - minZ),
        this.transformableElementGraphics.getWorldMatrix(),
        new Vect3((maxX + minX) / 2, (maxY + minY) / 2, (maxZ + minZ) / 2)
      );
      this.addOrUpdateParentBound(this, obb);
    } else {
      this.removeParentBound(this);
    }
  }
  shouldBeLoaded() {
    if (!this.hasInitialized) {
      return false;
    }
    if (!this.isConnected) {
      return false;
    }
    if (this.props.loadRange === null) {
      return true;
    }
    const userPositionAndRotation = this.getUserPositionAndRotation();
    const elementRelative = getRelativePositionAndRotationRelativeToObject(
      userPositionAndRotation,
      this
    );
    let boxBounds = this.getDefinedBoxBounds();
    if (!boxBounds) {
      boxBounds = [0, 0, 0, 0, 0, 0];
    }
    const [minX, maxX, minY, maxY, minZ, maxZ] = boxBounds;
    if (elementRelative.position.x >= minX - this.props.loadRange && elementRelative.position.x <= maxX + this.props.loadRange && elementRelative.position.y >= minY - this.props.loadRange && elementRelative.position.y <= maxY + this.props.loadRange && elementRelative.position.z >= minZ - this.props.loadRange && elementRelative.position.z <= maxZ + this.props.loadRange) {
      return true;
    }
    if (elementRelative.position.x >= minX - this.props.loadRange - this.props.unloadRange && elementRelative.position.x <= maxX + this.props.loadRange + this.props.unloadRange && elementRelative.position.y >= minY - this.props.loadRange - this.props.unloadRange && elementRelative.position.y <= maxY + this.props.loadRange + this.props.unloadRange && elementRelative.position.z >= minZ - this.props.loadRange - this.props.unloadRange && elementRelative.position.z <= maxZ + this.props.loadRange + this.props.unloadRange) {
      return this.isActivelyLoaded;
    }
  }
  syncLoadState() {
    const shouldBeLoaded = this.shouldBeLoaded();
    if (shouldBeLoaded && !this.isActivelyLoaded) {
      if (this.props.src) {
        this.isActivelyLoaded = true;
        this.createFrameContentsInstance(this.props.src);
      }
    } else if (!shouldBeLoaded && this.isActivelyLoaded) {
      this.isActivelyLoaded = false;
      this.disposeInstance();
    }
  }
  static get observedAttributes() {
    return [...TransformableElement.observedAttributes, ..._Frame2.attributeHandler.getAttributes()];
  }
  getContentBounds() {
    return null;
  }
  parentTransformed() {
    this.boundsUpdated();
  }
  isClickable() {
    return true;
  }
  startEmitting() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(() => {
      this.syncLoadState();
    }, 100);
  }
  createFrameContentsInstance(src) {
    if (this.frameContentsInstance) {
      if (this.frameContentsInstance.src !== src) {
        console.error("Instance already existed with a different src");
        this.disposeInstance();
      } else {
        return;
      }
    }
    if (src.startsWith("ws://") || src.startsWith("wss://")) {
      this.frameContentsInstance = new WebSocketFrameInstance(this, src, this.getScene());
    } else {
      this.frameContentsInstance = new StaticHTMLFrameInstance(this, src, this.getScene());
    }
  }
  getDefinedBoxBounds() {
    if (this.props.minX !== null || this.props.maxX !== null || this.props.minY !== null || this.props.maxY !== null || this.props.minZ !== null || this.props.maxZ !== null) {
      const minX = this.props.minX ?? this.props.maxX ?? 0;
      let maxX = this.props.maxX ?? this.props.minX ?? 0;
      const minY = this.props.minY ?? this.props.maxY ?? 0;
      let maxY = this.props.maxY ?? this.props.minY ?? 0;
      const minZ = this.props.minZ ?? this.props.maxZ ?? 0;
      let maxZ = this.props.maxZ ?? this.props.minZ ?? 0;
      if (minX > maxX) {
        maxX = minX;
      }
      if (minY > maxY) {
        maxY = minY;
      }
      if (minZ > maxZ) {
        maxZ = minZ;
      }
      return [minX, maxX, minY, maxY, minZ, maxZ];
    }
    return null;
  }
  disposeInstance() {
    if (this.frameContentsInstance !== null) {
      this.frameContentsInstance.dispose();
      this.frameContentsInstance = null;
      this.isActivelyLoaded = false;
    }
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.frameGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    _Frame2.attributeHandler.handle(this, name, newValue);
  }
  connectedCallback() {
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter() || this.frameGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.frameGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLFrameGraphicsInterface(this);
    for (const name of _Frame2.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
    this.hasInitialized = true;
    this.startEmitting();
    this.syncLoadState();
    this.applyBounds();
  }
  disconnectedCallback() {
    var _a;
    (_a = this.frameGraphics) == null ? void 0 : _a.dispose();
    this.frameGraphics = null;
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.disposeInstance();
    super.disconnectedCallback();
  }
};
_Frame.tagName = "m-frame";
_Frame.attributeHandler = new AttributeHandler({
  src: (instance, newValue) => {
    var _a;
    instance.props.src = newValue;
    if (instance.frameContentsInstance) {
      instance.disposeInstance();
    }
    instance.syncLoadState();
    (_a = instance.frameGraphics) == null ? void 0 : _a.setSrc(instance.props.src, instance.props);
  },
  "load-range": (instance, newValue) => {
    var _a;
    instance.props.loadRange = parseFloatAttribute(newValue, null);
    instance.syncLoadState();
    (_a = instance.frameGraphics) == null ? void 0 : _a.setLoadRange(instance.props.loadRange, instance.props);
  },
  "unload-range": (instance, newValue) => {
    var _a;
    instance.props.unloadRange = parseFloatAttribute(newValue, defaultUnloadRange);
    instance.syncLoadState();
    (_a = instance.frameGraphics) == null ? void 0 : _a.setUnloadRange(instance.props.unloadRange, instance.props);
  },
  debug: (instance, newValue) => {
    var _a;
    instance.props.debug = parseBoolAttribute(newValue, defaultFrameDebug);
    (_a = instance.frameGraphics) == null ? void 0 : _a.setDebug(instance.props.debug, instance.props);
  },
  "min-x": (instance, newValue) => {
    var _a;
    instance.props.minX = parseFloatAttribute(newValue, null);
    instance.boundsUpdated();
    (_a = instance.frameGraphics) == null ? void 0 : _a.setMinX(instance.props.minX, instance.props);
  },
  "max-x": (instance, newValue) => {
    var _a;
    instance.props.maxX = parseFloatAttribute(newValue, null);
    instance.boundsUpdated();
    (_a = instance.frameGraphics) == null ? void 0 : _a.setMaxX(instance.props.maxX, instance.props);
  },
  "min-y": (instance, newValue) => {
    var _a;
    instance.props.minY = parseFloatAttribute(newValue, null);
    instance.boundsUpdated();
    (_a = instance.frameGraphics) == null ? void 0 : _a.setMinY(instance.props.minY, instance.props);
  },
  "max-y": (instance, newValue) => {
    var _a;
    instance.props.maxY = parseFloatAttribute(newValue, null);
    instance.boundsUpdated();
    (_a = instance.frameGraphics) == null ? void 0 : _a.setMaxY(instance.props.maxY, instance.props);
  },
  "min-z": (instance, newValue) => {
    var _a;
    instance.props.minZ = parseFloatAttribute(newValue, null);
    instance.boundsUpdated();
    (_a = instance.frameGraphics) == null ? void 0 : _a.setMinZ(instance.props.minZ, instance.props);
  },
  "max-z": (instance, newValue) => {
    var _a;
    instance.props.maxZ = parseFloatAttribute(newValue, null);
    instance.boundsUpdated();
    (_a = instance.frameGraphics) == null ? void 0 : _a.setMaxZ(instance.props.maxZ, instance.props);
  }
});
var Frame = _Frame;
var _Group = class _Group2 extends TransformableElement {
  static get observedAttributes() {
    return [...TransformableElement.observedAttributes];
  }
  enable() {
  }
  disable() {
  }
  constructor() {
    super();
  }
  getContentBounds() {
    return null;
  }
  parentTransformed() {
  }
  isClickable() {
    return true;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.transformableElementGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
  }
  connectedCallback() {
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter()) {
      return;
    }
    for (const name of _Group2.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }
};
_Group.tagName = "m-group";
var Group = _Group;
var defaultImageSrc = null;
var defaultImageWidth = null;
var defaultImageHeight = null;
var defaultImageOpacity = 1;
var defaultImageCastShadows = true;
var defaultImageEmissive = 0;
var _Image = class _Image2 extends TransformableElement {
  constructor() {
    super();
    this.props = {
      src: defaultImageSrc,
      width: defaultImageWidth,
      height: defaultImageHeight,
      opacity: defaultImageOpacity,
      castShadows: defaultImageCastShadows,
      emissive: defaultImageEmissive
    };
    this.imageAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
      width: [
        0,
        defaultImageWidth,
        (newValue) => {
          var _a;
          this.props.width = newValue;
          (_a = this.imageGraphics) == null ? void 0 : _a.setWidth(newValue, this.props);
        }
      ],
      height: [
        0,
        defaultImageHeight,
        (newValue) => {
          var _a;
          this.props.height = newValue;
          (_a = this.imageGraphics) == null ? void 0 : _a.setHeight(newValue, this.props);
        }
      ],
      opacity: [
        0,
        defaultImageOpacity,
        (newValue) => {
          var _a;
          this.props.opacity = newValue;
          (_a = this.imageGraphics) == null ? void 0 : _a.setOpacity(newValue, this.props);
        }
      ],
      emissive: [
        0,
        defaultImageEmissive,
        (newValue) => {
          var _a;
          this.props.emissive = newValue;
          (_a = this.imageGraphics) == null ? void 0 : _a.setEmissive(newValue, this.props);
        }
      ]
    });
    this.collideableHelper = new CollideableHelper(this);
  }
  enable() {
    this.collideableHelper.enable();
  }
  disable() {
    this.collideableHelper.disable();
  }
  static get observedAttributes() {
    return [
      ...TransformableElement.observedAttributes,
      ..._Image2.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes
    ];
  }
  getContentBounds() {
    var _a;
    if (!this.transformableElementGraphics) {
      return null;
    }
    const { width, height } = ((_a = this.imageGraphics) == null ? void 0 : _a.getWidthAndHeight()) || { width: 0, height: 0 };
    return OrientedBoundingBox.fromSizeAndMatrixWorld(
      new Vect3(width, height, 0),
      this.transformableElementGraphics.getWorldMatrix()
    );
  }
  addSideEffectChild(child) {
    this.imageAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }
  removeSideEffectChild(child) {
    this.imageAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }
  parentTransformed() {
    this.collideableHelper.parentTransformed();
  }
  isClickable() {
    return true;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.imageGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    _Image2.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }
  connectedCallback() {
    var _a;
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter() || this.imageGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.imageGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLImageGraphicsInterface(this, () => {
      var _a2;
      this.applyBounds();
      this.collideableHelper.updateCollider((_a2 = this.imageGraphics) == null ? void 0 : _a2.getCollisionElement());
    });
    for (const name of _Image2.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
    this.collideableHelper.updateCollider((_a = this.imageGraphics) == null ? void 0 : _a.getCollisionElement());
  }
  disconnectedCallback() {
    var _a;
    this.imageAnimatedAttributeHelper.reset();
    (_a = this.imageGraphics) == null ? void 0 : _a.dispose();
    this.imageGraphics = null;
    super.disconnectedCallback();
    this.collideableHelper.removeColliders();
  }
};
_Image.tagName = "m-image";
_Image.attributeHandler = new AttributeHandler({
  width: (instance, newValue) => {
    instance.imageAnimatedAttributeHelper.elementSetAttribute(
      "width",
      parseFloatAttribute(newValue, defaultImageWidth)
    );
  },
  height: (instance, newValue) => {
    instance.imageAnimatedAttributeHelper.elementSetAttribute(
      "height",
      parseFloatAttribute(newValue, defaultImageHeight)
    );
  },
  src: (instance, newValue) => {
    var _a;
    instance.props.src = newValue;
    (_a = instance.imageGraphics) == null ? void 0 : _a.setSrc(newValue, instance.props);
  },
  opacity: (instance, newValue) => {
    instance.imageAnimatedAttributeHelper.elementSetAttribute(
      "opacity",
      parseFloatAttribute(newValue, defaultImageOpacity)
    );
  },
  emissive: (instance, newValue) => {
    instance.imageAnimatedAttributeHelper.elementSetAttribute(
      "emissive",
      parseFloatAttribute(newValue, defaultImageEmissive)
    );
  },
  "cast-shadows": (instance, newValue) => {
    var _a;
    instance.props.castShadows = parseBoolAttribute(newValue, defaultImageCastShadows);
    (_a = instance.imageGraphics) == null ? void 0 : _a.setCastShadows(instance.props.castShadows, instance.props);
  }
});
var Image = _Image;
var defaultInteractionRange = 5;
var defaultInteractionInFocus = true;
var defaultInteractionLineOfSight = false;
var defaultInteractionPriority = 1;
var defaultInteractionPrompt = null;
var defaultInteractionDebug = false;
var _Interaction = class _Interaction2 extends TransformableElement {
  constructor() {
    super();
    this.interactionAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
      range: [
        0,
        defaultInteractionRange,
        (newValue) => {
          var _a;
          this.props.range = newValue;
          this.applyBounds();
          (_a = this.interactionGraphics) == null ? void 0 : _a.setRange(newValue, this.props);
        }
      ]
    });
    this.props = {
      range: defaultInteractionRange,
      inFocus: defaultInteractionInFocus,
      lineOfSight: defaultInteractionLineOfSight,
      priority: defaultInteractionPriority,
      prompt: defaultInteractionPrompt,
      debug: defaultInteractionDebug
    };
    this.registeredScene = null;
  }
  static get observedAttributes() {
    return [
      ...TransformableElement.observedAttributes,
      ..._Interaction2.attributeHandler.getAttributes()
    ];
  }
  enable() {
  }
  disable() {
  }
  getContentBounds() {
    if (!this.transformableElementGraphics) {
      return null;
    }
    return OrientedBoundingBox.fromSizeAndMatrixWorld(
      new Vect3(this.props.range * 2, this.props.range * 2, this.props.range * 2),
      this.transformableElementGraphics.getWorldMatrix()
    );
  }
  addSideEffectChild(child) {
    this.interactionAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }
  removeSideEffectChild(child) {
    this.interactionAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }
  parentTransformed() {
    var _a, _b;
    (_b = (_a = this.registeredScene) == null ? void 0 : _a.updateInteraction) == null ? void 0 : _b.call(_a, this);
  }
  isClickable() {
    return false;
  }
  connectedCallback() {
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter() || this.interactionGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.interactionGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLInteractionGraphicsInterface(this);
    for (const name of _Interaction2.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
    this.registerInteraction();
  }
  disconnectedCallback() {
    var _a;
    this.unregisterInteraction();
    this.interactionAnimatedAttributeHelper.reset();
    (_a = this.interactionGraphics) == null ? void 0 : _a.dispose();
    this.interactionGraphics = null;
    super.disconnectedCallback();
  }
  attributeChangedCallback(name, oldValue, newValue) {
    var _a, _b;
    super.attributeChangedCallback(name, oldValue, newValue);
    if (_Interaction2.attributeHandler.handle(this, name, newValue)) {
      if (this.registeredScene !== null) {
        (_b = (_a = this.registeredScene).updateInteraction) == null ? void 0 : _b.call(_a, this);
      }
    }
  }
  trigger() {
    this.dispatchEvent(new CustomEvent("interact", { detail: {} }));
  }
  registerInteraction() {
    var _a;
    const scene2 = this.getScene();
    this.registeredScene = scene2;
    (_a = scene2.addInteraction) == null ? void 0 : _a.call(scene2, this);
  }
  unregisterInteraction() {
    var _a, _b;
    if (this.registeredScene !== null) {
      (_b = (_a = this.registeredScene).removeInteraction) == null ? void 0 : _b.call(_a, this);
      this.registeredScene = null;
    }
  }
};
_Interaction.tagName = "m-interaction";
_Interaction.attributeHandler = new AttributeHandler({
  range: (instance, newValue) => {
    instance.interactionAnimatedAttributeHelper.elementSetAttribute(
      "range",
      parseFloatAttribute(newValue, defaultInteractionRange)
    );
  },
  "in-focus": (instance, newValue) => {
    var _a;
    instance.props.inFocus = parseBoolAttribute(newValue, defaultInteractionInFocus);
    (_a = instance.interactionGraphics) == null ? void 0 : _a.setInFocus(instance.props.inFocus, instance.props);
  },
  "line-of-sight": (instance, newValue) => {
    var _a;
    instance.props.lineOfSight = parseBoolAttribute(newValue, defaultInteractionLineOfSight);
    (_a = instance.interactionGraphics) == null ? void 0 : _a.setLineOfSight(instance.props.lineOfSight, instance.props);
  },
  priority: (instance, newValue) => {
    var _a;
    instance.props.priority = parseFloatAttribute(newValue, defaultInteractionPriority);
    (_a = instance.interactionGraphics) == null ? void 0 : _a.setPriority(instance.props.priority, instance.props);
  },
  prompt: (instance, newValue) => {
    var _a;
    instance.props.prompt = newValue;
    (_a = instance.interactionGraphics) == null ? void 0 : _a.setPrompt(instance.props.prompt, instance.props);
  },
  debug: (instance, newValue) => {
    var _a;
    instance.props.debug = parseBoolAttribute(newValue, defaultInteractionDebug);
    (_a = instance.interactionGraphics) == null ? void 0 : _a.setDebug(instance.props.debug, instance.props);
  }
});
var Interaction = _Interaction;
var MLabelAlignment = /* @__PURE__ */ ((MLabelAlignment2) => {
  MLabelAlignment2["left"] = "left";
  MLabelAlignment2["center"] = "center";
  MLabelAlignment2["right"] = "right";
  return MLabelAlignment2;
})(MLabelAlignment || {});
var defaultLabelColor = { r: 1, g: 1, b: 1 };
var defaultFontColor = { r: 0, g: 0, b: 0 };
var defaultLabelAlignment = "left";
var defaultLabelFontSize = 24;
var defaultLabelPadding = 8;
var defaultLabelWidth = 1;
var defaultLabelHeight = 1;
var defaultLabelCastShadows = true;
var defaultEmissive = 0;
var _Label = class _Label2 extends TransformableElement {
  constructor() {
    super();
    this.collideableHelper = new CollideableHelper(this);
    this.labelAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
      color: [
        2,
        defaultLabelColor,
        (newValue) => {
          var _a;
          this.props.color = newValue;
          (_a = this.labelGraphics) == null ? void 0 : _a.setColor(this.props.color, this.props);
        }
      ],
      "font-color": [
        2,
        defaultFontColor,
        (newValue) => {
          var _a;
          this.props.fontColor = newValue;
          (_a = this.labelGraphics) == null ? void 0 : _a.setFontColor(this.props.fontColor, this.props);
        }
      ],
      width: [
        0,
        defaultLabelWidth,
        (newValue) => {
          var _a;
          this.props.width = newValue;
          (_a = this.labelGraphics) == null ? void 0 : _a.setWidth(this.props.width, this.props);
        }
      ],
      height: [
        0,
        defaultLabelHeight,
        (newValue) => {
          var _a;
          this.props.height = newValue;
          (_a = this.labelGraphics) == null ? void 0 : _a.setHeight(this.props.height, this.props);
        }
      ],
      padding: [
        0,
        defaultLabelPadding,
        (newValue) => {
          var _a;
          this.props.padding = newValue;
          (_a = this.labelGraphics) == null ? void 0 : _a.setPadding(this.props.padding, this.props);
        }
      ],
      "font-size": [
        0,
        defaultLabelFontSize,
        (newValue) => {
          var _a;
          this.props.fontSize = newValue;
          (_a = this.labelGraphics) == null ? void 0 : _a.setFontSize(this.props.fontSize, this.props);
        }
      ]
    });
    this.props = {
      content: "",
      alignment: defaultLabelAlignment,
      width: defaultLabelWidth,
      height: defaultLabelHeight,
      fontSize: defaultLabelFontSize,
      padding: defaultLabelPadding,
      color: defaultLabelColor,
      fontColor: defaultFontColor,
      castShadows: defaultLabelCastShadows,
      emissive: defaultEmissive
    };
  }
  enable() {
  }
  disable() {
  }
  static get observedAttributes() {
    return [...TransformableElement.observedAttributes, ..._Label2.attributeHandler.getAttributes()];
  }
  getContentBounds() {
    if (!this.transformableElementGraphics) {
      return null;
    }
    return OrientedBoundingBox.fromSizeAndMatrixWorld(
      new Vect3(this.props.width, this.props.height, 0),
      this.transformableElementGraphics.getWorldMatrix()
    );
  }
  addSideEffectChild(child) {
    this.labelAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }
  removeSideEffectChild(child) {
    this.labelAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }
  parentTransformed() {
  }
  isClickable() {
    return true;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.labelGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    _Label2.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }
  connectedCallback() {
    var _a;
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter() || this.labelGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.labelGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLLabelGraphicsInterface(this);
    for (const name of _Label2.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
    this.applyBounds();
    this.collideableHelper.updateCollider((_a = this.labelGraphics) == null ? void 0 : _a.getCollisionElement());
  }
  disconnectedCallback() {
    var _a;
    this.collideableHelper.removeColliders();
    this.labelAnimatedAttributeHelper.reset();
    (_a = this.labelGraphics) == null ? void 0 : _a.dispose();
    this.labelGraphics = null;
    super.disconnectedCallback();
  }
};
_Label.tagName = "m-label";
_Label.attributeHandler = new AttributeHandler({
  width: (instance, newValue) => {
    instance.labelAnimatedAttributeHelper.elementSetAttribute(
      "width",
      parseFloatAttribute(newValue, defaultLabelWidth)
    );
  },
  height: (instance, newValue) => {
    instance.labelAnimatedAttributeHelper.elementSetAttribute(
      "height",
      parseFloatAttribute(newValue, defaultLabelHeight)
    );
  },
  color: (instance, newValue) => {
    instance.labelAnimatedAttributeHelper.elementSetAttribute(
      "color",
      parseColorAttribute(newValue, defaultLabelColor)
    );
  },
  "font-color": (instance, newValue) => {
    instance.labelAnimatedAttributeHelper.elementSetAttribute(
      "font-color",
      parseColorAttribute(newValue, defaultFontColor)
    );
  },
  "font-size": (instance, newValue) => {
    instance.labelAnimatedAttributeHelper.elementSetAttribute(
      "font-size",
      parseFloatAttribute(newValue, defaultLabelFontSize)
    );
  },
  padding: (instance, newValue) => {
    instance.labelAnimatedAttributeHelper.elementSetAttribute(
      "padding",
      parseFloatAttribute(newValue, defaultLabelPadding)
    );
  },
  content: (instance, newValue) => {
    var _a;
    instance.props.content = newValue || "";
    (_a = instance.labelGraphics) == null ? void 0 : _a.setContent(instance.props.content, instance.props);
  },
  alignment: (instance, newValue) => {
    var _a;
    instance.props.alignment = parseEnumAttribute(
      newValue,
      MLabelAlignment,
      defaultLabelAlignment
    );
    (_a = instance.labelGraphics) == null ? void 0 : _a.setAlignment(instance.props.alignment, instance.props);
  },
  "cast-shadows": (instance, newValue) => {
    var _a;
    instance.props.castShadows = parseBoolAttribute(newValue, defaultLabelCastShadows);
    (_a = instance.labelGraphics) == null ? void 0 : _a.setCastShadows(instance.props.castShadows, instance.props);
  },
  emissive: (instance, newValue) => {
    var _a;
    instance.props.emissive = parseFloatAttribute(newValue, defaultEmissive);
    (_a = instance.labelGraphics) == null ? void 0 : _a.setEmissive(instance.props.emissive, instance.props);
  }
});
var Label = _Label;
var LightTypes = /* @__PURE__ */ ((LightTypes2) => {
  LightTypes2["spotlight"] = "spotlight";
  LightTypes2["point"] = "point";
  return LightTypes2;
})(LightTypes || {});
var defaultLightColor = { r: 1, g: 1, b: 1 };
var defaultLightIntensity = 1;
var defaultLightAngle = 45;
var defaultLightEnabled = true;
var defaultLightDebug = false;
var defaultLightDistance = null;
var defaultLightCastShadows = true;
var defaultLightType = "spotlight";
var _Light = class _Light2 extends TransformableElement {
  constructor() {
    super();
    this.lightAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
      color: [
        2,
        defaultLightColor,
        (newValue) => {
          var _a;
          this.props.color = newValue;
          (_a = this.lightGraphics) == null ? void 0 : _a.setColor(newValue, this.props);
        }
      ],
      intensity: [
        0,
        defaultLightIntensity,
        (newValue) => {
          var _a;
          this.props.intensity = newValue;
          (_a = this.lightGraphics) == null ? void 0 : _a.setIntensity(newValue, this.props);
        }
      ],
      angle: [
        0,
        defaultLightAngle,
        (newValue) => {
          var _a;
          this.props.angleDeg = newValue;
          (_a = this.lightGraphics) == null ? void 0 : _a.setAngle(newValue, this.props);
        }
      ],
      distance: [
        0,
        defaultLightDistance,
        (newValue) => {
          var _a;
          this.props.distance = newValue;
          (_a = this.lightGraphics) == null ? void 0 : _a.setDistance(newValue, this.props);
        }
      ]
    });
    this.props = {
      color: defaultLightColor,
      intensity: defaultLightIntensity,
      enabled: defaultLightEnabled,
      angleDeg: defaultLightAngle,
      distance: defaultLightDistance,
      castShadows: defaultLightCastShadows,
      debug: defaultLightDebug,
      type: defaultLightType
    };
  }
  static get observedAttributes() {
    return [...TransformableElement.observedAttributes, ..._Light2.attributeHandler.getAttributes()];
  }
  enable() {
  }
  disable() {
  }
  getContentBounds() {
    if (!this.transformableElementGraphics) {
      return null;
    }
    return OrientedBoundingBox.fromMatrixWorld(this.transformableElementGraphics.getWorldMatrix());
  }
  addSideEffectChild(child) {
    if (AttributeAnimation.isAttributeAnimation(child)) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.lightAnimatedAttributeHelper.addAnimation(child, attr);
      }
    }
    super.addSideEffectChild(child);
  }
  removeSideEffectChild(child) {
    if (AttributeAnimation.isAttributeAnimation(child)) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.lightAnimatedAttributeHelper.removeAnimation(child, attr);
      }
    }
    super.removeSideEffectChild(child);
  }
  parentTransformed() {
  }
  isClickable() {
    return false;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.lightGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    _Light2.attributeHandler.handle(this, name, newValue);
  }
  connectedCallback() {
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter() || this.lightGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.lightGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLLightGraphicsInterface(this);
    for (const name of _Light2.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }
  disconnectedCallback() {
    var _a;
    this.lightAnimatedAttributeHelper.reset();
    (_a = this.lightGraphics) == null ? void 0 : _a.dispose();
    this.lightGraphics = null;
    super.disconnectedCallback();
  }
};
_Light.tagName = "m-light";
_Light.attributeHandler = new AttributeHandler({
  color: (instance, newValue) => {
    instance.lightAnimatedAttributeHelper.elementSetAttribute(
      "color",
      parseColorAttribute(newValue, defaultLightColor)
    );
  },
  intensity: (instance, newValue) => {
    instance.lightAnimatedAttributeHelper.elementSetAttribute(
      "intensity",
      parseFloatAttribute(newValue, defaultLightIntensity)
    );
  },
  angle: (instance, newValue) => {
    instance.lightAnimatedAttributeHelper.elementSetAttribute(
      "angle",
      parseFloatAttribute(newValue, defaultLightAngle)
    );
  },
  distance: (instance, newValue) => {
    instance.lightAnimatedAttributeHelper.elementSetAttribute(
      "distance",
      parseFloatAttribute(newValue, defaultLightDistance)
    );
  },
  enabled: (instance, newValue) => {
    var _a;
    instance.props.enabled = parseBoolAttribute(newValue, defaultLightEnabled);
    (_a = instance.lightGraphics) == null ? void 0 : _a.setEnabled(instance.props.enabled, instance.props);
  },
  "cast-shadows": (instance, newValue) => {
    var _a;
    instance.props.castShadows = parseBoolAttribute(newValue, defaultLightCastShadows);
    (_a = instance.lightGraphics) == null ? void 0 : _a.setCastShadows(instance.props.castShadows, instance.props);
  },
  debug: (instance, newValue) => {
    var _a;
    instance.props.debug = parseBoolAttribute(newValue, defaultLightDebug);
    (_a = instance.lightGraphics) == null ? void 0 : _a.setDebug(instance.props.debug, instance.props);
  },
  type: (instance, newValue) => {
    var _a;
    instance.props.type = parseEnumAttribute(newValue, LightTypes, defaultLightType);
    (_a = instance.lightGraphics) == null ? void 0 : _a.setType(instance.props.type, instance.props);
  }
});
var Light = _Light;
var _Link = class _Link2 extends TransformableElement {
  constructor() {
    super();
    this.abortController = null;
    this.props = {
      href: null,
      target: null
    };
    this.addEventListener("click", () => {
      if (this.props.href) {
        const href = this.props.href;
        if (!_Link2.isAcceptableHref(href)) {
          console.warn(
            `Refusing to navigate to ${href} as it does not meet the acceptable href criteria.`
          );
          return;
        }
        if (this.abortController) {
          this.abortController.abort();
          this.abortController = null;
        }
        this.abortController = new AbortController();
        this.getScene().link(
          { href, target: this.props.target ?? void 0, popup: false },
          this.abortController.signal,
          () => {
            this.abortController = null;
          }
        );
      }
    });
  }
  static get observedAttributes() {
    return [...TransformableElement.observedAttributes, ..._Link2.attributeHandler.getAttributes()];
  }
  /*
   This is a simple check to ensure that the href is an acceptable URL and is
   not a "javascript:alert('foo')" URL or something other than a navigable URL.
  */
  static isAcceptableHref(href) {
    const url = new URL(href, window.location.href);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return true;
    }
    return false;
  }
  parentTransformed() {
  }
  isClickable() {
    return false;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.transformableElementGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    _Link2.attributeHandler.handle(this, name, newValue);
  }
  disable() {
  }
  enable() {
  }
  getContentBounds() {
    return null;
  }
  connectedCallback() {
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter() || this.linkGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.linkGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLLinkGraphicsInterface(this);
    for (const name of _Link2.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }
  disconnectedCallback() {
    var _a;
    (_a = this.linkGraphics) == null ? void 0 : _a.dispose();
    this.linkGraphics = null;
    super.disconnectedCallback();
  }
};
_Link.tagName = "m-link";
_Link.attributeHandler = new AttributeHandler({
  href: (instance, newValue) => {
    instance.props.href = newValue !== null ? newValue : null;
  },
  target: (instance, newValue) => {
    instance.props.target = newValue !== null ? newValue : null;
  }
});
var Link = _Link;
var defaultPlaneColor = { r: 1, g: 1, b: 1 };
var defaultPlaneWidth = 1;
var defaultPlaneHeight = 1;
var defaultPlaneOpacity = 1;
var defaultPlaneCastShadows = true;
var _Plane = class _Plane2 extends TransformableElement {
  constructor() {
    super();
    this.props = {
      width: defaultPlaneWidth,
      height: defaultPlaneHeight,
      color: defaultPlaneColor,
      opacity: defaultPlaneOpacity,
      castShadows: defaultPlaneCastShadows
    };
    this.planeAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
      color: [
        2,
        defaultPlaneColor,
        (newValue) => {
          var _a;
          this.props.color = newValue;
          (_a = this.planeGraphics) == null ? void 0 : _a.setColor(newValue, this.props);
        }
      ],
      width: [
        0,
        defaultPlaneWidth,
        (newValue) => {
          var _a, _b;
          this.props.width = newValue;
          (_a = this.planeGraphics) == null ? void 0 : _a.setWidth(newValue, this.props);
          this.applyBounds();
          this.collideableHelper.updateCollider((_b = this.planeGraphics) == null ? void 0 : _b.getCollisionElement());
        }
      ],
      height: [
        0,
        defaultPlaneHeight,
        (newValue) => {
          var _a, _b;
          this.props.height = newValue;
          (_a = this.planeGraphics) == null ? void 0 : _a.setHeight(newValue, this.props);
          this.applyBounds();
          this.collideableHelper.updateCollider((_b = this.planeGraphics) == null ? void 0 : _b.getCollisionElement());
        }
      ],
      opacity: [
        0,
        defaultPlaneOpacity,
        (newValue) => {
          var _a;
          this.props.opacity = newValue;
          (_a = this.planeGraphics) == null ? void 0 : _a.setOpacity(newValue, this.props);
        }
      ]
    });
    this.collideableHelper = new CollideableHelper(this);
  }
  enable() {
    this.collideableHelper.enable();
  }
  disable() {
    this.collideableHelper.disable();
  }
  getContentBounds() {
    if (!this.transformableElementGraphics) {
      return null;
    }
    return OrientedBoundingBox.fromSizeAndMatrixWorld(
      new Vect3(this.props.width, this.props.height, 0),
      this.transformableElementGraphics.getWorldMatrix()
    );
  }
  static get observedAttributes() {
    return [
      ...TransformableElement.observedAttributes,
      ..._Plane2.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes
    ];
  }
  addSideEffectChild(child) {
    this.planeAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }
  removeSideEffectChild(child) {
    this.planeAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }
  parentTransformed() {
    this.collideableHelper.parentTransformed();
  }
  isClickable() {
    return true;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.planeGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    _Plane2.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }
  connectedCallback() {
    var _a;
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter() || this.planeGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.planeGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLPlaneGraphicsInterface(this);
    for (const name of _Plane2.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
    this.applyBounds();
    this.collideableHelper.updateCollider((_a = this.planeGraphics) == null ? void 0 : _a.getCollisionElement());
  }
  disconnectedCallback() {
    var _a;
    this.collideableHelper.removeColliders();
    this.planeAnimatedAttributeHelper.reset();
    (_a = this.planeGraphics) == null ? void 0 : _a.dispose();
    this.planeGraphics = null;
    super.disconnectedCallback();
  }
};
_Plane.tagName = "m-plane";
_Plane.attributeHandler = new AttributeHandler({
  width: (instance, newValue) => {
    instance.planeAnimatedAttributeHelper.elementSetAttribute(
      "width",
      parseFloatAttribute(newValue, defaultPlaneWidth)
    );
  },
  height: (instance, newValue) => {
    instance.planeAnimatedAttributeHelper.elementSetAttribute(
      "height",
      parseFloatAttribute(newValue, defaultPlaneHeight)
    );
  },
  color: (instance, newValue) => {
    instance.planeAnimatedAttributeHelper.elementSetAttribute(
      "color",
      parseColorAttribute(newValue, defaultPlaneColor)
    );
  },
  opacity: (instance, newValue) => {
    instance.planeAnimatedAttributeHelper.elementSetAttribute(
      "opacity",
      parseFloatAttribute(newValue, defaultPlaneOpacity)
    );
  },
  "cast-shadows": (instance, newValue) => {
    var _a;
    instance.props.castShadows = parseBoolAttribute(newValue, defaultPlaneCastShadows);
    (_a = instance.planeGraphics) == null ? void 0 : _a.setCastShadows(instance.props.castShadows, instance.props);
  }
});
var Plane = _Plane;
var defaultPositionProbeRange = 10;
var defaultPositionProbeInterval = 1e3;
var defaultPositionProbeMinimumInterval = 100;
var defaultPositionProbeDebug = false;
var positionProbeEnterEventName = "positionenter";
var positionProbePositionMoveEventName = "positionmove";
var positionProbeLeaveEventName = "positionleave";
var _PositionProbe = class _PositionProbe2 extends TransformableElement {
  constructor() {
    super();
    this.positionProbeAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
      range: [
        0,
        defaultPositionProbeRange,
        (newValue) => {
          var _a;
          this.props.range = newValue;
          (_a = this.positionProbeGraphics) == null ? void 0 : _a.setRange(newValue, this.props);
          this.applyBounds();
        }
      ]
    });
    this.props = {
      intervalMs: defaultPositionProbeInterval,
      debug: defaultPositionProbeDebug,
      range: defaultPositionProbeRange
    };
    this.timer = null;
    this.currentlyInRange = false;
  }
  static get observedAttributes() {
    return [
      ...TransformableElement.observedAttributes,
      ..._PositionProbe2.attributeHandler.getAttributes()
    ];
  }
  enable() {
  }
  disable() {
  }
  parentTransformed() {
  }
  getContentBounds() {
    if (!this.transformableElementGraphics) {
      return null;
    }
    return OrientedBoundingBox.fromSizeAndMatrixWorld(
      new Vect3(this.props.range * 2, this.props.range * 2, this.props.range * 2),
      this.transformableElementGraphics.getWorldMatrix()
    );
  }
  addSideEffectChild(child) {
    this.positionProbeAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }
  removeSideEffectChild(child) {
    this.positionProbeAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }
  isClickable() {
    return false;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.positionProbeGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    _PositionProbe2.attributeHandler.handle(this, name, newValue);
  }
  emitPosition() {
    const userPositionAndRotation = this.getUserPositionAndRotation();
    const elementRelative = getRelativePositionAndRotationRelativeToObject(
      userPositionAndRotation,
      this
    );
    const distance = new Vect3().copy(elementRelative.position).length();
    let withinBounds = true;
    this.getAppliedBounds().forEach((bounds) => {
      if (!bounds.containsPoint(userPositionAndRotation.position)) {
        withinBounds = false;
      }
    });
    if (withinBounds && distance <= this.props.range) {
      const elementRelativePositionAndRotation = {
        position: elementRelative.position,
        rotation: {
          x: elementRelative.rotation.x,
          y: elementRelative.rotation.y,
          z: elementRelative.rotation.z
        }
      };
      let documentRoot = null;
      const remoteDocument = this.getInitiatedRemoteDocument();
      if (remoteDocument) {
        documentRoot = remoteDocument;
      }
      const documentRelative = documentRoot !== null ? getRelativePositionAndRotationRelativeToObject(userPositionAndRotation, documentRoot) : userPositionAndRotation;
      const documentRelativePositionAndRotation = {
        position: documentRelative.position,
        rotation: {
          x: documentRelative.rotation.x,
          y: documentRelative.rotation.y,
          z: documentRelative.rotation.z
        }
      };
      if (!this.currentlyInRange) {
        this.currentlyInRange = true;
        this.dispatchEvent(
          new CustomEvent(positionProbeEnterEventName, {
            detail: {
              elementRelative: elementRelativePositionAndRotation,
              documentRelative: documentRelativePositionAndRotation
            }
          })
        );
      } else {
        this.dispatchEvent(
          new CustomEvent(positionProbePositionMoveEventName, {
            detail: {
              elementRelative: elementRelativePositionAndRotation,
              documentRelative: documentRelativePositionAndRotation
            }
          })
        );
      }
    } else {
      if (this.currentlyInRange) {
        this.currentlyInRange = false;
        this.dispatchEvent(new CustomEvent(positionProbeLeaveEventName, {}));
      }
    }
  }
  connectedCallback() {
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter() || this.positionProbeGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.positionProbeGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLPositionProbeGraphicsInterface(this);
    for (const name of _PositionProbe2.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
    this.applyBounds();
    this.startEmitting();
  }
  disconnectedCallback() {
    var _a;
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.positionProbeAnimatedAttributeHelper.reset();
    (_a = this.positionProbeGraphics) == null ? void 0 : _a.dispose();
    this.positionProbeGraphics = null;
    super.disconnectedCallback();
  }
  startEmitting() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(() => {
      this.emitPosition();
    }, this.props.intervalMs);
  }
};
_PositionProbe.tagName = "m-position-probe";
_PositionProbe.attributeHandler = new AttributeHandler({
  range: (instance, newValue) => {
    instance.positionProbeAnimatedAttributeHelper.elementSetAttribute(
      "range",
      parseFloatAttribute(newValue, defaultPositionProbeRange)
    );
  },
  interval: (instance, newValue) => {
    instance.props.intervalMs = Math.max(
      defaultPositionProbeMinimumInterval,
      parseFloatAttribute(newValue, defaultPositionProbeInterval)
    );
    instance.startEmitting();
  },
  debug: (instance, newValue) => {
    var _a;
    instance.props.debug = parseBoolAttribute(newValue, defaultPositionProbeDebug);
    (_a = instance.positionProbeGraphics) == null ? void 0 : _a.setDebug(instance.props.debug, instance.props);
  }
});
var PositionProbe = _PositionProbe;
var _Prompt = class _Prompt2 extends TransformableElement {
  constructor() {
    super();
    this.abortController = null;
    this.props = {
      message: void 0,
      placeholder: void 0,
      prefill: void 0
    };
    this.addEventListener("click", () => {
      this.trigger();
    });
  }
  enable() {
  }
  disable() {
  }
  static get observedAttributes() {
    return [...TransformableElement.observedAttributes, ..._Prompt2.attributeHandler.getAttributes()];
  }
  getContentBounds() {
    return null;
  }
  parentTransformed() {
  }
  isClickable() {
    return false;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.promptGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    _Prompt2.attributeHandler.handle(this, name, newValue);
  }
  trigger() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.abortController = new AbortController();
    this.getScene().prompt(this.props, this.abortController.signal, (result) => {
      if (!this.isConnected) {
        return;
      }
      if (result !== null) {
        this.dispatchEvent(
          new CustomEvent("prompt", { bubbles: false, detail: { value: result } })
        );
      }
    });
  }
  connectedCallback() {
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter() || this.promptGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.promptGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLPromptGraphicsInterface(this);
    for (const name of _Prompt2.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
  }
  disconnectedCallback() {
    var _a;
    (_a = this.promptGraphics) == null ? void 0 : _a.dispose();
    this.promptGraphics = null;
    super.disconnectedCallback();
  }
};
_Prompt.tagName = "m-prompt";
_Prompt.attributeHandler = new AttributeHandler({
  message: (instance, newValue) => {
    var _a;
    instance.props.message = newValue !== null ? newValue : void 0;
    (_a = instance.promptGraphics) == null ? void 0 : _a.setMessage(instance.props.message, instance.props);
  },
  placeholder: (instance, newValue) => {
    var _a;
    instance.props.placeholder = newValue !== null ? newValue : void 0;
    (_a = instance.promptGraphics) == null ? void 0 : _a.setPlaceholder(instance.props.placeholder, instance.props);
  },
  prefill: (instance, newValue) => {
    var _a;
    instance.props.prefill = newValue !== null ? newValue : void 0;
    (_a = instance.promptGraphics) == null ? void 0 : _a.setPrefill(instance.props.prefill, instance.props);
  }
});
var Prompt = _Prompt;
var MMLDocumentTimeManager = class {
  constructor() {
    this.relativeDocumentStartTime = 0;
    this.overridenDocumentTime = null;
    this.documentTimeListeners = /* @__PURE__ */ new Set();
    this.documentTimeTickListeners = /* @__PURE__ */ new Set();
  }
  tick() {
    const documentTime = this.getDocumentTime();
    for (const cb of this.documentTimeTickListeners) {
      cb(documentTime);
    }
  }
  getDocumentTime() {
    if (this.overridenDocumentTime !== null) {
      return this.overridenDocumentTime;
    }
    return document.timeline.currentTime - this.relativeDocumentStartTime;
  }
  getWindowTime() {
    if (this.overridenDocumentTime !== null) {
      return this.overridenDocumentTime;
    }
    return document.timeline.currentTime;
  }
  addDocumentTimeListenerCallback(cb) {
    this.documentTimeListeners.add(cb);
  }
  removeDocumentTimeListenerCallback(cb) {
    this.documentTimeListeners.delete(cb);
  }
  addDocumentTimeTickListenerCallback(cb) {
    this.documentTimeTickListeners.add(cb);
  }
  removeDocumentTimeTickListenerCallback(cb) {
    this.documentTimeTickListeners.delete(cb);
  }
  setDocumentTime(documentTime) {
    if (this.overridenDocumentTime !== null) {
      return;
    }
    this.relativeDocumentStartTime = document.timeline.currentTime - documentTime;
    for (const cb of this.documentTimeListeners) {
      cb(documentTime);
    }
  }
  // This method is used for testing to allow overriding the document time
  overrideDocumentTime(documentTime) {
    this.overridenDocumentTime = documentTime;
    for (const cb of this.documentTimeListeners) {
      cb(documentTime);
    }
  }
};
var RemoteDocument = class extends MElement {
  constructor() {
    super();
    this.scene = null;
    this.documentAddress = null;
    this.animationFrameCallback = null;
    this.documentTimeManager = new MMLDocumentTimeManager();
    this.addEventListener(consumeEventEventName, (wrappedEvent) => {
      wrappedEvent.stopPropagation();
    });
  }
  showError(showError) {
    var _a;
    (_a = this.remoteDocumentGraphics) == null ? void 0 : _a.showError(showError);
  }
  enable() {
  }
  disable() {
  }
  getContentBounds() {
    return null;
  }
  parentTransformed() {
  }
  isClickable() {
    return false;
  }
  getDocumentTimeManager() {
    return this.documentTimeManager;
  }
  connectedCallback() {
    this.style.display = "none";
    if (!this.isConnected) {
      return;
    }
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter() || this.remoteDocumentGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.remoteDocumentGraphics = graphicsAdapter.getGraphicsAdapterFactory().RemoteDocumentGraphicsInterface(this);
    this.animationFrameCallback = window.requestAnimationFrame(() => {
      this.tick();
    });
  }
  disconnectedCallback() {
    var _a;
    if (this.animationFrameCallback) {
      window.cancelAnimationFrame(this.animationFrameCallback);
      this.animationFrameCallback = null;
    }
    (_a = this.remoteDocumentGraphics) == null ? void 0 : _a.dispose();
    this.remoteDocumentGraphics = null;
    super.disconnectedCallback();
  }
  dispatchEvent(event) {
    if (this.contains(event.detail.element)) {
      return HTMLElement.prototype.dispatchEvent.call(this, event);
    } else {
      return false;
    }
  }
  init(mmlScene, documentAddress) {
    if (this.scene) {
      throw new Error("Scene already set");
    }
    this.scene = mmlScene;
    this.documentAddress = documentAddress;
    this.connectedCallback();
  }
  getDocumentAddress() {
    return this.documentAddress;
  }
  getMMLScene() {
    if (!this.scene) {
      return null;
    }
    return this.scene;
  }
  tick() {
    this.documentTimeManager.tick();
    this.animationFrameCallback = window.requestAnimationFrame(() => {
      this.tick();
    });
  }
};
RemoteDocument.tagName = "m-remote-document";
var defaultSphereColor = { r: 1, g: 1, b: 1 };
var defaultSphereRadius = 0.5;
var defaultSphereOpacity = 1;
var defaultSphereCastShadows = true;
var _Sphere = class _Sphere2 extends TransformableElement {
  constructor() {
    super();
    this.props = {
      radius: defaultSphereRadius,
      color: defaultSphereColor,
      opacity: defaultSphereOpacity,
      castShadows: defaultSphereCastShadows
    };
    this.sphereAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
      color: [
        2,
        defaultSphereColor,
        (newValue) => {
          var _a;
          this.props.color = newValue;
          (_a = this.sphereGraphics) == null ? void 0 : _a.setColor(newValue, this.props);
        }
      ],
      radius: [
        0,
        defaultSphereRadius,
        (newValue) => {
          var _a, _b;
          this.props.radius = newValue;
          (_a = this.sphereGraphics) == null ? void 0 : _a.setRadius(newValue, this.props);
          this.applyBounds();
          this.collideableHelper.updateCollider((_b = this.sphereGraphics) == null ? void 0 : _b.getCollisionElement());
        }
      ],
      opacity: [
        0,
        defaultSphereOpacity,
        (newValue) => {
          var _a;
          this.props.opacity = newValue;
          (_a = this.sphereGraphics) == null ? void 0 : _a.setOpacity(newValue, this.props);
        }
      ]
    });
    this.collideableHelper = new CollideableHelper(this);
  }
  enable() {
    this.collideableHelper.enable();
  }
  disable() {
    this.collideableHelper.disable();
  }
  getContentBounds() {
    if (!this.transformableElementGraphics) {
      return null;
    }
    return OrientedBoundingBox.fromSizeAndMatrixWorld(
      new Vect3(this.props.radius * 2, this.props.radius * 2, this.props.radius * 2),
      this.transformableElementGraphics.getWorldMatrix()
    );
  }
  static get observedAttributes() {
    return [
      ...TransformableElement.observedAttributes,
      ..._Sphere2.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes
    ];
  }
  addSideEffectChild(child) {
    this.sphereAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }
  removeSideEffectChild(child) {
    this.sphereAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }
  parentTransformed() {
    this.collideableHelper.parentTransformed();
  }
  isClickable() {
    return true;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.sphereGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    _Sphere2.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }
  connectedCallback() {
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter() || this.sphereGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.sphereGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLSphereGraphicsInterface(this);
    for (const name of _Sphere2.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
    this.applyBounds();
    this.collideableHelper.updateCollider(this.sphereGraphics.getCollisionElement());
  }
  disconnectedCallback() {
    var _a;
    this.collideableHelper.removeColliders();
    this.sphereAnimatedAttributeHelper.reset();
    (_a = this.sphereGraphics) == null ? void 0 : _a.dispose();
    this.sphereGraphics = null;
    super.disconnectedCallback();
  }
};
_Sphere.tagName = "m-sphere";
_Sphere.attributeHandler = new AttributeHandler({
  radius: (instance, newValue) => {
    instance.sphereAnimatedAttributeHelper.elementSetAttribute(
      "radius",
      parseFloatAttribute(newValue, defaultSphereRadius)
    );
  },
  color: (instance, newValue) => {
    instance.sphereAnimatedAttributeHelper.elementSetAttribute(
      "color",
      parseColorAttribute(newValue, defaultSphereColor)
    );
  },
  opacity: (instance, newValue) => {
    instance.sphereAnimatedAttributeHelper.elementSetAttribute(
      "opacity",
      parseFloatAttribute(newValue, defaultSphereOpacity)
    );
  },
  "cast-shadows": (instance, newValue) => {
    var _a;
    instance.props.castShadows = parseBoolAttribute(newValue, defaultSphereCastShadows);
    (_a = instance.sphereGraphics) == null ? void 0 : _a.setCastShadows(instance.props.castShadows, instance.props);
  }
});
var Sphere = _Sphere;
var defaultVideoWidth = null;
var defaultVideoHeight = null;
var defaultVideoVolume = 1;
var defaultVideoLoop = true;
var defaultVideoEnabled = true;
var defaultVideoStartTime = 0;
var defaultVideoPauseTime = null;
var defaultVideoSrc = null;
var defaultVideoCastShadows = true;
var defaultVideoEmissive = 0;
var _Video = class _Video2 extends TransformableElement {
  constructor() {
    super();
    this.videoAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
      width: [
        0,
        defaultVideoWidth,
        (newValue) => {
          var _a;
          this.props.width = newValue;
          (_a = this.videoGraphics) == null ? void 0 : _a.setWidth(newValue, this.props);
        }
      ],
      height: [
        0,
        defaultVideoHeight,
        (newValue) => {
          var _a;
          this.props.height = newValue;
          (_a = this.videoGraphics) == null ? void 0 : _a.setHeight(newValue, this.props);
        }
      ],
      emissive: [
        0,
        defaultVideoEmissive,
        (newValue) => {
          var _a;
          this.props.emissive = newValue;
          (_a = this.videoGraphics) == null ? void 0 : _a.setEmissive(newValue, this.props);
        }
      ]
    });
    this.collideableHelper = new CollideableHelper(this);
    this.props = {
      startTime: defaultVideoStartTime,
      pauseTime: defaultVideoPauseTime,
      src: defaultVideoSrc,
      loop: defaultVideoLoop,
      enabled: defaultVideoEnabled,
      volume: defaultVideoVolume,
      width: defaultVideoWidth,
      height: defaultVideoHeight,
      castShadows: defaultVideoCastShadows,
      emissive: defaultVideoEmissive
    };
  }
  static get observedAttributes() {
    return [
      ...TransformableElement.observedAttributes,
      ..._Video2.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes
    ];
  }
  enable() {
    var _a;
    (_a = this.videoGraphics) == null ? void 0 : _a.syncVideoTime();
  }
  disable() {
    var _a;
    (_a = this.videoGraphics) == null ? void 0 : _a.syncVideoTime();
  }
  getContentBounds() {
    if (!this.videoGraphics || !this.transformableElementGraphics) {
      return null;
    }
    const { width, height } = this.videoGraphics.getWidthAndHeight() || { width: 0, height: 0 };
    return OrientedBoundingBox.fromSizeAndMatrixWorld(
      new Vect3(width, height, 0),
      this.transformableElementGraphics.getWorldMatrix()
    );
  }
  addSideEffectChild(child) {
    this.videoAnimatedAttributeHelper.addSideEffectChild(child);
    super.addSideEffectChild(child);
  }
  removeSideEffectChild(child) {
    this.videoAnimatedAttributeHelper.removeSideEffectChild(child);
    super.removeSideEffectChild(child);
  }
  parentTransformed() {
    this.collideableHelper.parentTransformed();
  }
  isClickable() {
    return true;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.videoGraphics) {
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
    _Video2.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }
  documentTimeChanged() {
    var _a;
    (_a = this.videoGraphics) == null ? void 0 : _a.syncVideoTime();
  }
  connectedCallback() {
    var _a;
    super.connectedCallback();
    if (!this.getScene().hasGraphicsAdapter() || this.videoGraphics) {
      return;
    }
    const graphicsAdapter = this.getScene().getGraphicsAdapter();
    this.videoGraphics = graphicsAdapter.getGraphicsAdapterFactory().MMLVideoGraphicsInterface(this, () => {
      var _a2;
      this.applyBounds();
      this.collideableHelper.updateCollider((_a2 = this.videoGraphics) == null ? void 0 : _a2.getCollisionElement());
    });
    this.documentTimeListener = this.addDocumentTimeListener(() => {
      this.documentTimeChanged();
    });
    for (const name of _Video2.observedAttributes) {
      const value = this.getAttribute(name);
      if (value !== null) {
        this.attributeChangedCallback(name, null, value);
      }
    }
    this.collideableHelper.updateCollider((_a = this.videoGraphics) == null ? void 0 : _a.getCollisionElement());
  }
  disconnectedCallback() {
    var _a;
    this.videoAnimatedAttributeHelper.reset();
    (_a = this.videoGraphics) == null ? void 0 : _a.dispose();
    this.videoGraphics = null;
    this.documentTimeListener.remove();
    this.collideableHelper.removeColliders();
    super.disconnectedCallback();
  }
};
_Video.tagName = "m-video";
_Video.attributeHandler = new AttributeHandler({
  width: (instance, newValue) => {
    instance.videoAnimatedAttributeHelper.elementSetAttribute(
      "width",
      parseFloatAttribute(newValue, defaultVideoWidth)
    );
  },
  height: (instance, newValue) => {
    instance.videoAnimatedAttributeHelper.elementSetAttribute(
      "height",
      parseFloatAttribute(newValue, defaultVideoHeight)
    );
  },
  enabled: (instance, newValue) => {
    var _a;
    instance.props.enabled = parseBoolAttribute(newValue, defaultVideoEnabled);
    (_a = instance.videoGraphics) == null ? void 0 : _a.setEnabled(instance.props.enabled, instance.props);
  },
  loop: (instance, newValue) => {
    var _a;
    instance.props.loop = parseBoolAttribute(newValue, defaultVideoLoop);
    (_a = instance.videoGraphics) == null ? void 0 : _a.setLoop(instance.props.loop, instance.props);
  },
  "start-time": (instance, newValue) => {
    var _a;
    instance.props.startTime = parseFloatAttribute(newValue, defaultVideoStartTime);
    (_a = instance.videoGraphics) == null ? void 0 : _a.setStartTime(instance.props.startTime, instance.props);
  },
  "pause-time": (instance, newValue) => {
    var _a;
    instance.props.pauseTime = parseFloatAttribute(newValue, defaultVideoPauseTime);
    (_a = instance.videoGraphics) == null ? void 0 : _a.setPauseTime(instance.props.pauseTime, instance.props);
  },
  src: (instance, newValue) => {
    var _a;
    instance.props.src = newValue;
    (_a = instance.videoGraphics) == null ? void 0 : _a.setSrc(newValue, instance.props);
  },
  volume: (instance, newValue) => {
    var _a;
    instance.props.volume = parseFloatAttribute(newValue, defaultVideoVolume);
    (_a = instance.videoGraphics) == null ? void 0 : _a.setVolume(instance.props.volume, instance.props);
  },
  "cast-shadows": (instance, newValue) => {
    var _a;
    instance.props.castShadows = parseBoolAttribute(newValue, defaultVideoCastShadows);
    (_a = instance.videoGraphics) == null ? void 0 : _a.setCastShadows(instance.props.castShadows, instance.props);
  },
  emissive: (instance, newValue) => {
    instance.videoAnimatedAttributeHelper.elementSetAttribute(
      "emissive",
      parseFloatAttribute(newValue, defaultVideoEmissive)
    );
  }
});
var Video = _Video;
function registerCustomElementsToWindow(targetWindow) {
  const targetHTMLElement = targetWindow["HTMLElement"];
  MElement.overwriteSuperclass(targetHTMLElement);
  targetWindow.customElements.define(RemoteDocument.tagName, RemoteDocument);
  targetWindow.customElements.define(Light.tagName, Light);
  targetWindow.customElements.define(Model.tagName, Model);
  targetWindow.customElements.define(Character.tagName, Character);
  targetWindow.customElements.define(Cube.tagName, Cube);
  targetWindow.customElements.define(Frame.tagName, Frame);
  targetWindow.customElements.define(Cylinder.tagName, Cylinder);
  targetWindow.customElements.define(Plane.tagName, Plane);
  targetWindow.customElements.define(Label.tagName, Label);
  targetWindow.customElements.define(Group.tagName, Group);
  targetWindow.customElements.define(Prompt.tagName, Prompt);
  targetWindow.customElements.define(Link.tagName, Link);
  targetWindow.customElements.define(Sphere.tagName, Sphere);
  targetWindow.customElements.define(Image.tagName, Image);
  targetWindow.customElements.define(Video.tagName, Video);
  targetWindow.customElements.define(Audio.tagName, Audio);
  targetWindow.customElements.define(PositionProbe.tagName, PositionProbe);
  targetWindow.customElements.define(ChatProbe.tagName, ChatProbe);
  targetWindow.customElements.define(Interaction.tagName, Interaction);
  targetWindow.customElements.define(AttributeAnimation.tagName, AttributeAnimation);
  targetWindow.customElements.define(AttributeLerp.tagName, AttributeLerp);
}
var EventHandlerCollection = class _EventHandlerCollection {
  constructor() {
    this.eventsByTarget = /* @__PURE__ */ new Map();
  }
  add(target, key, listener, options) {
    target.addEventListener(key, listener, options);
    let existingTarget = this.eventsByTarget.get(target);
    if (existingTarget === void 0) {
      existingTarget = /* @__PURE__ */ new Map();
      this.eventsByTarget.set(target, existingTarget);
    }
    let existingKey = existingTarget.get(key);
    if (existingKey === void 0) {
      existingKey = /* @__PURE__ */ new Set();
      existingTarget.set(key, existingKey);
    }
    existingKey.add(listener);
    return this;
  }
  clear() {
    this.eventsByTarget.forEach((keyMap, target) => {
      keyMap.forEach((listenerSet, key) => {
        listenerSet.forEach((listenerFunc) => {
          target.removeEventListener(key, listenerFunc);
        });
      });
    });
    this.eventsByTarget.clear();
  }
  static create(initial) {
    const instance = new _EventHandlerCollection();
    if (initial !== void 0) {
      initial.forEach(([target, key, listenerFunc, options]) => {
        instance.add(target, key, listenerFunc, options);
      });
    }
    return instance;
  }
};
function createInteractionsHolder(onPrev, onNext, onClose) {
  const holderElement = document.createElement("div");
  holderElement.setAttribute("data-test-id", "interactions-holder");
  holderElement.style.zIndex = "100";
  holderElement.style.position = "absolute";
  holderElement.style.backgroundColor = "white";
  holderElement.style.padding = "10px";
  holderElement.style.display = "none";
  holderElement.style.border = "1px solid #AAA";
  holderElement.style.fontFamily = "sans-serif";
  holderElement.style.top = "50%";
  holderElement.style.left = "50%";
  holderElement.style.transform = "translate(-50%, -50%)";
  const closeButtonHolder = document.createElement("div");
  closeButtonHolder.style.display = "flex";
  closeButtonHolder.style.justifyContent = "flex-end";
  holderElement.appendChild(closeButtonHolder);
  const title = document.createElement("h3");
  title.style.textAlign = "center";
  title.textContent = "Interactions";
  holderElement.appendChild(title);
  const closeButton = document.createElement("button");
  closeButton.textContent = "Close";
  closeButton.style.cursor = "pointer";
  closeButton.addEventListener("click", () => {
    onClose();
  });
  closeButtonHolder.appendChild(closeButton);
  const listElement = document.createElement("div");
  listElement.setAttribute("data-test-id", "interactions-list");
  holderElement.appendChild(listElement);
  const buttonHolder = document.createElement("div");
  buttonHolder.style.display = "flex";
  buttonHolder.style.justifyContent = "space-between";
  holderElement.appendChild(buttonHolder);
  const prevButton = document.createElement("button");
  prevButton.textContent = "Prev";
  prevButton.style.cursor = "pointer";
  prevButton.addEventListener("click", onPrev);
  buttonHolder.appendChild(prevButton);
  const statusHolder = document.createElement("div");
  statusHolder.style.display = "flex";
  statusHolder.style.justifyContent = "center";
  statusHolder.style.padding = "5px";
  buttonHolder.appendChild(statusHolder);
  const nextButton = document.createElement("button");
  nextButton.textContent = "Next";
  nextButton.style.cursor = "pointer";
  nextButton.addEventListener("click", onNext);
  buttonHolder.appendChild(nextButton);
  return { holderElement, listElement, prevButton, statusHolder, nextButton };
}
function createInteractionPrompt() {
  const interactionPrompt = document.createElement("div");
  interactionPrompt.setAttribute("data-test-id", "interactions-prompt");
  interactionPrompt.style.zIndex = "101";
  interactionPrompt.style.position = "absolute";
  interactionPrompt.style.top = "10px";
  interactionPrompt.style.left = "10px";
  interactionPrompt.style.display = "none";
  interactionPrompt.style.padding = "12px 10px";
  interactionPrompt.style.fontFamily = "Helvetica";
  interactionPrompt.style.color = "white";
  interactionPrompt.style.backgroundColor = "#222222b2";
  interactionPrompt.innerHTML = "Press E to interact";
  return interactionPrompt;
}
var _InteractionManager = class _InteractionManager2 {
  constructor(container, interactionShouldShowDistance) {
    this.container = container;
    this.interactionShouldShowDistance = interactionShouldShowDistance;
    this.pageOffset = 0;
    this.eventCollection = new EventHandlerCollection();
    this.possibleActions = /* @__PURE__ */ new Map();
    this.visibleActions = /* @__PURE__ */ new Set();
    this.tickInterval = null;
    this.sortedActions = [];
    this.container = container;
    const { holderElement, listElement, prevButton, statusHolder, nextButton } = createInteractionsHolder(
      () => {
        this.pageOffset--;
        this.displayInteractions();
      },
      () => {
        this.pageOffset++;
        this.displayInteractions();
      },
      () => {
        this.hideHolder();
      }
    );
    this.prevButton = prevButton;
    this.statusHolder = statusHolder;
    this.nextButton = nextButton;
    this.interactionListElement = listElement;
    this.interactionHolderElement = holderElement;
    this.container.appendChild(this.interactionHolderElement);
    this.interactionPromptElement = createInteractionPrompt();
    this.container.appendChild(this.interactionPromptElement);
    this.eventCollection.add(document, "keydown", (e) => {
      if (e.code === "KeyE") {
        if (this.interactionHolderElement.style.display === "block") {
          this.hideHolder();
          return;
        }
        if (this.visibleActions.size > 0) {
          this.showHolder();
        }
      } else if (e.code === "Escape") {
        this.hideHolder();
      }
    });
  }
  static createButtonText(interaction) {
    return `${interaction.props.prompt ?? "Interact"}`;
  }
  getInteractionListener() {
    return {
      addInteraction: (interaction) => {
        this.possibleActions.set(interaction, {
          interaction
        });
      },
      removeInteraction: (interaction) => {
        const interactionState = this.possibleActions.get(interaction);
        if (!interactionState) {
          console.warn("Interaction not found", interaction);
          return;
        }
        if (interactionState.button) {
          interactionState.button.remove();
        }
        this.possibleActions.delete(interaction);
        if (this.visibleActions.has(interactionState)) {
          this.visibleActions.delete(interactionState);
          if (this.visibleActions.size === 0) {
            this.hidePrompt();
          }
        }
      },
      updateInteraction: (interaction) => {
        const interactionState = this.possibleActions.get(interaction);
        if (!interactionState) {
          console.warn("Interaction not found", interaction);
          return;
        }
        if (interactionState.button) {
          interactionState.button.textContent = _InteractionManager2.createButtonText(interaction);
        }
      }
    };
  }
  static init(container, interactionShouldShowDistance) {
    const interactionManager = new _InteractionManager2(container, interactionShouldShowDistance);
    interactionManager.startTick();
    return { interactionManager, interactionListener: interactionManager.getInteractionListener() };
  }
  dispose() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
    this.eventCollection.clear();
    this.interactionListElement.remove();
    this.interactionHolderElement.remove();
    this.interactionPromptElement.remove();
  }
  startTick() {
    this.tickInterval = setInterval(() => {
      this.possibleActions.forEach((interactionState, interaction) => {
        const showDistance = this.interactionShouldShowDistance(interaction);
        if (showDistance !== null) {
          interactionState.distance = showDistance;
          this.visibleActions.add(interactionState);
        } else {
          this.visibleActions.delete(interactionState);
        }
      });
      if (this.visibleActions.size === 0) {
        this.hidePrompt();
        this.hideHolder();
        return;
      } else {
        this.showPrompt();
      }
      this.sortedActions = Array.from(this.visibleActions).sort(
        (a, b) => {
          const priorityDiff = a.interaction.props.priority - b.interaction.props.priority;
          if (priorityDiff !== 0) {
            return priorityDiff;
          }
          if (a.distance && b.distance) {
            const distanceDiff = a.distance - b.distance;
            if (Math.abs(distanceDiff) > 0.1) {
              return distanceDiff;
            }
          }
          return 0;
        }
      );
      this.displayInteractions();
    }, 1e3);
  }
  displayInteractions() {
    this.interactionListElement.innerHTML = "";
    const maximumPageOffset = Math.floor(
      (this.sortedActions.length - 1) / _InteractionManager2.pageLimit
    );
    if (this.pageOffset > maximumPageOffset) {
      this.pageOffset = maximumPageOffset;
    }
    if (this.pageOffset < 0) {
      this.pageOffset = 0;
    }
    const startIndex = this.pageOffset * _InteractionManager2.pageLimit;
    const pagedItems = this.sortedActions.slice(
      startIndex,
      startIndex + _InteractionManager2.pageLimit
    );
    if (this.pageOffset > 0) {
      this.prevButton.removeAttribute("disabled");
    } else {
      this.prevButton.setAttribute("disabled", "true");
    }
    if (this.pageOffset < maximumPageOffset) {
      this.nextButton.removeAttribute("disabled");
    } else {
      this.nextButton.setAttribute("disabled", "true");
    }
    this.statusHolder.textContent = `Page ${this.pageOffset + 1} of ${maximumPageOffset + 1}`;
    pagedItems.forEach((interactionState) => {
      if (!interactionState.button) {
        const interactionText = _InteractionManager2.createButtonText(interactionState.interaction);
        const button = document.createElement("button");
        button.style.display = "block";
        button.style.marginBottom = "5px";
        button.style.cursor = "pointer";
        button.style.textOverflow = "ellipsis";
        button.style.overflow = "hidden";
        button.style.whiteSpace = "nowrap";
        button.style.maxWidth = "200px";
        button.setAttribute("data-test-id", `interaction-${interactionText}`);
        button.textContent = interactionText;
        button.addEventListener("click", () => {
          interactionState.interaction.trigger();
          this.hideHolder();
        });
        interactionState.button = button;
      }
      this.interactionListElement.appendChild(interactionState.button);
    });
  }
  hideHolder() {
    this.interactionHolderElement.style.display = "none";
  }
  showHolder() {
    this.interactionHolderElement.style.display = "block";
  }
  hidePrompt() {
    this.interactionPromptElement.style.display = "none";
  }
  showPrompt() {
    this.interactionPromptElement.style.display = "block";
  }
};
_InteractionManager.pageLimit = 3;
var InteractionManager = _InteractionManager;
var Modal = class {
  constructor() {
    this.element = document.createElement("div");
    this.element.style.display = "block";
    this.element.style.border = "1px solid #AAA";
    this.element.style.fontFamily = "sans-serif";
    this.element.style.color = "black";
    this.element.style.boxShadow = "0px 4px 4px rgba(0, 0, 0, 0.1)";
    this.element.style.backdropFilter = "blur(4px)";
    this.element.style.borderRadius = "4px";
    this.titleElement = document.createElement("div");
    this.titleElement.style.background = "rgba(255, 255, 255, 0.8)";
    this.titleElement.style.padding = "8px";
    this.titleElement.style.fontWeight = "bold";
    this.titleElement.style.borderBottom = "1px solid #AAA";
    this.contentsElement = document.createElement("div");
    this.contentsElement.style.background = "rgba(255, 255, 255, 0.6)";
    this.contentsElement.style.padding = "8px";
    this.element.append(this.titleElement, this.contentsElement);
    this.element.addEventListener("keydown", (e) => {
      e.stopPropagation();
    });
  }
  dispose() {
    this.element.remove();
  }
};
var ConfirmModal = class extends Modal {
  constructor(title, message, callback) {
    super();
    this.titleElement.textContent = title;
    this.confirmContentsElement = document.createElement("div");
    this.messageElement = document.createElement("div");
    this.messageElement.textContent = message;
    this.messageElement.style.marginBottom = "8px";
    this.confirmContentsElement.appendChild(this.messageElement);
    this.contentsElement.appendChild(this.confirmContentsElement);
    this.buttonsHolder = document.createElement("div");
    this.buttonsHolder.style.display = "flex";
    this.buttonsHolder.style.justifyContent = "space-between";
    this.buttonsHolder.style.marginTop = "8px";
    this.cancelButton = document.createElement("button");
    this.cancelButton.setAttribute("data-test-id", "confirm-modal-cancel-button");
    this.cancelButton.style.cursor = "pointer";
    this.cancelButton.textContent = "Cancel";
    this.cancelButton.addEventListener("click", () => {
      callback(false);
      this.dispose();
    });
    this.buttonsHolder.appendChild(this.cancelButton);
    this.okButton = document.createElement("button");
    this.okButton.setAttribute("data-test-id", "confirm-modal-ok-button");
    this.okButton.style.cursor = "pointer";
    this.okButton.textContent = "OK";
    this.okButton.addEventListener("click", () => {
      callback(true);
      this.dispose();
    });
    this.buttonsHolder.appendChild(this.okButton);
    this.contentsElement.appendChild(this.buttonsHolder);
  }
};
var PromptModal = class extends Modal {
  constructor(promptProps, callback) {
    super();
    this.eventHandlerCollection = new EventHandlerCollection();
    this.callback = callback;
    this.titleElement.textContent = "Prompt";
    this.promptContentsElement = document.createElement("div");
    this.promptMessageElement = document.createElement("div");
    this.promptMessageElement.textContent = promptProps.message || "Enter a value";
    this.promptMessageElement.style.marginBottom = "8px";
    this.promptContentsElement.appendChild(this.promptMessageElement);
    this.promptInputElement = document.createElement("input");
    this.promptInputElement.type = "text";
    this.promptInputElement.style.width = "80vw";
    this.promptInputElement.style.maxWidth = "300px";
    this.promptInputElement.setAttribute("data-test-id", "prompt-input");
    this.promptInputElement.setAttribute("placeholder", promptProps.placeholder || "");
    this.promptInputElement.setAttribute("value", promptProps.prefill || "");
    this.promptInputElement.addEventListener("change", () => {
      this.checkValue();
    });
    this.promptInputElement.addEventListener("keyup", (event) => {
      if (event.key === "Enter") {
        if (this.promptInputElement.value.length > 0) {
          this.dispose();
          this.callback(this.promptInputElement.value);
        }
      }
      this.checkValue();
    });
    this.eventHandlerCollection.add(document, "keydown", (e) => {
      if (e.code === "Escape") {
        this.dispose();
        this.callback(null);
      }
      this.checkValue();
    });
    this.promptContentsElement.appendChild(this.promptInputElement);
    this.contentsElement.appendChild(this.promptContentsElement);
    this.buttonsHolder = document.createElement("div");
    this.buttonsHolder.style.display = "flex";
    this.buttonsHolder.style.justifyContent = "space-between";
    this.buttonsHolder.style.marginTop = "8px";
    this.cancelButton = document.createElement("button");
    this.cancelButton.setAttribute("data-test-id", "prompt-cancel-button");
    this.cancelButton.style.cursor = "pointer";
    this.cancelButton.textContent = "Cancel";
    this.cancelButton.addEventListener("click", () => {
      this.dispose();
      this.callback(null);
    });
    this.buttonsHolder.appendChild(this.cancelButton);
    this.okButton = document.createElement("button");
    this.okButton.setAttribute("data-test-id", "prompt-ok-button");
    this.okButton.style.cursor = "pointer";
    this.okButton.textContent = "OK";
    this.okButton.addEventListener("click", () => {
      this.dispose();
      this.callback(this.promptInputElement.value);
    });
    this.buttonsHolder.appendChild(this.okButton);
    this.contentsElement.appendChild(this.buttonsHolder);
  }
  focus() {
    this.promptInputElement.focus();
    this.promptInputElement.setSelectionRange(
      this.promptInputElement.value.length,
      this.promptInputElement.value.length
    );
    this.checkValue();
  }
  dispose() {
    this.eventHandlerCollection.clear();
    super.dispose();
  }
  checkValue() {
    if (this.promptInputElement.value.length > 0) {
      this.okButton.disabled = false;
    } else {
      this.okButton.disabled = true;
    }
  }
};
var PromptManager = class _PromptManager {
  constructor(container) {
    this.container = container;
    this.queue = new Array();
    this.currentPrompt = null;
    this.currentModal = null;
    const holderElement = document.createElement("div");
    holderElement.setAttribute("data-test-id", "prompt-holder");
    holderElement.style.zIndex = "100";
    holderElement.style.position = "absolute";
    holderElement.style.top = "50%";
    holderElement.style.left = "50%";
    holderElement.style.transform = "translate(-50%, -50%)";
    this.promptHolderElement = holderElement;
    this.container.appendChild(this.promptHolderElement);
  }
  static init(container) {
    return new _PromptManager(container);
  }
  dispose() {
    this.promptHolderElement.remove();
  }
  showPrompt(promptState) {
    this.currentPrompt = promptState;
    if ("href" in promptState) {
      const confirmModal = new ConfirmModal(
        "Confirm Navigation",
        `Open ${promptState.href}?`,
        (result) => {
          this.currentPrompt = null;
          this.currentModal = null;
          if (result) {
            let features;
            if (promptState.popup) {
              const popupWidth = 500;
              const popupHeight = 500;
              const screenLeft = window.screenLeft !== void 0 ? window.screenLeft : window.screenX;
              const screenTop = window.screenTop !== void 0 ? window.screenTop : window.screenY;
              const windowWidth = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
              const windowHeight = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;
              const left = (windowWidth - popupWidth) / 2 + screenLeft;
              const top = (windowHeight - popupHeight) / 2 + screenTop;
              features = `toolbar=no,menubar=no,width=${popupWidth},height=${popupHeight},left=${left},top=${top}`;
            }
            const openedWindow = window.open(
              promptState.href,
              promptState.target ?? "_blank",
              features
            );
            promptState.windowCallback(openedWindow);
          }
          this.showNextPromptIfAny();
        }
      );
      this.currentModal = confirmModal;
      this.promptHolderElement.appendChild(confirmModal.element);
    } else {
      const promptModal = new PromptModal(promptState.promptProps, (result) => {
        this.currentPrompt = null;
        this.currentModal = null;
        promptState.resolve(result);
        this.showNextPromptIfAny();
      });
      this.currentModal = promptModal;
      this.promptHolderElement.appendChild(promptModal.element);
      promptModal.focus();
    }
  }
  prompt(promptProps, abortSignal, callback) {
    abortSignal.addEventListener("abort", () => {
      var _a;
      if (this.currentPrompt === promptState) {
        this.currentPrompt = null;
        (_a = this.currentModal) == null ? void 0 : _a.dispose();
        this.showNextPromptIfAny();
      } else {
        this.queue = this.queue.filter((item) => item !== promptState);
      }
    });
    const promptState = {
      promptProps,
      resolve: callback
    };
    if (this.currentPrompt !== null) {
      this.queue.push(promptState);
      return;
    }
    this.showPrompt(promptState);
  }
  link(linkProps, abortSignal, windowCallback) {
    abortSignal.addEventListener("abort", () => {
      var _a;
      if (this.currentPrompt === linkState) {
        this.currentPrompt = null;
        (_a = this.currentModal) == null ? void 0 : _a.dispose();
        this.currentModal = null;
        this.showNextPromptIfAny();
      } else {
        this.queue = this.queue.filter((item) => item !== linkState);
      }
    });
    const linkState = {
      href: linkProps.href,
      target: linkProps.target,
      popup: linkProps.popup ?? false,
      windowCallback
    };
    if (this.currentPrompt !== null) {
      this.queue.push(linkState);
      return;
    }
    this.showPrompt(linkState);
  }
  showNextPromptIfAny() {
    const nextPrompt = this.queue.shift();
    if (nextPrompt !== void 0) {
      this.showPrompt(nextPrompt);
    }
  }
};
var MMLScene = class {
  constructor(element) {
    this.element = element;
    this.colliders = /* @__PURE__ */ new Set();
    this.interactions = /* @__PURE__ */ new Set();
    this.interactionListeners = /* @__PURE__ */ new Set();
    this.chatProbes = /* @__PURE__ */ new Set();
    this.chatProbeListeners = /* @__PURE__ */ new Set();
    this.graphicsAdapter = null;
    this.loadingProgressManager = new LoadingProgressManager();
  }
  init(graphicsAdapter) {
    this.graphicsAdapter = graphicsAdapter;
    this.graphicsAdapter.start();
    this.resizeObserver = new ResizeObserver(() => {
      this.fitContainer();
    });
    this.resizeObserver.observe(this.element);
    this.promptManager = PromptManager.init(this.element);
    const { interactionManager, interactionListener } = InteractionManager.init(
      this.element,
      this.graphicsAdapter.interactionShouldShowDistance.bind(this.graphicsAdapter)
    );
    this.interactionManager = interactionManager;
    this.addInteractionListener(interactionListener);
    this.resizeListener = () => {
      this.fitContainer();
    };
    window.addEventListener("resize", this.resizeListener, false);
    this.fitContainer();
  }
  hasGraphicsAdapter() {
    return this.graphicsAdapter !== null;
  }
  getGraphicsAdapter() {
    if (!this.graphicsAdapter) {
      throw new Error("MMLScene not initialized with a graphics adapter. Call init() first.");
    }
    return this.graphicsAdapter;
  }
  getUserPositionAndRotation() {
    if (!this.graphicsAdapter) {
      throw new Error("MMLScene not initialized with a graphics adapter");
    }
    return this.graphicsAdapter.getUserPositionAndRotation();
  }
  fitContainer() {
    if (!this.graphicsAdapter) {
      throw new Error("MMLScene not initialized with a graphics adapter");
    }
    const width = this.element.clientWidth;
    const height = this.element.clientHeight;
    this.graphicsAdapter.resize(width, height);
  }
  dispose() {
    window.removeEventListener("resize", this.resizeListener);
    this.resizeObserver.disconnect();
    this.promptManager.dispose();
    this.interactionManager.dispose();
  }
  prompt(promptProps, abortSignal, callback) {
    if (!this) {
      console.error("MMLScene not initialized");
      return;
    }
    this.promptManager.prompt(promptProps, abortSignal, callback);
  }
  link(linkProps, abortSignal, windowCallback) {
    this.promptManager.link(linkProps, abortSignal, windowCallback);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addCollider(collider, element) {
    this.colliders.add(collider);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateCollider(collider) {
  }
  removeCollider(collider) {
    this.colliders.delete(collider);
  }
  addInteraction(interaction) {
    this.interactions.add(interaction);
    for (const listener of this.interactionListeners) {
      listener.addInteraction(interaction);
    }
  }
  updateInteraction(interaction) {
    for (const listener of this.interactionListeners) {
      listener.updateInteraction(interaction);
    }
  }
  removeInteraction(interaction) {
    this.interactions.delete(interaction);
    for (const listener of this.interactionListeners) {
      listener.removeInteraction(interaction);
    }
  }
  getInteractions() {
    return this.interactions;
  }
  addInteractionListener(listener, addExistingInteractions = true) {
    this.interactionListeners.add(listener);
    if (addExistingInteractions) {
      for (const interaction of this.interactions) {
        listener.addInteraction(interaction);
      }
    }
  }
  removeInteractionListener(listener) {
    this.interactionListeners.delete(listener);
  }
  addChatProbe(chatProbe) {
    this.chatProbes.add(chatProbe);
    for (const listener of this.chatProbeListeners) {
      listener.addChatProbe(chatProbe);
    }
  }
  updateChatProbe(chatProbe) {
    for (const listener of this.chatProbeListeners) {
      listener.updateChatProbe(chatProbe);
    }
  }
  removeChatProbe(chatProbe) {
    this.chatProbes.delete(chatProbe);
    for (const listener of this.chatProbeListeners) {
      listener.removeChatProbe(chatProbe);
    }
  }
  getLoadingProgressManager() {
    return this.loadingProgressManager;
  }
  getChatProbes() {
    return this.chatProbes;
  }
  addChatProbeListener(listener, addExistingChatProbes = true) {
    this.chatProbeListeners.add(listener);
    if (addExistingChatProbes) {
      for (const chatProbe of this.chatProbes) {
        listener.addChatProbe(chatProbe);
      }
    }
  }
  removeChatProbeListener(listener) {
    this.chatProbeListeners.delete(listener);
  }
};
var FullScreenMMLScene = class extends MMLScene {
  constructor() {
    super(document.createElement("div"));
    this.element = document.createElement("div");
    this.element.style.width = "100%";
    this.element.style.height = "100%";
    this.element.style.position = "relative";
    const loadingProgressManager = this.getLoadingProgressManager();
    this.loadingProgressBar = new LoadingProgressBar(loadingProgressManager);
    this.element.append(this.loadingProgressBar.element);
    this.configureWindowStyling();
  }
  configureWindowStyling() {
    document.documentElement.style.width = "100%";
    document.documentElement.style.height = "100%";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehaviorX = "contain";
    document.documentElement.style.margin = "0";
    const onload = () => {
      document.body.style.margin = "0";
      document.body.style.height = "100%";
    };
    if (document.body) {
      onload();
    } else {
      window.addEventListener("load", () => {
        onload();
      });
    }
  }
  dispose() {
    super.dispose();
    this.element.remove();
  }
};
var AudioGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element) {
  }
};
var ChatProbeGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element) {
  }
};
var CubeGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element) {
  }
};
var CylinderGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element) {
  }
};
var DebugHelperGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(debugHelper) {
  }
};
var FrameGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element) {
  }
};
var ImageGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element, updateMeshCallback) {
  }
};
var InteractionGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element) {
  }
};
var LabelGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element) {
  }
};
var LightGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element) {
  }
};
var LinkGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element) {
  }
};
var MElementGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element) {
  }
};
var ModelGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element, updateMeshCallback) {
  }
};
var PlaneGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element) {
  }
};
var PositionProbeGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element) {
  }
};
var PromptGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element) {
  }
};
var RemoteDocumentGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element) {
  }
};
var SphereGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element) {
  }
};
var TransformableGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element) {
  }
};
var VideoGraphics = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(element, updateMeshCallback) {
  }
};
var IframeWrapper = class _IframeWrapper {
  constructor() {
    this.iframe = document.createElement("iframe");
    this.iframe.style.position = "fixed";
    this.iframe.style.top = "0";
    this.iframe.style.left = "0";
    this.iframe.style.width = "0";
    this.iframe.style.height = "0";
    this.iframe.style.border = "none";
    this.iframe.style.visibility = "hidden";
  }
  static async create() {
    return new Promise((resolve) => {
      const iframeWrapper = new _IframeWrapper();
      document.body.append(iframeWrapper.iframe);
      const ready = iframeWrapper.iframe.contentWindow ? iframeWrapper.iframe.contentWindow.document.readyState === "complete" : false;
      const onLoad = () => {
        const iframe = iframeWrapper.iframe;
        const iframeWindow = iframe.contentWindow;
        resolve({
          iframeWrapper,
          iframeWindow,
          iframeDocument: iframeWindow.document,
          iframeBody: iframeWindow.document.body
        });
      };
      if (ready) {
        setTimeout(() => {
          onLoad();
        });
      } else {
        iframeWrapper.iframe.addEventListener("load", () => {
          onLoad();
        });
      }
    });
  }
  dispose() {
    this.iframe.remove();
  }
};
var MMLNetworkSource = class _MMLNetworkSource {
  constructor(options) {
    this.options = options;
    this.websocket = null;
  }
  static create(options) {
    const mmlNetworkSource = new _MMLNetworkSource(options);
    mmlNetworkSource.init();
    return mmlNetworkSource;
  }
  init() {
    let overriddenHandler = null;
    const eventHandler = (element, event) => {
      if (!overriddenHandler) {
        throw new Error("overriddenHandler not set");
      }
      overriddenHandler(element, event);
    };
    const src = this.options.url;
    this.remoteDocumentWrapper = new RemoteDocumentWrapper(
      src,
      this.options.windowTarget,
      this.options.mmlScene,
      eventHandler
    );
    this.options.targetForWrappers.append(this.remoteDocumentWrapper.remoteDocument);
    let loadingProgressManager;
    if (this.options.mmlScene.getLoadingProgressManager) {
      loadingProgressManager = this.options.mmlScene.getLoadingProgressManager();
    }
    const isWebsocket = src.startsWith("ws://") || src.startsWith("wss://");
    if (isWebsocket) {
      const websocket = new NetworkedDOMWebsocket(
        this.options.url,
        NetworkedDOMWebsocket.createWebSocket,
        this.remoteDocumentWrapper.remoteDocument,
        (time) => {
          this.remoteDocumentWrapper.setDocumentTime(time);
        },
        (status) => {
          if (status === NetworkedDOMWebsocketStatus.Connected) {
            loadingProgressManager == null ? void 0 : loadingProgressManager.setInitialLoad(true);
          }
          this.options.statusUpdated(status);
        },
        {
          tagPrefix: "m-"
        }
      );
      this.websocket = websocket;
      overriddenHandler = (element, event) => {
        websocket.handleEvent(element, event);
      };
    } else {
      fetchRemoteStaticMML(this.options.url).then((remoteDocumentBody) => {
        this.remoteDocumentWrapper.remoteDocument.append(remoteDocumentBody);
        loadingProgressManager == null ? void 0 : loadingProgressManager.setInitialLoad(true);
      }).catch((err) => {
        loadingProgressManager == null ? void 0 : loadingProgressManager.setInitialLoad(err);
      });
      overriddenHandler = () => {
      };
    }
  }
  dispose() {
    if (this.websocket) {
      this.websocket.stop();
      this.websocket = null;
    }
    this.remoteDocumentWrapper.remoteDocument.remove();
  }
};
var StatusUI = class {
  constructor() {
    this.element = document.createElement("div");
    this.element.style.position = "fixed";
    this.element.style.top = "50%";
    this.element.style.left = "50%";
    this.element.style.transform = "translate(-50%, -50%)";
    this.element.style.zIndex = "1000";
    this.element.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    this.element.style.color = "white";
    this.element.style.padding = "1em";
    this.element.style.fontFamily = "sans-serif";
    this.element.style.fontSize = "1.5em";
    this.element.style.fontWeight = "bold";
    this.element.style.pointerEvents = "none";
    this.element.style.display = "none";
    document.body.append(this.element);
  }
  setStatus(text) {
    this.element.textContent = text;
    this.element.style.display = "block";
  }
  setNoStatus() {
    this.element.textContent = "";
    this.element.style.display = "none";
  }
  dispose() {
    this.element.remove();
  }
};
var tagAdapterDefaultTheme = {
  background: "#1D2331",
  brackets: "#D4D2C8",
  tag: "#73D0FF",
  attribute: "#FFD173",
  unrecognizedAttribute: "#FF9800",
  value: "#D5FF80",
  appliedValue: "#B800FF",
  equals: "#FFAD66",
  quote: "#D5FF80"
};
var TagDebugAdapterDebugHelper = class {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(debugHelper) {
  }
  dispose() {
  }
};
function TagDebugAdapterElement(functionToAttribute, additionalFunctions) {
  return (element) => {
    const result = {};
    for (const key in functionToAttribute) {
      const attributeName = functionToAttribute[key];
      result[key] = (val) => {
        var _a;
        (_a = element.getContainer()) == null ? void 0 : _a.setAppliedAttributeValue(attributeName, val);
      };
    }
    return {
      ...result,
      enable: () => {
      },
      disable: () => {
      },
      getCollisionElement() {
        return null;
      },
      dispose: () => {
      },
      ...additionalFunctions
    };
  };
}
var TagDebugAttribute = class {
  constructor(key, value, theme, isObserved) {
    this.key = key;
    this.value = value;
    this.theme = theme;
    this.isObserved = isObserved;
    this.appliedValue = null;
    this.element = document.createElement("span");
    if (!isObserved) {
      this.element.style.borderBottomStyle = "dotted";
      this.element.style.borderWidth = "2px";
      this.element.style.borderColor = this.theme.unrecognizedAttribute;
    }
    const keySpan = document.createElement("span");
    keySpan.textContent = ` ${key}`;
    keySpan.style.color = this.theme.attribute;
    const equalsSpan = document.createElement("span");
    equalsSpan.textContent = "=";
    equalsSpan.style.color = this.theme.equals;
    const quoteSpan = document.createElement("span");
    quoteSpan.textContent = `"`;
    quoteSpan.style.color = this.theme.quote;
    this.valueSpan = document.createElement("span");
    this.valueSpan.textContent = value;
    this.valueSpan.style.color = this.theme.value;
    const endQuoteSpan = document.createElement("span");
    endQuoteSpan.textContent = `"`;
    endQuoteSpan.style.color = this.theme.quote;
    this.appliedValueSpan = document.createElement("span");
    this.appliedValueSpan.className = "no-copy";
    this.appliedValueSpan.style.color = this.theme.appliedValue;
    this.appliedValueSpan.style.display = "none";
    this.element.append(
      keySpan,
      equalsSpan,
      quoteSpan,
      this.valueSpan,
      endQuoteSpan,
      this.appliedValueSpan
    );
  }
  setValue(value) {
    this.value = value;
    if (value === null) {
      this.valueSpan.textContent = "";
      this.appliedValueSpan.style.display = "none";
      if (this.appliedValue !== null) {
        this.appliedValueSpan.style.display = "inline";
      }
      return;
    }
    this.valueSpan.textContent = `${value}`;
    if (this.appliedValue !== null) {
      if (this.appliedValue.asString === value) {
        this.appliedValueSpan.style.display = "none";
      } else {
        this.appliedValueSpan.style.display = "inline";
      }
    }
  }
  setAppliedValue(value) {
    if (value === null) {
      this.appliedValueSpan.style.display = "none";
      this.appliedValue = null;
      return;
    }
    if (typeof value === "object") {
      this.appliedValueSpan.style.display = "inline";
      this.appliedValueSpan.textContent = `\u2588(${value.r}, ${value.g}, ${value.b}${value.a ? `, ${value.a}` : ""})`;
      const average = (value.r + value.g + value.b) / 3;
      this.appliedValueSpan.style.color = `rgb(${value.r * 255}, ${value.g * 255}, ${value.b * 255})`;
      this.appliedValueSpan.style.backgroundColor = average > 0.5 ? "black" : "white";
    } else {
      const asString = value.toString();
      let displayString = asString;
      if (typeof value === "number") {
        const asFixed = value.toFixed(6);
        if (asString.length > asFixed.length) {
          displayString = asFixed;
        }
      }
      this.appliedValue = {
        raw: value,
        asString,
        displayString
      };
      if (this.value !== null) {
        if (this.value === asString) {
          this.appliedValueSpan.style.display = "none";
          return;
        }
      }
      this.appliedValueSpan.style.display = "inline";
      this.appliedValueSpan.textContent = `(${displayString})`;
    }
  }
  hasAppliedValue() {
    return this.appliedValue !== null;
  }
  hasValue() {
    return this.value !== null;
  }
};
var ignoredAttributes = /* @__PURE__ */ new Set(["style"]);
var TagDebugMElement = class _TagDebugMElement {
  constructor(mElement) {
    this.mElement = mElement;
    this.currentParent = null;
    this.attributes = {};
    this.observedAttributes = /* @__PURE__ */ new Set();
    var _a, _b, _c;
    const observedAttributesArray = ((_b = (_a = mElement.__proto__) == null ? void 0 : _a.constructor) == null ? void 0 : _b.observedAttributes) ?? [];
    this.observedAttributes = /* @__PURE__ */ new Set([...observedAttributesArray, "id", "class"]);
    const graphicAdapter = mElement.getScene().getGraphicsAdapter();
    this.theme = graphicAdapter.theme;
    this.container = document.createElement("div");
    this.container.style.fontFamily = "monospace";
    this.container.style.lineHeight = "1.5em";
    const mElementParent = this.mElement.getMElementParent();
    if (mElementParent) {
      this.currentParent = mElementParent.getContainer();
      (_c = this.currentParent) == null ? void 0 : _c.childElementHolder.append(this.container);
      this.indentLevel = this.currentParent.indentLevel + 1;
    } else {
      const scene2 = this.mElement.getScene();
      this.currentParent = scene2;
      scene2.getGraphicsAdapter().getRootContainer().append(this.container);
      this.indentLevel = 0;
    }
    const firstLine = document.createElement("div");
    firstLine.style.textWrap = "nowrap";
    const openingLineBreak = document.createElement("span");
    openingLineBreak.textContent = "\n";
    const openingBracket = document.createElement("span");
    const indent = Array(this.indentLevel * 4).fill(" ").join("");
    openingBracket.textContent = `${indent}<`;
    openingBracket.style.color = this.theme.brackets;
    openingBracket.style.whiteSpace = "pre";
    const openingTag = document.createElement("span");
    openingTag.textContent = mElement.tagName.toLowerCase();
    openingTag.style.color = this.theme.tag;
    this.attributesHolder = document.createElement("span");
    const openingTagEnd = document.createElement("span");
    openingTagEnd.textContent = ">";
    openingTagEnd.style.color = this.theme.brackets;
    firstLine.append(
      openingLineBreak,
      openingBracket,
      openingTag,
      this.attributesHolder,
      openingTagEnd
    );
    this.childElementHolder = document.createElement("div");
    const closingTag = document.createElement("div");
    closingTag.style.textWrap = "nowrap";
    const closingLineBreak = document.createElement("span");
    closingLineBreak.textContent = "\n";
    const closingTagOpeningBracket = document.createElement("span");
    closingTagOpeningBracket.textContent = `${indent}</`;
    closingTagOpeningBracket.style.color = this.theme.brackets;
    closingTagOpeningBracket.style.whiteSpace = "pre";
    const closingTagName = document.createElement("span");
    closingTagName.textContent = mElement.tagName.toLowerCase();
    closingTagName.style.color = this.theme.tag;
    const closingTagEnd = document.createElement("span");
    closingTagEnd.textContent = ">";
    closingTagEnd.style.color = this.theme.brackets;
    closingTag.append(closingLineBreak, closingTagOpeningBracket, closingTagName, closingTagEnd);
    this.container.append(firstLine, this.childElementHolder, closingTag);
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes") {
          const attributeName = mutation.attributeName;
          if (ignoredAttributes.has(attributeName)) {
            return;
          }
          const attributeValue = this.mElement.getAttribute(attributeName);
          const existingAttribute = this.attributes[attributeName];
          if (attributeValue === null) {
            if (existingAttribute) {
              if (!existingAttribute.hasAppliedValue()) {
                existingAttribute.element.remove();
                delete this.attributes[attributeName];
              } else {
                existingAttribute.setValue(null);
              }
            }
          } else {
            if (existingAttribute) {
              existingAttribute.setValue(attributeValue);
            } else {
              this.createAttributeElement(attributeName, attributeValue);
            }
          }
        }
      });
    });
    for (let i = 0; i < mElement.attributes.length; i++) {
      const attribute = mElement.attributes[i];
      if (ignoredAttributes.has(attribute.name)) {
        continue;
      }
      this.createAttributeElement(attribute.name, attribute.value);
    }
    this.mutationObserver.observe(mElement, { attributes: true });
  }
  createAttributeElement(attributeName, value) {
    const newAttribute = new TagDebugAttribute(
      attributeName,
      value,
      this.theme,
      this.observedAttributes.has(attributeName)
    );
    this.attributes[attributeName] = newAttribute;
    this.attributesHolder.append(newAttribute.element);
    return newAttribute;
  }
  setAppliedAttributeValue(attributeName, value) {
    const existingAttribute = this.attributes[attributeName];
    if (existingAttribute) {
      existingAttribute.setAppliedValue(value);
      if (value === null && !existingAttribute.hasValue()) {
        existingAttribute.element.remove();
        delete this.attributes[attributeName];
      }
    } else if (value !== null) {
      const newAttribute = this.createAttributeElement(attributeName, null);
      newAttribute.setAppliedValue(value);
    }
  }
  getContainer() {
    return this;
  }
  dispose() {
    this.mutationObserver.disconnect();
    if (this.currentParent === null) {
      throw new Error("Was not connected to a parent");
    }
    if (this.currentParent instanceof _TagDebugMElement) {
      this.currentParent.childElementHolder.removeChild(this.container);
      this.currentParent = null;
    } else {
      this.currentParent.getGraphicsAdapter().getRootContainer().removeChild(
        this.container
      );
      this.currentParent = null;
    }
  }
};
var TagDebugAdapterGraphicsInterface = {
  MElementGraphicsInterface: (element) => new TagDebugMElement(element),
  MMLDebugHelperGraphicsInterface: (debugHelper) => new TagDebugAdapterDebugHelper(debugHelper),
  MMLCubeGraphicsInterface: TagDebugAdapterElement(
    {
      setWidth: "width",
      setHeight: "height",
      setDepth: "depth",
      setCastShadows: "cast-shadows",
      setColor: "color",
      setOpacity: "opacity"
    },
    {}
  ),
  MMLSphereGraphicsInterface: TagDebugAdapterElement(
    {
      setRadius: "radius",
      setCastShadows: "cast-shadows",
      setColor: "color",
      setOpacity: "opacity"
    },
    {}
  ),
  MMLPlaneGraphicsInterface: TagDebugAdapterElement(
    {
      setWidth: "width",
      setHeight: "height",
      setCastShadows: "cast-shadows",
      setColor: "color",
      setOpacity: "opacity"
    },
    {}
  ),
  MMLImageGraphicsInterface: TagDebugAdapterElement(
    {
      setSrc: "src",
      setWidth: "width",
      setHeight: "height",
      setEmissive: "emissive",
      setCastShadows: "cast-shadows",
      setOpacity: "opacity"
    },
    {
      getWidthAndHeight: () => ({ width: 0, height: 0 })
    }
  ),
  MMLAudioGraphicsInterface: TagDebugAdapterElement(
    {
      setSrc: "src",
      setEnabled: "enabled",
      setLoop: "loop",
      setLoopDuration: "loop-duration",
      setVolume: "volume",
      setStartTime: "start-time",
      setPauseTime: "pause-time",
      setConeAngle: "cone-angle",
      setConeFalloffAngle: "cone-falloff-angle",
      setDebug: "debug"
    },
    {
      syncAudioTime: () => {
      }
    }
  ),
  MMLCylinderGraphicsInterface: TagDebugAdapterElement(
    {
      setRadius: "radius",
      setHeight: "height",
      setCastShadows: "cast-shadows",
      setColor: "color",
      setOpacity: "opacity"
    },
    {}
  ),
  MMLTransformableGraphicsInterface: TagDebugAdapterElement(
    {
      setX: "x",
      setY: "y",
      setZ: "z",
      setRotationX: "rx",
      setRotationY: "ry",
      setRotationZ: "rz",
      setScaleX: "sx",
      setScaleY: "sy",
      setScaleZ: "sz",
      setVisible: "visible",
      setSocket: "socket"
    },
    {
      getWorldMatrix: () => {
        return new Matr4();
      }
    }
  ),
  RemoteDocumentGraphicsInterface: TagDebugAdapterElement(
    {},
    {
      showError() {
      },
      dispose() {
      }
    }
  ),
  MMLLightGraphicsInterface: TagDebugAdapterElement(
    {
      setEnabled: "enabled",
      setDebug: "debug",
      setCastShadows: "cast-shadows",
      setAngle: "angle",
      setIntensity: "intensity",
      setDistance: "distance",
      setType: "type",
      setColor: "color"
    },
    {}
  ),
  MMLLinkGraphicsInterface: TagDebugAdapterElement(
    {
      setHref: "href",
      setTarget: "target"
    },
    {}
  ),
  MMLModelGraphicsInterface: TagDebugAdapterElement(
    {
      setSrc: "src",
      setDebug: "debug",
      setCastShadows: "cast-shadows",
      setAnim: "anim",
      setAnimEnabled: "anim-enabled",
      setAnimStartTime: "anim-start-time",
      setAnimPauseTime: "anim-pause-time",
      setAnimLoop: "anim-loop"
    },
    {
      getBoundingBox: () => ({
        centerOffset: { x: 0, y: 0, z: 0 },
        size: { x: 0, y: 0, z: 0 }
      }),
      hasLoadedAnimation: () => false,
      hasLoadedModel: () => false,
      transformed: () => false
    }
  ),
  MMLVideoGraphicsInterface: TagDebugAdapterElement(
    {
      setSrc: "src",
      setWidth: "width",
      setHeight: "height",
      setEnabled: "enabled",
      setCastShadows: "cast-shadows",
      setLoop: "loop",
      setVolume: "volume",
      setEmissive: "emissive",
      setStartTime: "start-time",
      setPauseTime: "pause-time"
    },
    {
      syncVideoTime: () => {
      },
      getWidthAndHeight: () => ({ width: 0, height: 0 })
    }
  ),
  MMLFrameGraphicsInterface: TagDebugAdapterElement(
    {
      setSrc: "src",
      setDebug: "debug",
      setLoadRange: "load-range",
      setUnloadRange: "unload-range",
      setMinX: "min-x",
      setMaxX: "max-x",
      setMinY: "min-y",
      setMaxY: "max-y",
      setMinZ: "min-z",
      setMaxZ: "max-z"
    },
    {}
  ),
  MMLLabelGraphicsInterface: TagDebugAdapterElement(
    {
      setContent: "content",
      setFontSize: "font-size",
      setAlignment: "alignment",
      setPadding: "padding",
      setColor: "color",
      setFontColor: "font-color",
      setEmissive: "emissive",
      setWidth: "width",
      setHeight: "height",
      setCastShadows: "cast-shadows"
    },
    {}
  ),
  MMLPromptGraphicsInterface: TagDebugAdapterElement(
    {
      setMessage: "message",
      setPlaceholder: "placeholder",
      setPrefill: "prefill",
      setDebug: "debug"
    },
    {}
  ),
  MMLInteractionGraphicsInterface: TagDebugAdapterElement(
    {
      setRange: "range",
      setInFocus: "in-focus",
      setLineOfSight: "line-of-sight",
      setPriority: "priority",
      setPrompt: "prompt",
      setDebug: "debug"
    },
    {}
  ),
  MMLChatProbeGraphicsInterface: TagDebugAdapterElement(
    {
      setRange: "range",
      setDebug: "debug"
    },
    {}
  ),
  MMLPositionProbeGraphicsInterface: TagDebugAdapterElement(
    {
      setRange: "range",
      setDebug: "debug"
    },
    {}
  )
};
var StandaloneTagDebugAdapter = class _StandaloneTagDebugAdapter {
  constructor(element) {
    this.element = element;
    this.theme = tagAdapterDefaultTheme;
    this.element.style.background = this.theme.background;
    element.addEventListener("copy", function(e) {
      var _a;
      e.preventDefault();
      const selection = window.getSelection();
      if (selection) {
        const range = selection.getRangeAt(0);
        const div = document.createElement("div");
        div.appendChild(range.cloneContents());
        const noCopyElements = div.querySelectorAll(".no-copy");
        noCopyElements.forEach((element2) => element2.remove());
        const asText = div.textContent;
        if (asText) {
          (_a = e.clipboardData) == null ? void 0 : _a.setData("text/plain", asText);
        }
      }
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interactionShouldShowDistance(interaction) {
    return null;
  }
  getGraphicsAdapterFactory() {
    return TagDebugAdapterGraphicsInterface;
  }
  static async create(element) {
    element.style.overflow = "auto";
    const adapter = new _StandaloneTagDebugAdapter(element);
    await adapter.init();
    return adapter;
  }
  async init() {
    return Promise.resolve();
  }
  start() {
  }
  getUserPositionAndRotation() {
    return {
      position: {
        x: 0,
        y: 0,
        z: 0
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0
      }
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resize(width, height) {
  }
  dispose() {
  }
  getRootContainer() {
    return this.element;
  }
};
function calculateContentSize(opts) {
  if (opts.content) {
    const height = opts.height;
    const width = opts.width;
    const loadedWidth = Math.max(opts.content.width, 1);
    const loadedHeight = Math.max(opts.content.height, 1);
    if (height && width) {
      return { width, height };
    } else if (height && !width) {
      return {
        // compute width from height and content aspect ratio
        width: height * loadedWidth / loadedHeight,
        height
      };
    } else if (!height && width) {
      return {
        width,
        // compute height from width and content aspect ratio
        height: width * loadedHeight / loadedWidth
      };
    } else {
      return {
        width: 1,
        // compute height from content aspect ratio
        height: loadedHeight / loadedWidth
      };
    }
  } else {
    return {
      width: opts.width !== null ? opts.width : 1,
      height: opts.height !== null ? opts.height : 1
    };
  }
}
var StaticFileVideoSource = class {
  constructor(srcURL, videoTag, videoSourceProps, getDocumentTime) {
    this.srcURL = srcURL;
    this.videoTag = videoTag;
    this.videoSourceProps = videoSourceProps;
    this.getDocumentTime = getDocumentTime;
    this.delayedStartTimer = null;
    this.delayedPauseTimer = null;
    this.shouldBePaused = false;
    this.pauseListener = () => {
      if (this.shouldBePaused) {
        return;
      }
      if (this.videoSourceProps) {
        this.syncVideoSource(this.videoSourceProps);
      }
    };
    videoTag.addEventListener("pause", this.pauseListener);
    try {
      videoTag.src = srcURL.toString();
    } catch (e) {
      console.error("src failed to switch", e);
    }
  }
  getContentAddress() {
    return this.srcURL.toString();
  }
  dispose() {
    this.videoTag.removeEventListener("pause", this.pauseListener);
    this.videoTag.src = "";
    if (this.delayedPauseTimer !== null) {
      clearTimeout(this.delayedPauseTimer);
      this.delayedPauseTimer = null;
    }
    if (this.delayedStartTimer !== null) {
      clearTimeout(this.delayedStartTimer);
      this.delayedStartTimer = null;
    }
  }
  syncVideoSource(props) {
    const documentTimeMilliseconds = this.getDocumentTime();
    this.videoSourceProps = props;
    if (this.delayedStartTimer) {
      clearTimeout(this.delayedStartTimer);
      this.delayedStartTimer = null;
    }
    if (this.delayedPauseTimer !== null) {
      clearTimeout(this.delayedPauseTimer);
      this.delayedPauseTimer = null;
    }
    const startTimeMilliseconds = props.startTime ? props.startTime : 0;
    const pauseTimeMilliseconds = props.pauseTime;
    if (pauseTimeMilliseconds !== null) {
      if (documentTimeMilliseconds !== null && pauseTimeMilliseconds > documentTimeMilliseconds) {
        const delayedPauseTimer = setTimeout(() => {
          if (this.delayedPauseTimer === delayedPauseTimer) {
            this.delayedPauseTimer = null;
          }
          this.syncVideoSource(this.videoSourceProps);
        }, pauseTimeMilliseconds - documentTimeMilliseconds);
        this.delayedPauseTimer = delayedPauseTimer;
      } else {
        let totalPlaybackTimeSeconds = (pauseTimeMilliseconds - startTimeMilliseconds) / 1e3;
        if (totalPlaybackTimeSeconds < 0) {
          totalPlaybackTimeSeconds = 0;
        }
        if (props.loop) {
          totalPlaybackTimeSeconds = totalPlaybackTimeSeconds % this.videoTag.duration;
        } else if (totalPlaybackTimeSeconds > this.videoTag.duration) {
          totalPlaybackTimeSeconds = this.videoTag.duration;
        }
        this.shouldBePaused = true;
        this.videoTag.pause();
        this.videoTag.currentTime = totalPlaybackTimeSeconds;
        return;
      }
    }
    let currentTimeSeconds = 0;
    if (documentTimeMilliseconds) {
      currentTimeSeconds = (documentTimeMilliseconds - startTimeMilliseconds) / 1e3;
    } else {
      currentTimeSeconds = startTimeMilliseconds / 1e3;
    }
    let desiredVideoTimeSeconds;
    if (currentTimeSeconds < 0) {
      this.videoTag.currentTime = 0;
      this.shouldBePaused = true;
      this.videoTag.pause();
      const delayedStartTimer = setTimeout(() => {
        if (this.delayedStartTimer === delayedStartTimer) {
          this.delayedStartTimer = null;
        }
        this.syncVideoSource(this.videoSourceProps);
      }, -currentTimeSeconds * 1e3);
      this.delayedStartTimer = delayedStartTimer;
      return;
    } else if (props.loop) {
      desiredVideoTimeSeconds = currentTimeSeconds % this.videoTag.duration;
    } else {
      desiredVideoTimeSeconds = currentTimeSeconds;
    }
    let delta = desiredVideoTimeSeconds - this.videoTag.currentTime;
    if (props.loop) {
      const loopedDelta = delta - this.videoTag.duration;
      if (Math.abs(delta) > Math.abs(loopedDelta)) {
        delta = loopedDelta;
      }
    }
    if (Math.abs(delta) < 0.1) {
      this.videoTag.playbackRate = 1;
    } else if (Math.abs(delta) > 0.5) {
      this.videoTag.currentTime = desiredVideoTimeSeconds;
      this.videoTag.playbackRate = 1;
    } else {
      if (delta > 0) {
        this.videoTag.playbackRate = 1.02;
      } else {
        this.videoTag.playbackRate = 0.98;
      }
    }
    if (desiredVideoTimeSeconds >= this.videoTag.duration) {
      this.shouldBePaused = true;
      this.videoTag.pause();
      return;
    } else {
      this.shouldBePaused = false;
      if (this.videoTag.paused) {
        this.videoTag.play().catch((e) => {
          console.error("failed to play", e);
        });
      }
      return;
    }
  }
};
async function negotiateConnectionWithClientOffer(peerConnection, endpoint) {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  const ofr = await waitToCompleteICEGathering(peerConnection);
  if (!ofr) {
    throw Error("failed to gather ICE candidates for offer");
  }
  while (peerConnection.connectionState !== "closed") {
    const response = await postSDPOffer(endpoint, ofr.sdp);
    if (response.status === 201) {
      const answerSDP = await response.text();
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: "answer", sdp: answerSDP })
      );
      return response.headers.get("Location");
    } else if (response.status === 405) {
      console.log("Remember to update the URL passed into the WHIP or WHEP client");
    } else {
      const errorMessage = await response.text();
      console.error("WHEP error in negotiation response", errorMessage);
    }
    await new Promise((r) => setTimeout(r, 5e3));
  }
}
async function postSDPOffer(endpoint, data) {
  return await fetch(endpoint, {
    method: "POST",
    mode: "cors",
    headers: {
      "content-type": "application/sdp"
    },
    body: data
  });
}
async function waitToCompleteICEGathering(peerConnection) {
  return new Promise((resolve) => {
    setTimeout(function() {
      resolve(peerConnection.localDescription);
    }, 1e3);
    peerConnection.onicegatheringstatechange = () => peerConnection.iceGatheringState === "complete" && resolve(peerConnection.localDescription);
  });
}
var WHEPVideoSource = class {
  constructor(srcURL, videoTag) {
    this.srcURL = srcURL;
    this.videoTag = videoTag;
    const endpoint = new URL(srcURL);
    endpoint.protocol = "https:";
    this.stream = new MediaStream();
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.cloudflare.com:3478"
        }
      ],
      bundlePolicy: "max-bundle"
    });
    this.peerConnection.addTransceiver("video", {
      direction: "recvonly"
    });
    this.peerConnection.addTransceiver("audio", {
      direction: "recvonly"
    });
    this.peerConnection.ontrack = (event) => {
      const track = event.track;
      const currentTracks = this.stream.getTracks();
      const streamAlreadyHasVideoTrack = currentTracks.some((track2) => track2.kind === "video");
      const streamAlreadyHasAudioTrack = currentTracks.some((track2) => track2.kind === "audio");
      switch (track.kind) {
        case "video":
          if (streamAlreadyHasVideoTrack) {
            break;
          }
          this.stream.addTrack(track);
          break;
        case "audio":
          if (streamAlreadyHasAudioTrack) {
            break;
          }
          this.stream.addTrack(track);
          break;
        default:
          console.warn("got unknown track " + track);
      }
    };
    this.peerConnection.addEventListener("connectionstatechange", () => {
      if (this.peerConnection.connectionState !== "connected") {
        return;
      }
      this.videoTag.srcObject = this.stream;
    });
    this.peerConnection.addEventListener("negotiationneeded", async () => {
      try {
        await negotiateConnectionWithClientOffer(this.peerConnection, endpoint.toString());
      } catch (err) {
        console.error("Failed to negotiate with WHEP endpoint", err);
      }
    });
  }
  getContentAddress() {
    return this.srcURL.toString();
  }
  dispose() {
    this.peerConnection.close();
    this.videoTag.srcObject = null;
  }
  syncVideoSource() {
    this.videoTag.play().catch((err) => {
      console.error("play error", err);
    });
  }
  static isWHEPURL(url) {
    return url.protocol === "whep:";
  }
};

// src/ui/fields.ts
var sourceGroup = {
  name: "source",
  label: "Source"
};
var rendererGroup = {
  name: "renderer",
  label: "Renderer"
};
var environmentGroup = {
  name: "environment",
  label: "Environment"
};
var cameraGroup = {
  name: "camera",
  label: "Camera"
};
var lightGroup = {
  name: "light",
  label: "Light"
};
var allGroups = [sourceGroup, rendererGroup, cameraGroup, lightGroup, environmentGroup];
var cameraModeField = {
  name: "cameraMode",
  label: "Camera Mode",
  type: "string",
  options: ["orbit", "drag-fly", "none"],
  defaultValue: "drag-fly",
  groupDefinition: cameraGroup
};
var cameraOrbitSpeedField = {
  name: "cameraOrbitSpeed",
  label: "Camera Orbit Speed (degrees per second)",
  type: "number",
  defaultValue: 10,
  groupDefinition: cameraGroup
};
var cameraOrbitDistanceField = {
  name: "cameraOrbitDistance",
  label: "Camera Orbit Distance",
  type: "number",
  defaultValue: 10,
  groupDefinition: cameraGroup
};
var cameraOrbitPitchField = {
  name: "cameraOrbitPitch",
  label: "Camera Orbit Pitch",
  type: "number",
  defaultValue: 60,
  groupDefinition: cameraGroup
};
var cameraFitContents = {
  name: "cameraFitContents",
  label: "Camera Fit Contents",
  type: "string",
  options: ["true", "false"],
  defaultValue: "false",
  groupDefinition: cameraGroup
};
var cameraLookAtField = {
  name: "cameraLookAt",
  label: "Camera Look At",
  type: "x,y,z",
  defaultValue: "0,0,0",
  groupDefinition: cameraGroup
};
var cameraPositionField = {
  name: "cameraPosition",
  label: "Camera Position",
  type: "x,y,z",
  defaultValue: "0,5,10",
  groupDefinition: cameraGroup
};
var cameraFovField = {
  name: "cameraFov",
  label: "Camera FOV",
  type: "number",
  defaultValue: 75,
  groupDefinition: cameraGroup
};
var urlField = {
  name: "url",
  label: "URL",
  type: "string",
  defaultValue: "",
  requireSubmission: true,
  groupDefinition: sourceGroup
};
var rendererField = {
  name: "renderer",
  label: "Renderer",
  type: "string",
  options: ["threejs", "playcanvas", "tags"],
  defaultValue: "threejs",
  groupDefinition: rendererGroup
};
var backgroundColorField = {
  name: "backgroundColor",
  label: "Background Color",
  type: "color",
  defaultValue: "rgba(255, 255, 255, 0)",
  groupDefinition: rendererGroup
};
var environmentMapField = {
  name: "environmentMap",
  label: "Environment Map",
  type: "string",
  defaultValue: "",
  requireSubmission: true,
  groupDefinition: environmentGroup
};
var ambientLightField = {
  name: "ambientLight",
  label: "Ambient Light",
  type: "number",
  defaultValue: 0,
  groupDefinition: lightGroup
};
var ambientLightColorField = {
  name: "ambientLightColor",
  label: "Ambient Light Color",
  type: "color",
  defaultValue: "white",
  groupDefinition: lightGroup
};
var allFields = [
  cameraModeField,
  cameraFitContents,
  cameraLookAtField,
  cameraOrbitDistanceField,
  cameraOrbitPitchField,
  cameraOrbitSpeedField,
  cameraPositionField,
  cameraFovField,
  environmentMapField,
  urlField,
  rendererField,
  backgroundColorField,
  ambientLightField,
  ambientLightColorField
];

// src/setDebugGlobals.ts
function setDebugGlobals({
  mmlScene,
  remoteDocumentWrapper
}) {
  window["mml-web-client"] = {
    mmlScene,
    remoteDocumentWrapper
  };
}

export {
  NetworkedDOMWebsocketStatus,
  NetworkedDOMWebsocketStatusToString,
  parseColorAttribute,
  parseBoolAttribute,
  MELEMENT_PROPERTY_NAME,
  MElement,
  Quat,
  Vect3,
  Matr4,
  CanvasText,
  radToDeg,
  TransformableElement,
  Audio,
  Model,
  getRelativePositionAndRotationRelativeToObject,
  LoadingInstanceManager,
  Image,
  LightTypes,
  registerCustomElementsToWindow,
  EventHandlerCollection,
  FullScreenMMLScene,
  AudioGraphics,
  ChatProbeGraphics,
  CubeGraphics,
  CylinderGraphics,
  DebugHelperGraphics,
  FrameGraphics,
  ImageGraphics,
  InteractionGraphics,
  LabelGraphics,
  LightGraphics,
  LinkGraphics,
  MElementGraphics,
  ModelGraphics,
  PlaneGraphics,
  PositionProbeGraphics,
  PromptGraphics,
  RemoteDocumentGraphics,
  SphereGraphics,
  TransformableGraphics,
  VideoGraphics,
  IframeWrapper,
  MMLNetworkSource,
  StatusUI,
  StandaloneTagDebugAdapter,
  calculateContentSize,
  StaticFileVideoSource,
  WHEPVideoSource,
  allGroups,
  cameraModeField,
  cameraOrbitSpeedField,
  cameraOrbitDistanceField,
  cameraOrbitPitchField,
  cameraFitContents,
  cameraLookAtField,
  cameraPositionField,
  cameraFovField,
  urlField,
  rendererField,
  backgroundColorField,
  environmentMapField,
  ambientLightField,
  ambientLightColorField,
  allFields,
  setDebugGlobals
};
//# sourceMappingURL=chunk-3H5JB4GP.js.map
