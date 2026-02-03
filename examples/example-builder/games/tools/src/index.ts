export {};

class XTool extends HTMLElement {
  static get observedAttributes() { return ["activated", "equipped", "activation-mode", "name"]; }
  private __group: HTMLElement | null;
  constructor() {
    super();
    this.__group = null;
  }
  connectedCallback() {
    if (!this.hasAttribute("activation-mode")) this.setAttribute("activation-mode", "hold");
    this.__ensureGroup();
    this.__updateGroupEquippedState();
  }
  disconnectedCallback() {
  }
  equip() {
    this.setAttribute("equipped", "true");
    this.removeAttribute("visible-to");
    this.__updateGroupEquippedState();
    this.dispatchEvent(new CustomEvent("equip", { bubbles: true }));
  }
  unequip() {
    this.removeAttribute("equipped");
    this.setAttribute("visible-to", this.getAttribute("owner-id") || "");
    this.__updateGroupEquippedState();
    this.dispatchEvent(new CustomEvent("unequip", { bubbles: true }));
  }
  activate(ray: any) {
    this.setAttribute("activated", "true");
    this.dispatchEvent(new CustomEvent("activate", { bubbles: true, detail: { ray } }));
  }
  deactivate() {
    this.removeAttribute("activated");
    this.dispatchEvent(new CustomEvent("deactivate", { bubbles: true }));
  }
  private __ensureGroup() {
    if (this.__group) return;
    const group = document.createElement("m-group");
    group.setAttribute("visible", "false");
    const toMove = Array.from(this.children);
    toMove.forEach((child) => {
      if (child !== group) group.appendChild(child);
    });
    this.appendChild(group);
    this.__group = group as any;
  }
  private __updateGroupEquippedState() {
    this.__ensureGroup();
    if (!this.__group) return;
    const equipped = this.hasAttribute("equipped");
    if (equipped) {
      this.__group.setAttribute("visible", "true");
      const explicitSocket = this.getAttribute("socket");
      const socketToUse = explicitSocket ?? "hand_r";
      this.__group.setAttribute("socket", socketToUse);
    } else {
      this.__group.setAttribute("visible", "false");
      const explicitSocket = this.getAttribute("socket");
      const currentSocket = this.__group.getAttribute("socket");
      if (!explicitSocket || currentSocket === "hand_r") {
        this.__group.removeAttribute("socket");
      }
    }
  }
}
customElements.define("x-tool", XTool);

class XInventoryManager extends HTMLElement {
  private __tools: HTMLElement[];
  private __slotControls: any[];
  private __onSlotInput: (ev: any) => void;
  private __maxSlots: number;
  private __scrollPrevControl: any | null = null;
  private __scrollNextControl: any | null = null;
  constructor() {
    super();
    this.__tools = [];
    this.__slotControls = [];
    this.__onSlotInput = this._onSlotInput.bind(this);
    this.__maxSlots = 10;
  }
  connectedCallback() {
    this.__setupSlotControls();
    this.__setupScrollControls();
  }
  disconnectedCallback() {
    this.__slotControls.forEach((ctrl: any) => {
      try { ctrl.removeEventListener("input", this.__onSlotInput); } catch {}
      try { ctrl.stopInputPolling && ctrl.stopInputPolling(); } catch {}
      try { ctrl.remove(); } catch {}
    });
    this.__slotControls = [];
    if (this.__scrollPrevControl) {
      try { this.__scrollPrevControl.removeEventListener("input", this.__onScrollPrev); } catch {}
      try { this.__scrollPrevControl.remove(); } catch {}
      this.__scrollPrevControl = null;
    }
    if (this.__scrollNextControl) {
      try { this.__scrollNextControl.removeEventListener("input", this.__onScrollNext); } catch {}
      try { this.__scrollNextControl.remove(); } catch {}
      this.__scrollNextControl = null;
    }
    this.__tools = [];
  }
  private __setupSlotControls() {
    for (let i = 0; i < this.__maxSlots; i++) {
      const slotControl: any = document.createElement("m-control");
      slotControl.setAttribute("type", "button");
      slotControl.setAttribute("input", `${String((i + 1) % 10)}`);
      slotControl.dataset.slotIndex = String(i);
      slotControl.addEventListener("input", this.__onSlotInput);
      this.appendChild(slotControl);
      this.__slotControls.push(slotControl);
    }
  }
  private __onScrollPrev = (ev: any) => {
    if (!ev || ev.detail?.value !== 1.0) return;
    this.__equipRelative(-1);
  };
  private __onScrollNext = (ev: any) => {
    if (!ev || ev.detail?.value !== 1.0) return;
    this.__equipRelative(1);
  };
  private __setupScrollControls() {
    // Previous tool: mouse wheel up or LB
    const prevCtrl: any = document.createElement("m-control");
    prevCtrl.setAttribute("type", "button");
    prevCtrl.setAttribute("input", "mousewheel-up gamepad-lb");
    prevCtrl.addEventListener("input", this.__onScrollPrev);
    this.appendChild(prevCtrl);
    this.__scrollPrevControl = prevCtrl;

    // Next tool: mouse wheel down or RB
    const nextCtrl: any = document.createElement("m-control");
    nextCtrl.setAttribute("type", "button");
    nextCtrl.setAttribute("input", "mousewheel-down gamepad-rb");
    nextCtrl.addEventListener("input", this.__onScrollNext);
    this.appendChild(nextCtrl);
    this.__scrollNextControl = nextCtrl;
  }
  private __equipRelative(delta: number) {
    const tools = this.__tools;
    if (!tools || tools.length === 0) return;
    let currentIndex = tools.findIndex((t: any) => t.hasAttribute("equipped"));
    if (currentIndex < 0) currentIndex = delta > 0 ? -1 : 0; // if none, choose start depending on direction
    const nextIndex = ((currentIndex + delta) % tools.length + tools.length) % tools.length;
    const nextTool = tools[nextIndex];
    if (!nextTool) return;
    const model = this.closest("m-model");
    if (model && typeof (applyEquipSelection as any) === "function") {
      applyEquipSelection(model as any, nextTool as any);
    }
  }
  private _onSlotInput(ev: any) {
    const v = ev?.detail?.value;
    if (v !== 1.0) return;
    const ctrl = ev?.target as any;
    const slotIndex = parseInt(ctrl?.dataset?.slotIndex || "-1", 10);
    if (slotIndex < 0) return;
    const tool = this.__tools[slotIndex];
    if (!tool) return;
    const model = this.closest("m-model");
    if (model && typeof (applyEquipSelection as any) === "function") {
      applyEquipSelection(model as any, tool as any);
    }
  }
  addTool(tool: any) {
    if (!tool || tool.nodeName !== "X-TOOL") return;
    if (this.__tools.includes(tool)) return;
    this.__tools.push(tool);
    this.appendChild(tool);
  }
  removeTool(tool: any) {
    const index = this.__tools.indexOf(tool);
    if (index === -1) return;
    this.__tools.splice(index, 1);
    if ((tool as any).parentNode === this) {
      this.removeChild(tool);
    }
  }
  moveTool(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= this.__tools.length) return;
    if (toIndex < 0 || toIndex >= this.__tools.length) return;
    const tool = this.__tools.splice(fromIndex, 1)[0];
    this.__tools.splice(toIndex, 0, tool);
  }
  getTools() {
    return [...this.__tools];
  }
  getToolAtSlot(index: number) {
    return this.__tools[index] || null;
  }
}
customElements.define("x-inventory-manager", XInventoryManager);

const sceneGroup = document.getElementById("scene-group") as HTMLElement | null;
const connectedPlayers: Map<number, any> = new Map();

function setTransform(element: Element, x: number, y: number, z: number, ry: number) {
  ["x", "y", "z"].forEach(attr => (element as any).setAttribute(attr, attr === "x" ? x : attr === "y" ? y : z));
  (element as any).setAttribute("ry", ry);
}

function assignAnimationLerp(element: Element, duration: number, attrs: string) {
  const lerp = document.createElement("m-attr-lerp");
  lerp.setAttribute("attr", attrs);
  lerp.setAttribute("duration", String(duration));
  element.appendChild(lerp);
}

function createPlayer() {
  const player = document.createElement("m-model");
  player.setAttribute("src", "/assets/bot.glb");
  assignAnimationLerp(player, 100, "x,y,z,ry");
  setTransform(player, Math.random() * 4 - 2, 0, Math.random() * 4 - 2, 0);
  sceneGroup && sceneGroup.appendChild(player);
  return player as any;
}

function assignPlayerAnimation(player: Element, state: string) {
  const animation = document.createElement("m-animation");
  animation.setAttribute("src", `/assets/anim_${state}.glb`);
  animation.setAttribute("state", state);
  animation.setAttribute("weight", state === "idle" ? "1.0" : "0.0");
  assignAnimationLerp(animation, 150, "weight");
  player.appendChild(animation);
  return animation;
}

function assignPlayerController(player: Element, id: number) {
  const controller = document.createElement("m-character-controller");
  controller.setAttribute("visible-to", id.toString());
  player.appendChild(controller);
}

function addToolsToPlayer(player: any, connectionId: number) {
  const manager = document.createElement("x-inventory-manager") as any;
  player.appendChild(manager);

  const flashlight = document.createElement("x-tool") as any;
  flashlight.setAttribute("name", "Flashlight");
  flashlight.setAttribute("tooltip", "Toggle light");
  flashlight.setAttribute("activation-mode", "toggle");
  flashlight.setAttribute("visible-to", String(connectionId));
  flashlight.setAttribute("owner-id", String(connectionId));
  const flashlightControl: any = document.createElement("m-control");
  flashlightControl.setAttribute("type", "button");
  flashlightControl.setAttribute("input", "mouseleft gamepad-rt");
  // flashlightControl.setAttribute("button", "0");
  flashlightControl.setAttribute("visible-to", String(connectionId));
  flashlightControl.addEventListener("input", (ev: any) => {
    if (!flashlight.hasAttribute("equipped")) return;
    if (ev.detail.connectionId !== connectionId || ev.detail.value !== 1.0) return;
    if (flashlight.hasAttribute("activated")) {
      flashlight.deactivate();
    } else {
      flashlight.activate();
    }
  });
  flashlight.appendChild(flashlightControl);
  const light = document.createElement("m-light");
  light.setAttribute("type", "spotlight");
  light.setAttribute("color", "1,1,0.9");
  light.setAttribute("intensity", "3");
  light.setAttribute("distance", "20");
  light.setAttribute("rz", "-90");
  light.setAttribute("cast-shadows", "true");
  light.setAttribute("enabled", "false");
  flashlight.appendChild(light);
  const flashlightModel = document.createElement("m-model");
  flashlightModel.setAttribute("src", "/assets/flashlight.glb");
  flashlightModel.setAttribute("collide", "false");
  flashlight.appendChild(flashlightModel);
  manager.addTool(flashlight);
  flashlight.addEventListener("activate", () => {
    const light = flashlight.querySelector("m-light") as any;
    light.setAttribute("enabled", "true");
  });
  flashlight.addEventListener("deactivate", () => {
    const light = flashlight.querySelector("m-light") as any;
    light.setAttribute("enabled", "false");
  });
  flashlight.addEventListener("equip", () => {});
  flashlight.addEventListener("unequip", () => {});

  const horn = document.createElement("x-tool") as any;
  horn.setAttribute("name", "Horn");
  horn.setAttribute("tooltip", "Honk");
  horn.setAttribute("activation-mode", "hold");
  horn.setAttribute("visible-to", String(connectionId));
  horn.setAttribute("owner-id", String(connectionId));
  const hornControl: any = document.createElement("m-control");
  hornControl.setAttribute("type", "button");
  hornControl.setAttribute("input", "mouseleft gamepad-rt");
  hornControl.setAttribute("visible-to", String(connectionId));
  hornControl.addEventListener("input", (ev: any) => {
    if (!horn.hasAttribute("equipped")) return;
    if (ev.detail.connectionId !== connectionId) return;
    if (ev.detail.value === 1.0) {
      horn.activate();
    } else if (ev.detail.value === 0.0) {
      horn.deactivate();
    }
  });
  horn.appendChild(hornControl);
  horn.addEventListener("activate", () => {
    const audio = horn.querySelector("m-audio");
    audio.setAttribute("enabled", "true");
    audio.setAttribute("start-time", String(performance.now()));
    audio.setAttribute("loop", "false");
  });
  horn.addEventListener("deactivate", () => {
    const audio = horn.querySelector("m-audio");
    audio.setAttribute("enabled", "false");
  });
  const audio = document.createElement("m-audio");
  audio.setAttribute("src", "https://mmlstorage.com/95beb8827452fab91d38535bbfd359b5e59547e2f98a937cb01032d3dced930c");
  audio.setAttribute("enabled", "false");
  audio.setAttribute("loop", "false");
  horn.appendChild(audio);

  const hornOverlay = document.createElement("m-icon-overlay");
  hornOverlay.setAttribute("anchor", "center");
  const hornOverlaySvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  hornOverlaySvg.setAttribute("width", "20");
  hornOverlaySvg.setAttribute("height", "20");
  const hornText = document.createElementNS("http://www.w3.org/2000/svg", "text");
  hornText.setAttribute("x", "10");
  hornText.setAttribute("y", "14");
  hornText.setAttribute("text-anchor", "middle");
  hornText.setAttribute("font-size", "16");
  hornText.textContent = "📣";
  hornOverlaySvg.appendChild(hornText);
  hornOverlay.appendChild(hornOverlaySvg);
  horn.appendChild(hornOverlay);
  manager.addTool(horn);

  if (connectionId === 1) {
    const gun = document.createElement("x-tool") as any;
    gun.setAttribute("name", "Gun");
    gun.setAttribute("tooltip", "Shoot");
    gun.setAttribute("activation-mode", "hold");
    gun.setAttribute("visible-to", String(connectionId));
    gun.setAttribute("owner-id", String(connectionId));
    const gunControl = document.createElement("m-control");
    gunControl.setAttribute("type", "button");
    gunControl.setAttribute("input", "mouseleft gamepad-rt");
    gunControl.setAttribute("raycast-type", "camera");
    // gunControl.setAttribute("raycast-distance", "100");
    gunControl.setAttribute("raycast-from-socket", "true");
    gunControl.setAttribute("visible-to", String(connectionId));
    let maxAmmo = 12;
    let currentAmmo = maxAmmo;
    const reloadDurationMs = 1500;
    let isReloading = false;
    let reloadTimeoutId: any = null;

    function updateAmmoUI() {
      if (!ammoTextNode) return;
      ammoTextNode.textContent = isReloading ? `Reloading... (${currentAmmo}/${maxAmmo})` : `Ammo: ${currentAmmo}/${maxAmmo}`;
    }
    function startReload() {
      if (isReloading) return;
      if (currentAmmo >= maxAmmo) return;
      isReloading = true;
      updateAmmoUI();
      reloadTimeoutId = setTimeout(() => {
        currentAmmo = maxAmmo;
        isReloading = false;
        updateAmmoUI();
      }, reloadDurationMs);
    }
    function spawnBullet(ray: any) {
      if (!ray) return;
      const bullet = document.createElement("m-sphere");
      bullet.setAttribute("radius", "0.35");
      bullet.setAttribute("color", "#d90429");
      bullet.setAttribute("rigidbody", "true");
      bullet.setAttribute("mass", "8");
      bullet.setAttribute("restitution", "0.1");
      bullet.setAttribute("collide", "false");
      // const lerp = document.createElement("m-attr-lerp");
      // lerp.setAttribute("attr", "x,y,z");
      // lerp.setAttribute("duration", "50");
      // bullet.appendChild(lerp);

      const start = {
        x: ray.origin.x + ray.direction.x * 0.5,
        y: ray.origin.y + ray.direction.y * 0.5,
        z: ray.origin.z + ray.direction.z * 0.5,
      };
      bullet.setAttribute("x", start.x);
      bullet.setAttribute("y", start.y);
      bullet.setAttribute("z", start.z);
      sceneGroup && sceneGroup.appendChild(bullet);
      const bulletImpulse = 1000.0;
      const impulse = {
        x: ray.direction.x * bulletImpulse,
        y: ray.direction.y * bulletImpulse,
        z: ray.direction.z * bulletImpulse,
      };
      setTimeout(() => {
        (window as any).physics.applyImpulse(bullet, impulse);
      }, 50);
    }

    gunControl.addEventListener("input", (ev: any) => {
      if (!gun.hasAttribute("equipped")) return;
      if (ev.detail.connectionId !== connectionId) return;
      if (ev.detail.value === 1.0) {
        const ray = ev.detail.ray || null;
        gun.activate(ray);
      } else if (ev.detail.value === 0.0) {
        gun.deactivate();
      }
    });
    gun.appendChild(gunControl);

    gun.addEventListener("activate", (ev: any) => {
      const ray = ev.detail.ray || null;
      if (isReloading) return;
      if (currentAmmo <= 0) { startReload(); return; }
      if (ray) {
        if (currentAmmo > 0) {
          currentAmmo -= 1;
          updateAmmoUI();
          spawnBullet(ray);
        }
      }
    });
    gun.addEventListener("deactivate", () => {
    });

    const reloadControl: any = document.createElement("m-control");
    reloadControl.setAttribute("type", "button");
    reloadControl.setAttribute("input", "r gamepad-x");
    reloadControl.setAttribute("visible-to", String(connectionId));
    reloadControl.addEventListener("input", (ev: any) => {
      if (!gun.hasAttribute("equipped")) return;
      if (ev.detail.connectionId !== connectionId || ev.detail.value !== 1.0) return;
      startReload();
    });
    gun.appendChild(reloadControl);

    const gunOverlay = document.createElement("m-icon-overlay");
    const gunOverlaySvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    gunOverlaySvg.setAttribute("width", "20");
    gunOverlaySvg.setAttribute("height", "20");
    const gunText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    gunText.setAttribute("x", "10");
    gunText.setAttribute("y", "14");
    gunText.setAttribute("text-anchor", "middle");    
    gunText.setAttribute("font-size", "16");
    gunText.textContent = "🔫";
    gunOverlaySvg.appendChild(gunText);
    gunOverlay.appendChild(gunOverlaySvg);
    gun.appendChild(gunOverlay);

    const gunModel = document.createElement("m-model");
    gunModel.setAttribute("src", "/assets/handgun.glb");
    gunModel.setAttribute("collide", "false");
    gunModel.setAttribute("rz", "180");
    gunModel.setAttribute("rx", "180");
    gun.appendChild(gunModel);

    const controller = player.querySelector("m-character-controller") as any;
    let crosshairOverlay: any = null;
    let ammoOverlay: any = null;
    let ammoTextNode: any = null;

    function setOverlayVisible(overlay: any, visible: boolean) {
      try {
        const el = overlay.getPortalElement ? overlay.getPortalElement() : overlay;
        el.style.display = visible ? "block" : "none";
      } catch {}
    }
    function ensureOverlays() {
      if (!controller) return;
      if (!crosshairOverlay) {
        crosshairOverlay = document.createElement("m-overlay");
        crosshairOverlay.setAttribute("anchor", "center");
        crosshairOverlay.setAttribute("visible-to", String(connectionId));
        player.insertBefore(crosshairOverlay, (controller as any).nextSibling);
        setOverlayVisible(crosshairOverlay, false);
        requestAnimationFrame(() => setOverlayVisible(crosshairOverlay, false));
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "40");
        svg.setAttribute("height", "40");
        (svg as any).style.overflow = "visible";
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", "20");
        circle.setAttribute("cy", "20");
        circle.setAttribute("r", "4");
        circle.setAttribute("fill", "none");
        circle.setAttribute("stroke", "white");
        circle.setAttribute("stroke-width", "1.5");
        const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        vLine.setAttribute("x1", "20");
        vLine.setAttribute("y1", "6");
        vLine.setAttribute("x2", "20");
        vLine.setAttribute("y2", "14");
        vLine.setAttribute("stroke", "white");
        vLine.setAttribute("stroke-width", "1");
        const vLine2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        vLine2.setAttribute("x1", "20");
        vLine2.setAttribute("y1", "26");
        vLine2.setAttribute("x2", "20");
        vLine2.setAttribute("y2", "34");
        vLine2.setAttribute("stroke", "white");
        vLine2.setAttribute("stroke-width", "1");
        const hLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        hLine.setAttribute("x1", "6");
        hLine.setAttribute("y1", "20");
        hLine.setAttribute("x2", "14");
        hLine.setAttribute("y2", "20");
        hLine.setAttribute("stroke", "white");
        hLine.setAttribute("stroke-width", "1");
        const hLine2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        hLine2.setAttribute("x1", "26");
        hLine2.setAttribute("y1", "20");
        hLine2.setAttribute("x2", "34");
        hLine2.setAttribute("y2", "20");
        hLine2.setAttribute("stroke", "white");
        hLine2.setAttribute("stroke-width", "1");
        svg.appendChild(circle);
        svg.appendChild(vLine);
        svg.appendChild(vLine2);
        svg.appendChild(hLine);
        svg.appendChild(hLine2);
        crosshairOverlay.appendChild(svg);
      }
      if (!ammoOverlay) {
        ammoOverlay = document.createElement("m-overlay");
        ammoOverlay.setAttribute("anchor", "bottom-right");
        ammoOverlay.setAttribute("offset-x", "-24");
        ammoOverlay.setAttribute("offset-y", "-24");
        ammoOverlay.setAttribute("visible-to", String(connectionId));
        player.insertBefore(ammoOverlay, (controller as any).nextSibling);
        setOverlayVisible(ammoOverlay, false);
        requestAnimationFrame(() => setOverlayVisible(ammoOverlay, false));
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "140");
        svg.setAttribute("height", "36");
        (svg as any).style.overflow = "visible";
        const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        bg.setAttribute("x", "0");
        bg.setAttribute("y", "0");
        bg.setAttribute("width", "140");
        bg.setAttribute("height", "28");
        bg.setAttribute("rx", "6");
        bg.setAttribute("fill", "rgba(0,0,0,0.5)");
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", "12");
        text.setAttribute("y", "19");
        text.setAttribute("fill", "white");
        text.setAttribute("font-size", "14");
        text.setAttribute("font-weight", "600");
        ammoTextNode = text;
        svg.appendChild(bg);
        svg.appendChild(text);
        ammoOverlay.appendChild(svg);
      }
    }

    function setHudVisible(visible: boolean) {
      ensureOverlays();
      if (crosshairOverlay) setOverlayVisible(crosshairOverlay, visible);
      if (ammoOverlay) setOverlayVisible(ammoOverlay, visible);
    }

    gun.addEventListener("activate", () => {});
    gun.addEventListener("deactivate", () => {});
    gun.addEventListener("equip", () => {
      ensureOverlays();
      updateAmmoUI();
    });
    gun.addEventListener("unequip", () => {
      if (reloadTimeoutId !== null) {
        clearTimeout(reloadTimeoutId);
        reloadTimeoutId = null;
      }
      isReloading = false;
      if (crosshairOverlay) {
        crosshairOverlay.remove();
        crosshairOverlay = null;
      }
      if (ammoOverlay) {
        ammoOverlay.remove();
        ammoOverlay = null;
        ammoTextNode = null;
      }
    });
    manager.addTool(gun);
  }

  createToolInventoryOverlay(player, connectionId, manager);
}

function createToolInventoryOverlay(player: any, connectionId: number, manager: any) {
  const controller = player.querySelector("m-character-controller") as any;
  if (!controller) return;
  const overlay = document.createElement("m-overlay") as any;
  overlay.setAttribute("anchor", "bottom-center");
  overlay.setAttribute("offset-y", "-20");
  overlay.setAttribute("visible-to", String(connectionId));
  player.insertBefore(overlay, (controller as any).nextSibling);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "400");
  svg.setAttribute("height", "60");
  (svg as any).style.overflow = "visible";
  overlay.appendChild(svg);

  const buttonWidth = 70;
  const buttonHeight = 40;
  const gap = 8;
  const padding = 10;

  const updateToolbarUI = () => {
    const tools = manager.getTools();
    (svg as any).innerHTML = "";
    const totalWidth = tools.length * buttonWidth + (tools.length - 1) * gap + padding * 2;
    const containerX = (400 - totalWidth) / 2;
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x", String(containerX));
    bgRect.setAttribute("y", "10");
    bgRect.setAttribute("width", String(totalWidth));
    bgRect.setAttribute("height", String(buttonHeight + padding));
    bgRect.setAttribute("rx", "8");
    bgRect.setAttribute("fill", "rgba(0,0,0,0.5)");
    svg.appendChild(bgRect);
    tools.forEach((tool: any, index: number) => {
      const isSelected = tool.hasAttribute("equipped");
      const x = containerX + padding + index * (buttonWidth + gap);
      const y = 10 + padding / 2;
      const buttonGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      (buttonGroup as any).style.cursor = "pointer";
      const buttonRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      buttonRect.setAttribute("x", String(x));
      buttonRect.setAttribute("y", String(y));
      buttonRect.setAttribute("width", String(buttonWidth));
      buttonRect.setAttribute("height", String(buttonHeight));
      buttonRect.setAttribute("rx", "6");
      buttonRect.setAttribute("fill", isSelected ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)");
      buttonRect.setAttribute("stroke", isSelected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)");
      buttonRect.setAttribute("stroke-width", isSelected ? "2" : "1");
      if (isSelected) {
        buttonRect.setAttribute("filter", "url(#glow)");
      }
      buttonGroup.appendChild(buttonRect);
      const keyText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      keyText.setAttribute("x", String(x + buttonWidth / 2));
      keyText.setAttribute("y", String(y + 16));
      keyText.setAttribute("text-anchor", "middle");
      keyText.setAttribute("fill", "white");
      keyText.setAttribute("font-size", "11");
      keyText.setAttribute("font-weight", isSelected ? "700" : "500");
      keyText.setAttribute("opacity", isSelected ? "1.0" : "0.7");
      keyText.textContent = ((index + 1) % 10).toString();
      buttonGroup.appendChild(keyText);
      const firstOverlay = tool.querySelector("m-icon-overlay") as any;
      if (firstOverlay) {
        const html = firstOverlay.innerHTML;
        const iconSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        iconSvg.setAttribute("x", String(x + buttonWidth / 2));
        iconSvg.setAttribute("y", String(y + buttonHeight / 2));
        iconSvg.setAttribute("width", String(buttonWidth));
        iconSvg.setAttribute("height", String(buttonHeight));
        (iconSvg as any).innerHTML = html;
        buttonGroup.appendChild(iconSvg);
      } else {
        const name = tool.getAttribute("name") || "";
        const nameText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        nameText.setAttribute("x", String(x + buttonWidth / 2));
        nameText.setAttribute("y", String(y + 32));
        nameText.setAttribute("text-anchor", "middle");
        nameText.setAttribute("fill", "white");
        nameText.setAttribute("font-size", "12");
        nameText.setAttribute("font-weight", isSelected ? "600" : "400");
        nameText.textContent = name;
        buttonGroup.appendChild(nameText);
      }
      buttonGroup.addEventListener("mouseenter", () => {
        if (!isSelected) {
          buttonRect.setAttribute("fill", "rgba(255,255,255,0.18)");
        }
      });
      buttonGroup.addEventListener("mouseleave", () => {
        if (!isSelected) {
          buttonRect.setAttribute("fill", "rgba(255,255,255,0.1)");
        }
      });
      buttonGroup.addEventListener("click", () => {
        applyEquipSelection(player, tool);
      });
      svg.appendChild(buttonGroup);
    });
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filter.setAttribute("id", "glow");
    const feGaussianBlur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
    feGaussianBlur.setAttribute("stdDeviation", "3");
    feGaussianBlur.setAttribute("result", "coloredBlur");
    filter.appendChild(feGaussianBlur);
    const feMerge = document.createElementNS("http://www.w3.org/2000/svg", "feMerge");
    const feMergeNode1 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
    feMergeNode1.setAttribute("in", "coloredBlur");
    const feMergeNode2 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
    feMergeNode2.setAttribute("in", "SourceGraphic");
    feMerge.appendChild(feMergeNode1);
    feMerge.appendChild(feMergeNode2);
    filter.appendChild(feMerge);
    defs.appendChild(filter);
    svg.insertBefore(defs, svg.firstChild);
  };

  updateToolbarUI();
  const observer = new MutationObserver(() => updateToolbarUI());
  manager.getTools().forEach((tool: any) => {
    observer.observe(tool, {
      attributes: true,
      attributeFilter: ["equipped"]
    });
  });
}

function spawnPlayer(connectionId: number) {
  if (connectedPlayers.has(connectionId)) return;
  const player = createPlayer();
  assignPlayerController(player, connectionId);
  const idleAnimation = assignPlayerAnimation(player, "idle");
  const runAnimation = assignPlayerAnimation(player, "run");
  const airAnimation = assignPlayerAnimation(player, "air");
  addToolsToPlayer(player, connectionId);
  connectedPlayers.set(connectionId, {
    character: { model: player, idleAnim: idleAnimation, runAnim: runAnimation, airAnim: airAnimation }
  });
  (player as any).addEventListener("character-move", (event: any) => {
    const { position, rotation, state, connectionId } = event.detail;
    const character = connectedPlayers.get(connectionId).character;
    setTransform(character.model, position.x, position.y, position.z, rotation.ry);
    character.idleAnim.setAttribute("weight", state === "idle" ? "1.0" : "0.0");
    character.runAnim.setAttribute("weight", state === "run" ? "1.0" : "0.0");
    character.airAnim.setAttribute("weight", state === "air" ? "1.0" : "0.0");
  });
}

function removePlayer(connectionId: number) {
  if (!connectedPlayers.has(connectionId)) return;
  const user = connectedPlayers.get(connectionId);
  sceneGroup && sceneGroup.removeChild(user.character.model);
  connectedPlayers.delete(connectionId);
}

window.addEventListener("connected", (event: any) => spawnPlayer(event.detail.connectionId));
window.addEventListener("disconnected", (event: any) => removePlayer(event.detail.connectionId));

function getOwnerModelFromEventTarget(target: any) {
  if (!target || typeof target.closest !== "function") return null;
  return target.closest("m-model");
}
function getControllerForModel(model: any) {
  return model ? model.querySelector("m-character-controller") : null;
}
function getToolsForModel(model: any) {
  const manager = model.querySelector("x-inventory-manager") as any;
  if (manager && typeof manager.getTools === "function") {
    return manager.getTools();
  }
  return [] as any[];
}
function validateRequester(model: any, eventDetail: any) {
  const ctrl = getControllerForModel(model);
  if (!ctrl) return false;
  const visibleTo = ctrl.getAttribute("visible-to");
  const connectionId = eventDetail && eventDetail.connectionId != null ? String(eventDetail.connectionId) : null;
  if (connectionId != null) {
    return visibleTo === connectionId;
  }
  return true;
}
function applyEquipSelection(model: any, selectedTool: any) {
  const tools = getToolsForModel(model);
  if (tools.length === 0) return;
  const isAlreadyEquipped = selectedTool.hasAttribute("equipped");
  tools.forEach((t: any) => {
    if (t.hasAttribute("equipped")) {
      t.unequip();
    }
  });
  if (!isAlreadyEquipped) {
    selectedTool.equip();
  }
}