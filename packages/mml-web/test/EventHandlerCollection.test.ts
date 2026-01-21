import { vi } from "vitest";

import { EventHandlerCollection } from "../build/index";

function mouseClickEvent(): MouseEvent {
  return new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
  });
}

const clickFunc = vi.fn();
const mockTarget = {
  addEventListener: vi.fn(),
  dispatchEvent: vi.fn() as ReturnType<typeof vi.fn<() => boolean>>,
  removeEventListener: vi.fn(),
};

describe("EventCollection", () => {
  beforeEach(() => {
    clickFunc.mockReset();
    mockTarget.addEventListener.mockReset();
    mockTarget.dispatchEvent.mockReset();
    mockTarget.removeEventListener.mockReset();
  });

  it("Add an event listener to a target and remove it upon clearing", () => {
    const instance = EventHandlerCollection.create([[document, "click", clickFunc]]);
    expect(clickFunc.mock.calls.length).toEqual(0);
    document.dispatchEvent(mouseClickEvent());
    expect(clickFunc.mock.calls.length).toEqual(1);

    instance.clear();
    document.dispatchEvent(mouseClickEvent());
    // no more click events should be received
    expect(clickFunc.mock.calls.length).toEqual(1);
  });

  it("Should call addEventListener with the options when created", () => {
    const optionsArg = { passive: true };
    const instance = EventHandlerCollection.create([[mockTarget, "click", clickFunc, optionsArg]]);
    expect(mockTarget.addEventListener.mock.calls.length).toEqual(1);
    expect(mockTarget.addEventListener.mock.calls[0]).toEqual(["click", clickFunc, optionsArg]);

    instance.clear();
    expect(mockTarget.removeEventListener.mock.calls.length).toEqual(1);
    expect(mockTarget.removeEventListener.mock.calls[0]).toEqual(["click", clickFunc]);
  });

  it("Should call addEventListener with the options when added", () => {
    const optionsArg = { passive: true };
    const instance = EventHandlerCollection.create();
    instance.add(mockTarget, "click", clickFunc, optionsArg);
    expect(mockTarget.addEventListener.mock.calls.length).toEqual(1);
    expect(mockTarget.addEventListener.mock.calls[0]).toEqual(["click", clickFunc, optionsArg]);

    instance.clear();
    expect(mockTarget.removeEventListener.mock.calls.length).toEqual(1);
    expect(mockTarget.removeEventListener.mock.calls[0]).toEqual(["click", clickFunc]);
  });
});
