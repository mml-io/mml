import {
  FullScreenMMLScene,
  IframeWrapper,
  MMLSource,
  StandaloneTagDebugAdapter,
  StatusElement,
  createFullscreenDiv,
  parseBoolAttribute,
  registerCustomElementsToWindow,
  rendererField,
  urlField
} from "./chunk-K52IE2F4.js";

// src/ui/setUrlParam.ts
function setUrlParam(name, value) {
  const params = new URLSearchParams(window.location.search);
  if (value === "" || value === null) {
    params.delete(name);
  } else {
    params.set(name, value);
  }
  window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

// src/ui/shared-styles.module.css
var shared_styles_default = {
  "button": "shared-styles-module__button_Y_AOrq__0181",
  "header": "shared-styles-module__header_Y_AOrq__0181"
};

// src/ui/UIElement.ts
var UIElement = class {
  constructor() {
    this.element = document.createElement("div");
  }
  dispose() {
  }
};

// src/ui/UIField.module.css
var UIField_default = {
  "label": "UIField-module__label_lh-KDa__0181",
  "labelFocused": "UIField-module__label-focused_lh-KDa__0181",
  "selectInput": "UIField-module__select-input_lh-KDa__0181",
  "submitButton": "UIField-module__submit-button_lh-KDa__0181",
  "textInput": "UIField-module__text-input_lh-KDa__0181",
  "uiField": "UIField-module__ui-field_lh-KDa__0181"
};

// src/ui/UIField.ts
var UIField = class extends UIElement {
  constructor(fieldDefinition, group) {
    super();
    this.fieldDefinition = fieldDefinition;
    this.group = group;
    this.element.className = UIField_default.uiField;
    this.label = document.createElement("label");
    this.label.className = UIField_default.label;
    this.label.textContent = fieldDefinition.label;
    this.element.append(this.label);
    if (fieldDefinition.options) {
      const selectElement = document.createElement("select");
      this.selectElement = selectElement;
      this.selectElement.className = UIField_default.selectInput;
      const unsetOption = document.createElement("option");
      unsetOption.textContent = "Unset (default: " + fieldDefinition.defaultValue + ")";
      unsetOption.value = "";
      this.selectElement.append(unsetOption);
      this.element.append(this.selectElement);
      for (const option of fieldDefinition.options) {
        const optionElement = document.createElement("option");
        optionElement.textContent = option;
        this.selectElement.append(optionElement);
      }
      if (fieldDefinition.requireSubmission) {
        this.submitButton = document.createElement("button");
        this.submitButton.classList.add(shared_styles_default.button, UIField_default.submitButton);
        this.submitButton.textContent = "Submit";
        this.submitButton.addEventListener("click", () => {
          this.onChange(selectElement.value);
        });
        this.element.append(this.submitButton);
      } else {
        this.selectElement.addEventListener("change", () => {
          this.onChange(selectElement.value);
        });
      }
    } else {
      const input = document.createElement("input");
      this.input = input;
      this.input.className = UIField_default.textInput;
      this.input.placeholder = `Default: ${fieldDefinition.defaultValue.toString()}`;
      this.input.addEventListener("focus", () => {
        this.label.classList.add(UIField_default.labelFocused);
      });
      this.input.addEventListener("blur", () => {
        this.label.classList.remove(UIField_default.labelFocused);
      });
      this.input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          this.onChange(input.value);
        }
      });
      if (fieldDefinition.type === "number") {
        this.input.step = "0.01";
        this.input.type = "number";
      } else if (fieldDefinition.type === "color") {
        this.input.type = "text";
      } else {
        this.input.type = "text";
      }
      this.element.append(this.input);
      if (fieldDefinition.requireSubmission) {
        this.submitButton = document.createElement("button");
        this.submitButton.classList.add(shared_styles_default.button, UIField_default.submitButton);
        this.submitButton.textContent = "Submit";
        this.submitButton.addEventListener("click", () => {
          if (this.input) {
            this.onChange(this.input.value);
          } else if (this.selectElement) {
            this.onChange(this.selectElement.value);
          }
        });
        this.element.append(this.submitButton);
      } else {
        if (this.input) {
          const input2 = this.input;
          this.input.addEventListener("input", () => {
            this.onChange(input2.value);
          });
        } else if (this.selectElement) {
          const selectElement = this.selectElement;
          this.selectElement.addEventListener("change", () => {
            this.onChange(selectElement.value);
          });
        }
      }
    }
    const params = new URLSearchParams(window.location.search);
    const value = params.get(fieldDefinition.name);
    if (value) {
      this.setValue(value);
    }
  }
  setValue(value) {
    if (this.selectElement) {
      this.selectElement.value = value;
    } else if (this.input) {
      this.input.value = value;
    }
  }
  onChange(value) {
    setUrlParam(this.fieldDefinition.name, value);
  }
};

// src/ui/UIGroup.module.css
var UIGroup_default = {
  "uiGroup": "UIGroup-module__ui-group_WUqfdq__0181"
};

// src/ui/UIGroup.ts
var UIGroup = class {
  constructor(groupDefinition) {
    this.groupDefinition = groupDefinition;
    this.element = document.createElement("div");
    this.elements = new Array();
    this.element.className = UIGroup_default.uiGroup;
    this.header = document.createElement("div");
    this.header.className = shared_styles_default.header;
    this.header.textContent = groupDefinition.label;
    this.element.append(this.header);
  }
  addElement(element) {
    if (this.elements.includes(element)) {
      return;
    }
    this.elements.push(element);
    this.element.append(element.element);
  }
  removeElement(element) {
    const index = this.elements.indexOf(element);
    if (index === -1) {
      return;
    }
    this.elements.splice(index, 1);
  }
  dispose() {
    for (const element of this.elements) {
      element.dispose();
    }
    this.elements = [];
  }
  isEmpty() {
    return this.elements.length === 0;
  }
};

// src/FormIteration.ts
var FormIteration = class {
  constructor(queryParamState, viewerUI, previousFormIteration) {
    this.queryParamState = queryParamState;
    this.viewerUI = viewerUI;
    this.unmatchedFields = /* @__PURE__ */ new Map();
    this.fields = /* @__PURE__ */ new Map();
    this.groups = /* @__PURE__ */ new Map();
    if (previousFormIteration) {
      this.unmatchedFields = new Map(previousFormIteration.fields);
      this.fields = new Map(previousFormIteration.fields);
    }
  }
  getFieldValue(fieldDefinition) {
    const unmatchedField = this.unmatchedFields.get(fieldDefinition);
    if (unmatchedField) {
      const uiGroup = unmatchedField.group;
      this.groups.set(uiGroup.groupDefinition, uiGroup);
      this.unmatchedFields.delete(fieldDefinition);
    }
    let field = this.fields.get(fieldDefinition);
    if (!field) {
      const groupDefinition = fieldDefinition.groupDefinition;
      let uiGroup = this.groups.get(groupDefinition);
      if (!uiGroup) {
        uiGroup = new UIGroup(groupDefinition);
        this.groups.set(groupDefinition, uiGroup);
        this.viewerUI.addGroup(uiGroup);
      }
      field = new UIField(fieldDefinition, uiGroup);
      uiGroup.addElement(field);
      this.fields.set(fieldDefinition, field);
    }
    const readValue = this.queryParamState.read(fieldDefinition.name);
    if (readValue !== null) {
      field.setValue(readValue);
      return readValue;
    }
    return fieldDefinition.defaultValue.toString();
  }
  clearUnmatchedFields() {
    for (const field of this.unmatchedFields.values()) {
      field.dispose();
      field.element.remove();
      const group = field.group;
      group.removeElement(field);
      if (group.isEmpty()) {
        group.dispose();
        this.viewerUI.removeGroup(group);
        this.groups.delete(group.groupDefinition);
      }
      this.fields.delete(field.fieldDefinition);
    }
    this.unmatchedFields.clear();
  }
  completed() {
    this.clearUnmatchedFields();
    this.viewerUI.showUnusedParams(Array.from(this.queryParamState.getUnusedParams()));
  }
};

// src/PlayCanvasMode.ts
var PlayCanvasMode = class {
  constructor(windowTarget, targetForWrappers, mmlSource, formIteration) {
    this.windowTarget = windowTarget;
    this.targetForWrappers = targetForWrappers;
    this.mmlSource = mmlSource;
    this.formIteration = formIteration;
    this.disposed = false;
    this.internalMode = null;
    this.type = "playcanvas";
    this.init();
  }
  async init() {
    this.internalMode = await (async () => {
      const { PlayCanvasModeInternal } = await import("./PlayCanvasModeInternal-DPFJCYHK.js");
      return new PlayCanvasModeInternal(
        this.windowTarget,
        this.targetForWrappers,
        this.mmlSource,
        this.formIteration
      );
    })();
    if (this.disposed) {
      this.dispose();
      return;
    }
  }
  dispose() {
    this.disposed = true;
    if (this.internalMode) {
      this.internalMode.dispose();
    }
  }
  update(formIteration) {
    this.formIteration = formIteration;
    if (!this.internalMode) {
      return;
    }
    this.internalMode.update(formIteration);
  }
};

// src/QueryParamState.ts
var QueryParamState = class _QueryParamState {
  constructor(arg = /* @__PURE__ */ new Map()) {
    this.params = /* @__PURE__ */ new Map();
    this.usedParams = /* @__PURE__ */ new Set();
    if (typeof arg === "string") {
      this.params = new Map(new URLSearchParams(arg));
    } else {
      this.params = new Map(arg);
    }
  }
  cloneWithAdditionalParams(params) {
    const newParams = new Map(this.params);
    params.forEach((value, key) => {
      newParams.set(key, value);
    });
    return new _QueryParamState(newParams);
  }
  read(key) {
    this.usedParams.add(key);
    return this.params.get(key) ?? null;
  }
  getUnusedParams() {
    const unusedParams = new Set(this.params.keys());
    this.usedParams.forEach((key) => {
      unusedParams.delete(key);
    });
    return unusedParams;
  }
  toString() {
    const searchParams = new URLSearchParams();
    this.params.forEach((value, key) => {
      searchParams.set(key, value);
    });
    return searchParams.toString();
  }
};

// src/TagsMode.ts
var TagsMode = class {
  constructor(windowTarget, targetForWrappers, mmlSourceDefinition, formIteration) {
    this.windowTarget = windowTarget;
    this.targetForWrappers = targetForWrappers;
    this.mmlSourceDefinition = mmlSourceDefinition;
    this.formIteration = formIteration;
    this.disposed = false;
    this.loadedState = null;
    this.type = "tags";
    this.element = createFullscreenDiv();
    this.init();
  }
  async init() {
    const graphicsAdapter = await StandaloneTagDebugAdapter.create(this.element);
    if (this.disposed) {
      graphicsAdapter.dispose();
      return;
    }
    const fullScreenMMLScene = new FullScreenMMLScene(this.element);
    fullScreenMMLScene.init(graphicsAdapter);
    const statusElement = new StatusElement();
    const mmlSource = MMLSource.create({
      fullScreenMMLScene,
      statusElement,
      source: this.mmlSourceDefinition,
      windowTarget: this.windowTarget,
      targetForWrappers: this.targetForWrappers
    });
    this.loadedState = {
      mmlSource,
      graphicsAdapter,
      fullScreenMMLScene,
      statusElement
    };
    this.update(this.formIteration);
  }
  dispose() {
    this.disposed = true;
    if (this.loadedState) {
      this.loadedState.mmlSource.dispose();
      this.loadedState.graphicsAdapter.dispose();
      this.loadedState.fullScreenMMLScene.dispose();
      this.loadedState.statusElement.dispose();
      this.loadedState = null;
    }
    this.element.remove();
  }
  update(formIteration) {
    formIteration.completed();
  }
};

// src/ThreeJSMode.ts
var ThreeJSMode = class {
  constructor(windowTarget, targetForWrappers, mmlSource, formIteration) {
    this.windowTarget = windowTarget;
    this.targetForWrappers = targetForWrappers;
    this.mmlSource = mmlSource;
    this.formIteration = formIteration;
    this.disposed = false;
    this.internalMode = null;
    this.type = "threejs";
    this.init();
  }
  async init() {
    this.internalMode = await (async () => {
      const { ThreeJSModeInternal } = await import("./ThreeJSModeInternal-UJH5L4W4.js");
      return new ThreeJSModeInternal(
        this.windowTarget,
        this.targetForWrappers,
        this.mmlSource,
        this.formIteration
      );
    })();
    if (this.disposed) {
      this.dispose();
      return;
    }
  }
  dispose() {
    this.disposed = true;
    if (this.internalMode) {
      this.internalMode.dispose();
    }
  }
  update(formIteration) {
    this.formIteration = formIteration;
    if (!this.internalMode) {
      return;
    }
    this.internalMode.update(formIteration);
  }
};

// src/ui/HideUISection.module.css
var HideUISection_default = {
  "hidden": "HideUISection-module__hidden_ygtI5G__0181",
  "hideUiSection": "HideUISection-module__hide-ui-section_ygtI5G__0181",
  "hideUiSectionContents": "HideUISection-module__hide-ui-section-contents_ygtI5G__0181"
};

// src/ui/tooltip.module.css
var tooltip_default = {
  "tooltip": "tooltip-module__tooltip_qonKzG__0181",
  "tooltipInitiator": "tooltip-module__tooltip-initiator_qonKzG__0181",
  "tooltipItem": "tooltip-module__tooltip-item_qonKzG__0181"
};

// src/ui/HideUISection.ts
var HideUISection = class {
  constructor() {
    this.element = document.createElement("div");
    this.element.className = HideUISection_default.hideUiSection;
    this.hideUiHeader = document.createElement("div");
    this.hideUiHeader.textContent = "Hide UI";
    this.hideUiHeader.className = shared_styles_default.header;
    this.element.append(this.hideUiHeader);
    this.hideUiSectionContents = document.createElement("div");
    this.hideUiSectionContents.className = HideUISection_default.hideUiSectionContents;
    this.element.append(this.hideUiSectionContents);
    this.hideUiButton = document.createElement("button");
    this.hideUiButton.className = shared_styles_default.button;
    this.hideUiButton.textContent = "Hide UI";
    this.hideUiButton.addEventListener("click", () => {
      setUrlParam("noUI", "true");
    });
    this.hideUiSectionContents.append(this.hideUiButton);
    const warningIcon = document.createElement("span");
    warningIcon.className = tooltip_default.tooltip;
    warningIcon.setAttribute("data-direction", "left");
    const warningIconText = document.createElement("span");
    warningIconText.className = tooltip_default.tooltipInitiator;
    warningIconText.textContent = "\u26A0\uFE0F";
    warningIcon.append(warningIconText);
    const warningTooltip = document.createElement("span");
    warningTooltip.className = tooltip_default.tooltipItem;
    warningTooltip.textContent = "If you hide the UI, it can only be shown again by removing the noUI parameter from the URL";
    warningIcon.append(warningTooltip);
    this.hideUiSectionContents.append(warningIcon);
  }
  show() {
    this.element.classList.remove(HideUISection_default.hidden);
  }
  hide() {
    this.element.classList.add(HideUISection_default.hidden);
  }
};

// src/ui/UnusedParameters.module.css
var UnusedParameters_default = {
  "header": "UnusedParameters-module__header_BZL2TW__0181",
  "hidden": "UnusedParameters-module__hidden_BZL2TW__0181",
  "paramListItem": "UnusedParameters-module__param-list-item_BZL2TW__0181",
  "unusedParameters": "UnusedParameters-module__unused-parameters_BZL2TW__0181"
};

// src/ui/UnusedParameters.ts
var UnusedParameters = class {
  constructor() {
    this.element = document.createElement("div");
    this.element.classList.add(UnusedParameters_default.unusedParameters, UnusedParameters_default.hidden);
    this.header = document.createElement("div");
    this.header.textContent = "Unused Parameters";
    this.header.className = shared_styles_default.header;
    this.element.append(this.header);
    const warningIcon = document.createElement("span");
    warningIcon.className = tooltip_default.tooltip;
    warningIcon.setAttribute("data-direction", "left");
    const warningIconText = document.createElement("span");
    warningIconText.className = tooltip_default.tooltipInitiator;
    warningIconText.textContent = "\u26A0\uFE0F";
    warningIcon.append(warningIconText);
    const warningTooltip = document.createElement("span");
    warningTooltip.className = tooltip_default.tooltipItem;
    warningTooltip.textContent = "These parameters are not used by the viewer in the current mode";
    warningIcon.append(warningTooltip);
    this.header.append(warningIcon);
    this.paramsHolder = document.createElement("div");
    this.element.append(this.paramsHolder);
  }
  setParams(params) {
    this.paramsHolder.innerHTML = "";
    if (params.length === 0) {
      this.element.classList.add(UnusedParameters_default.hidden);
      return;
    }
    this.element.classList.remove(UnusedParameters_default.hidden);
    for (const param of params) {
      const listItem = document.createElement("div");
      listItem.className = UnusedParameters_default.paramListItem;
      const paramName = document.createElement("div");
      paramName.textContent = param;
      listItem.append(paramName);
      const removeButton = document.createElement("button");
      removeButton.className = shared_styles_default.button;
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => {
        setUrlParam(param, null);
      });
      listItem.append(removeButton);
      this.paramsHolder.append(listItem);
    }
  }
};

// src/ui/ViewerUI.module.css
var ViewerUI_default = {
  "contents": "ViewerUI-module__contents_ne7v1W__0181",
  "emptyState": "ViewerUI-module__empty-state_ne7v1W__0181",
  "header": "ViewerUI-module__header_ne7v1W__0181",
  "menuButton": "ViewerUI-module__menu-button_ne7v1W__0181",
  "viewerUi": "ViewerUI-module__viewer-ui_ne7v1W__0181"
};

// src/ui/ViewerUI.ts
var ViewerUI = class {
  constructor() {
    this.element = document.createElement("div");
    this.element.className = ViewerUI_default.viewerUi;
    this.element.addEventListener("wheel", (e) => e.stopPropagation());
    document.body.append(this.element);
    this.contents = document.createElement("div");
    this.contents.className = ViewerUI_default.contents;
    this.contents.style.display = "none";
    this.element.append(this.contents);
    this.header = document.createElement("div");
    this.header.className = ViewerUI_default.header;
    this.header.textContent = "MML Viewer (Alpha)";
    this.contents.append(this.header);
    this.groupHolder = document.createElement("div");
    this.contents.append(this.groupHolder);
    this.unusedParameters = new UnusedParameters();
    this.contents.append(this.unusedParameters.element);
    this.hideUISection = new HideUISection();
    this.contents.append(this.hideUISection.element);
    const menuIcon = document.createElement("button");
    menuIcon.classList.add(ViewerUI_default.menuButton, "no-copy");
    menuIcon.textContent = "\u2261";
    menuIcon.addEventListener("click", () => {
      this.contents.style.display = this.contents.style.display === "none" ? "block" : "none";
    });
    this.element.append(menuIcon);
  }
  addGroup(uiGroup) {
    this.groupHolder.append(uiGroup.element);
  }
  showUnusedParams(params) {
    this.unusedParameters.setParams(params);
  }
  showAddressMenu() {
    this.element.classList.add(ViewerUI_default.emptyState);
    this.contents.style.display = "block";
    this.hideUISection.hide();
  }
  hideAddressMenu() {
    this.element.classList.remove(ViewerUI_default.emptyState);
    this.hideUISection.show();
  }
  removeGroup(group) {
    this.groupHolder.removeChild(group.element);
  }
  show() {
    this.element.style.display = "block";
  }
  hide() {
    this.element.style.display = "none";
  }
};

// src/StandaloneViewer.ts
var StandaloneViewer = class {
  constructor(windowTarget, targetForWrappers) {
    this.windowTarget = windowTarget;
    this.targetForWrappers = targetForWrappers;
    this.viewerUI = new ViewerUI();
    this.graphicsMode = null;
    this.formIteration = null;
    this.source = null;
    window.addEventListener("popstate", () => {
      this.handleParams();
    });
    this.handleParams();
  }
  handleParams() {
    const queryParamState = new QueryParamState(window.location.search);
    const formIteration = new FormIteration(queryParamState, this.viewerUI, this.formIteration);
    this.formIteration = formIteration;
    const url = formIteration.getFieldValue(urlField);
    const renderer = formIteration.getFieldValue(rendererField);
    const noUI = parseBoolAttribute(queryParamState.read("noUI"), false);
    if (noUI) {
      this.viewerUI.hide();
    } else {
      this.viewerUI.show();
    }
    let source;
    if (url) {
      source = { url };
      if (this.source && this.source.url !== url) {
        if (this.graphicsMode) {
          this.graphicsMode.dispose();
          this.graphicsMode = null;
        }
      }
      this.source = source;
    } else {
      if (this.graphicsMode) {
        this.graphicsMode.dispose();
        this.graphicsMode = null;
      }
      this.viewerUI.showAddressMenu();
      this.formIteration.completed();
      return;
    }
    this.viewerUI.hideAddressMenu();
    if (this.graphicsMode && this.graphicsMode.type !== renderer) {
      this.graphicsMode.dispose();
      this.graphicsMode = null;
    }
    if (!this.graphicsMode) {
      if (renderer === "playcanvas") {
        this.graphicsMode = new PlayCanvasMode(
          this.windowTarget,
          this.targetForWrappers,
          source,
          formIteration
        );
      } else if (renderer === "threejs") {
        this.graphicsMode = new ThreeJSMode(
          this.windowTarget,
          this.targetForWrappers,
          source,
          formIteration
        );
      } else if (renderer === "tags") {
        this.graphicsMode = new TagsMode(
          this.windowTarget,
          this.targetForWrappers,
          source,
          formIteration
        );
      }
    } else {
      this.graphicsMode.update(formIteration);
    }
  }
};

// src/index.ts
window.addEventListener("load", () => {
  (async () => {
    const { iframeWindow, iframeBody } = await IframeWrapper.create();
    const windowTarget = iframeWindow;
    const targetForWrappers = iframeBody;
    registerCustomElementsToWindow(windowTarget);
    const transparentPixel = document.createElement("div");
    transparentPixel.style.width = "1px";
    transparentPixel.style.height = "1px";
    transparentPixel.style.position = "absolute";
    transparentPixel.style.top = "1px";
    transparentPixel.style.left = "1px";
    transparentPixel.style.userSelect = "none";
    transparentPixel.style.pointerEvents = "none";
    transparentPixel.style.backdropFilter = "blur(1px)";
    document.body.append(transparentPixel);
    const standaloneViewer = new StandaloneViewer(windowTarget, targetForWrappers);
    window["mml-viewer"] = standaloneViewer;
  })();
});
//# sourceMappingURL=index.js.map
