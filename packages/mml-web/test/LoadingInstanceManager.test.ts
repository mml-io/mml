import { vi } from "vitest";

import { LoadingInstanceManager, LoadingProgressManager } from "../build/index";

describe("LoadingInstanceManager", () => {
  test("simple load", () => {
    const mockLoadingProgressManager = {
      addLoadingAsset: vi.fn(),
      completedLoadingAsset: vi.fn(),
    };

    const loadingInstanceManager = new LoadingInstanceManager("test");
    loadingInstanceManager.start(
      mockLoadingProgressManager as unknown as LoadingProgressManager,
      "http://example.com/foo",
    );
    expect(mockLoadingProgressManager.addLoadingAsset).toHaveBeenCalledWith(
      loadingInstanceManager,
      "http://example.com/foo",
      "test",
    );
    loadingInstanceManager.finish();
    expect(mockLoadingProgressManager.completedLoadingAsset).toHaveBeenCalledWith(
      loadingInstanceManager,
    );
  });

  test("load with no progress manager", () => {
    // Just needs to not error
    const loadingInstanceManager = new LoadingInstanceManager("test");
    loadingInstanceManager.start(null, "http://example.com/foo");
    loadingInstanceManager.finish();
  });

  test("load with no progress manager", () => {
    // Just needs to not error
    const loadingInstanceManager = new LoadingInstanceManager("test");
    loadingInstanceManager.start(null, "http://example.com/foo");
    loadingInstanceManager.start(null, "http://example.com/bar");
    loadingInstanceManager.finish();
  });

  test("abort load", () => {
    const mockLoadingProgressManager = {
      addLoadingAsset: vi.fn(),
      disposeOfLoadingAsset: vi.fn(),
    };

    const loadingInstanceManager = new LoadingInstanceManager("test");
    loadingInstanceManager.start(
      mockLoadingProgressManager as unknown as LoadingProgressManager,
      "http://example.com/foo",
    );
    expect(mockLoadingProgressManager.addLoadingAsset).toHaveBeenCalledWith(
      loadingInstanceManager,
      "http://example.com/foo",
      "test",
    );
    loadingInstanceManager.abortIfLoading();
    expect(mockLoadingProgressManager.disposeOfLoadingAsset).toHaveBeenCalledWith(
      loadingInstanceManager,
    );
  });

  test("progress", () => {
    const mockLoadingProgressManager = {
      addLoadingAsset: vi.fn(),
      completedLoadingAsset: vi.fn(),
      updateAssetProgress: vi.fn(),
    };

    const loadingInstanceManager = new LoadingInstanceManager("test");
    loadingInstanceManager.start(
      mockLoadingProgressManager as unknown as LoadingProgressManager,
      "http://example.com/foo",
    );
    expect(mockLoadingProgressManager.addLoadingAsset).toHaveBeenCalledWith(
      loadingInstanceManager,
      "http://example.com/foo",
      "test",
    );
    loadingInstanceManager.setProgress(0.5);
    expect(mockLoadingProgressManager.updateAssetProgress).toHaveBeenCalledWith(
      loadingInstanceManager,
      0.5,
    );
    loadingInstanceManager.finish();
    expect(mockLoadingProgressManager.completedLoadingAsset).toHaveBeenCalledWith(
      loadingInstanceManager,
    );
  });

  test("error", () => {
    const mockLoadingProgressManager = {
      addLoadingAsset: vi.fn(),
      errorLoadingAsset: vi.fn(),
    };

    const loadingInstanceManager = new LoadingInstanceManager("test");
    loadingInstanceManager.start(
      mockLoadingProgressManager as unknown as LoadingProgressManager,
      "http://example.com/foo",
    );
    expect(mockLoadingProgressManager.addLoadingAsset).toHaveBeenCalledWith(
      loadingInstanceManager,
      "http://example.com/foo",
      "test",
    );
    loadingInstanceManager.error(new Error("Test error"));
    expect(mockLoadingProgressManager.errorLoadingAsset).toHaveBeenCalledWith(
      loadingInstanceManager,
      new Error("Test error"),
    );
  });
});
