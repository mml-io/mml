import { jest } from "@jest/globals";

import { LoadingProgressManager } from "../src/loading/LoadingProgressManager";

describe("LoadingProgressManager", () => {
  test("empty", () => {
    const callback = jest.fn();
    const manager = new LoadingProgressManager();
    manager.addProgressCallback(callback);

    expect(callback).toHaveBeenCalledTimes(0);
    expect(manager.toSummary()).toEqual({
      initialLoad: false,
      innerDocuments: [],
      summary: {
        totalErrored: 0,
        totalLoaded: 0,
        totalToLoad: 0,
      },
      summaryByType: {},
    });
    expect(manager.toRatio()).toEqual([0, false]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary())).toEqual(
      `root: Loading...`,
    );

    manager.setInitialLoad(true);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(manager.toSummary()).toEqual({
      initialLoad: true,
      innerDocuments: [],
      summary: {
        totalErrored: 0,
        totalLoaded: 0,
        totalToLoad: 0,
      },
      summaryByType: {},
    });
    expect(manager.toRatio()).toEqual([1, true]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary())).toEqual(
      `root: (0 loaded, 0 errors) / (0 to load) = 0/0`,
    );
  });

  test("single asset load", () => {
    const callback = jest.fn();
    const manager = new LoadingProgressManager();
    manager.addProgressCallback(callback);

    const ref = {};
    manager.addLoadingAsset(ref, "http://example.com/foo", "type-foo");
    expect(callback).toHaveBeenCalledTimes(1);
    expect(manager.toSummary()).toEqual({
      initialLoad: false,
      innerDocuments: [],
      summary: {
        totalErrored: 0,
        totalLoaded: 0,
        totalToLoad: 1,
      },
      summaryByType: {
        "type-foo": {
          assetErrors: [],
          totalErrored: 0,
          totalLoaded: 0,
          totalToLoad: 1,
        },
      },
    });
    expect(manager.toRatio()).toEqual([0, false]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary())).toEqual(
      `root: Loading...`,
    );

    manager.setInitialLoad(true);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(manager.toSummary()).toEqual({
      initialLoad: true,
      innerDocuments: [],
      summary: {
        totalErrored: 0,
        totalLoaded: 0,
        totalToLoad: 1,
      },
      summaryByType: {
        "type-foo": {
          assetErrors: [],
          totalErrored: 0,
          totalLoaded: 0,
          totalToLoad: 1,
        },
      },
    });
    expect(manager.toRatio()).toEqual([0, false]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary()))
      .toEqual(`root: (0 loaded, 0 errors) / (1 to load) = 0/1
 - type-foo: (0 loaded, 0 errors) / (1 to load) = 0/1`);

    manager.completedLoadingAsset(ref);

    expect(manager.toSummary()).toEqual({
      initialLoad: true,
      innerDocuments: [],
      summary: {
        totalErrored: 0,
        totalLoaded: 1,
        totalToLoad: 1,
      },
      summaryByType: {
        "type-foo": {
          assetErrors: [],
          totalErrored: 0,
          totalLoaded: 1,
          totalToLoad: 1,
        },
      },
    });
    expect(manager.toRatio()).toEqual([1, true]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary()))
      .toEqual(`root: (1 loaded, 0 errors) / (1 to load) = 1/1
 - type-foo: (1 loaded, 0 errors) / (1 to load) = 1/1`);
  });

  test("single asset error", () => {
    const callback = jest.fn();
    const manager = new LoadingProgressManager();
    manager.addProgressCallback(callback);

    const ref = {};
    manager.addLoadingAsset(ref, "http://example.com/foo", "type-foo");
    expect(callback).toHaveBeenCalledTimes(1);
    expect(manager.toSummary()).toEqual({
      initialLoad: false,
      innerDocuments: [],
      summary: {
        totalErrored: 0,
        totalLoaded: 0,
        totalToLoad: 1,
      },
      summaryByType: {
        "type-foo": {
          assetErrors: [],
          totalErrored: 0,
          totalLoaded: 0,
          totalToLoad: 1,
        },
      },
    });
    expect(manager.toRatio()).toEqual([0, false]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary())).toEqual(
      `root: Loading...`,
    );

    manager.setInitialLoad(true);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(manager.toSummary()).toEqual({
      initialLoad: true,
      innerDocuments: [],
      summary: {
        totalErrored: 0,
        totalLoaded: 0,
        totalToLoad: 1,
      },
      summaryByType: {
        "type-foo": {
          assetErrors: [],
          totalErrored: 0,
          totalLoaded: 0,
          totalToLoad: 1,
        },
      },
    });
    expect(manager.toRatio()).toEqual([0, false]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary()))
      .toEqual(`root: (0 loaded, 0 errors) / (1 to load) = 0/1
 - type-foo: (0 loaded, 0 errors) / (1 to load) = 0/1`);

    manager.errorLoadingAsset(ref, new Error("Baz error"));

    expect(manager.toSummary()).toEqual({
      initialLoad: true,
      innerDocuments: [],
      summary: {
        totalErrored: 1,
        totalLoaded: 0,
        totalToLoad: 1,
      },
      summaryByType: {
        "type-foo": {
          assetErrors: [["http://example.com/foo", new Error("Baz error")]],
          totalErrored: 1,
          totalLoaded: 0,
          totalToLoad: 1,
        },
      },
    });
    expect(manager.toRatio()).toEqual([1, true]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary()))
      .toEqual(`root: (0 loaded, 1 errors) / (1 to load) = 1/1
 - type-foo: (0 loaded, 1 errors) / (1 to load) = 1/1
   - Errors:
     - http://example.com/foo: Baz error`);
  });

  test("multi asset load", () => {
    const callback = jest.fn();
    const manager = new LoadingProgressManager();
    manager.addProgressCallback(callback);

    const ref1 = {};
    manager.addLoadingAsset(ref1, "http://example.com/foo", "type-foo");
    const ref2 = {};
    manager.addLoadingAsset(ref2, "http://example.com/foo", "type-foo");

    expect(callback).toHaveBeenCalledTimes(2);
    expect(manager.toSummary()).toEqual({
      initialLoad: false,
      innerDocuments: [],
      summary: {
        totalErrored: 0,
        totalLoaded: 0,
        totalToLoad: 2,
      },
      summaryByType: {
        "type-foo": {
          assetErrors: [],
          totalErrored: 0,
          totalLoaded: 0,
          totalToLoad: 2,
        },
      },
    });
    expect(manager.toRatio()).toEqual([0, false]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary())).toEqual(
      `root: Loading...`,
    );

    manager.setInitialLoad(true);

    expect(callback).toHaveBeenCalledTimes(3);
    expect(manager.toSummary()).toEqual({
      initialLoad: true,
      innerDocuments: [],
      summary: {
        totalErrored: 0,
        totalLoaded: 0,
        totalToLoad: 2,
      },
      summaryByType: {
        "type-foo": {
          assetErrors: [],
          totalErrored: 0,
          totalLoaded: 0,
          totalToLoad: 2,
        },
      },
    });
    expect(manager.toRatio()).toEqual([0, false]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary()))
      .toEqual(`root: (0 loaded, 0 errors) / (2 to load) = 0/2
 - type-foo: (0 loaded, 0 errors) / (2 to load) = 0/2`);

    manager.completedLoadingAsset(ref1);
    expect(callback).toHaveBeenCalledTimes(4);
    expect(manager.toSummary()).toEqual({
      initialLoad: true,
      innerDocuments: [],
      summary: {
        totalErrored: 0,
        totalLoaded: 1,
        totalToLoad: 2,
      },
      summaryByType: {
        "type-foo": {
          assetErrors: [],
          totalErrored: 0,
          totalLoaded: 1,
          totalToLoad: 2,
        },
      },
    });
    expect(manager.toRatio()).toEqual([0.5, false]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary()))
      .toEqual(`root: (1 loaded, 0 errors) / (2 to load) = 1/2
 - type-foo: (1 loaded, 0 errors) / (2 to load) = 1/2`);

    manager.completedLoadingAsset(ref2);
    expect(manager.toSummary()).toEqual({
      initialLoad: true,
      innerDocuments: [],
      summary: {
        totalErrored: 0,
        totalLoaded: 2,
        totalToLoad: 2,
      },
      summaryByType: {
        "type-foo": {
          assetErrors: [],
          totalErrored: 0,
          totalLoaded: 2,
          totalToLoad: 2,
        },
      },
    });
    expect(manager.toRatio()).toEqual([1, true]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary()))
      .toEqual(`root: (2 loaded, 0 errors) / (2 to load) = 2/2
 - type-foo: (2 loaded, 0 errors) / (2 to load) = 2/2`);
  });

  test("inner document load", () => {
    const callback = jest.fn();
    const manager = new LoadingProgressManager();
    manager.addProgressCallback(callback);

    const ref1 = {};
    manager.addLoadingAsset(ref1, "http://example.com/foo", "type-foo");

    expect(callback).toHaveBeenCalledTimes(1);

    const documentRef1 = {};
    const documentRef1LoadingProgressCallback = jest.fn();
    const documentRef1LoadingProgressManager = new LoadingProgressManager();
    documentRef1LoadingProgressManager.addProgressCallback(() => {
      documentRef1LoadingProgressCallback();
      manager.updateDocumentProgress(documentRef1);
    });
    manager.addLoadingDocument(
      documentRef1,
      "wss://example.com",
      documentRef1LoadingProgressManager,
    );

    expect(callback).toHaveBeenCalledTimes(2);
    expect(manager.toSummary()).toEqual({
      initialLoad: false,
      innerDocuments: [
        [
          "wss://example.com",
          {
            initialLoad: false,
            innerDocuments: [],
            summary: {
              totalErrored: 0,
              totalLoaded: 0,
              totalToLoad: 0,
            },
            summaryByType: {},
          },
        ],
      ],
      summary: {
        totalErrored: 0,
        totalLoaded: 0,
        totalToLoad: 1,
      },
      summaryByType: {
        "type-foo": {
          assetErrors: [],
          totalErrored: 0,
          totalLoaded: 0,
          totalToLoad: 1,
        },
      },
    });
    expect(manager.toRatio()).toEqual([0, false]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary())).toEqual(
      `root: Loading...`,
    );

    manager.setInitialLoad(true);

    expect(callback).toHaveBeenCalledTimes(3);
    expect(manager.toSummary()).toEqual({
      initialLoad: true,
      innerDocuments: [
        [
          "wss://example.com",
          {
            initialLoad: false,
            innerDocuments: [],
            summary: {
              totalErrored: 0,
              totalLoaded: 0,
              totalToLoad: 0,
            },
            summaryByType: {},
          },
        ],
      ],
      summary: {
        totalErrored: 0,
        totalLoaded: 0,
        totalToLoad: 1,
      },
      summaryByType: {
        "type-foo": {
          assetErrors: [],
          totalErrored: 0,
          totalLoaded: 0,
          totalToLoad: 1,
        },
      },
    });
    expect(manager.toRatio()).toEqual([0, false]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary()))
      .toEqual(`root: (0 loaded, 0 errors) / (1 to load) = 0/1
 - type-foo: (0 loaded, 0 errors) / (1 to load) = 0/1
wss://example.com: Loading...`);

    manager.completedLoadingAsset(ref1);

    expect(callback).toHaveBeenCalledTimes(4);
    expect(manager.toSummary()).toEqual({
      initialLoad: true,
      innerDocuments: [
        [
          "wss://example.com",
          {
            initialLoad: false,
            innerDocuments: [],
            summary: {
              totalErrored: 0,
              totalLoaded: 0,
              totalToLoad: 0,
            },
            summaryByType: {},
          },
        ],
      ],
      summary: {
        totalErrored: 0,
        totalLoaded: 1,
        totalToLoad: 1,
      },
      summaryByType: {
        "type-foo": {
          assetErrors: [],
          totalErrored: 0,
          totalLoaded: 1,
          totalToLoad: 1,
        },
      },
    });
    expect(manager.toRatio()).toEqual([0.5, false]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary()))
      .toEqual(`root: (1 loaded, 0 errors) / (1 to load) = 1/1
 - type-foo: (1 loaded, 0 errors) / (1 to load) = 1/1
wss://example.com: Loading...`);

    manager.updateDocumentProgress(documentRef1);
    expect(callback).toHaveBeenCalledTimes(5);
    expect(manager.toSummary()).toEqual({
      initialLoad: true,
      innerDocuments: [
        [
          "wss://example.com",
          {
            initialLoad: false,
            innerDocuments: [],
            summary: {
              totalErrored: 0,
              totalLoaded: 0,
              totalToLoad: 0,
            },
            summaryByType: {},
          },
        ],
      ],
      summary: {
        totalErrored: 0,
        totalLoaded: 1,
        totalToLoad: 1,
      },
      summaryByType: {
        "type-foo": {
          assetErrors: [],
          totalErrored: 0,
          totalLoaded: 1,
          totalToLoad: 1,
        },
      },
    });
    expect(manager.toRatio()).toEqual([0.5, false]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary()))
      .toEqual(`root: (1 loaded, 0 errors) / (1 to load) = 1/1
 - type-foo: (1 loaded, 0 errors) / (1 to load) = 1/1
wss://example.com: Loading...`);

    const innerDocRef1 = {};
    expect(documentRef1LoadingProgressCallback).toHaveBeenCalledTimes(0);
    documentRef1LoadingProgressManager.addLoadingAsset(
      innerDocRef1,
      "http://example.com/bar",
      "type-bar",
    );
    expect(documentRef1LoadingProgressCallback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(6);
    expect(manager.toSummary()).toEqual({
      initialLoad: true,
      innerDocuments: [
        [
          "wss://example.com",
          {
            initialLoad: false,
            innerDocuments: [],
            summary: {
              totalErrored: 0,
              totalLoaded: 0,
              totalToLoad: 1,
            },
            summaryByType: {
              "type-bar": {
                assetErrors: [],
                totalErrored: 0,
                totalLoaded: 0,
                totalToLoad: 1,
              },
            },
          },
        ],
      ],
      summary: {
        totalErrored: 0,
        totalLoaded: 1,
        totalToLoad: 1,
      },
      summaryByType: {
        "type-foo": {
          assetErrors: [],
          totalErrored: 0,
          totalLoaded: 1,
          totalToLoad: 1,
        },
      },
    });
    expect(manager.toRatio()).toEqual([0.5, false]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary()))
      .toEqual(`root: (1 loaded, 0 errors) / (1 to load) = 1/1
 - type-foo: (1 loaded, 0 errors) / (1 to load) = 1/1
wss://example.com: Loading...`);

    documentRef1LoadingProgressManager.setInitialLoad(true);
    expect(documentRef1LoadingProgressCallback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledTimes(7);
    expect(manager.toSummary()).toEqual({
      initialLoad: true,
      innerDocuments: [
        [
          "wss://example.com",
          {
            initialLoad: true,
            innerDocuments: [],
            summary: {
              totalErrored: 0,
              totalLoaded: 0,
              totalToLoad: 1,
            },
            summaryByType: {
              "type-bar": {
                assetErrors: [],
                totalErrored: 0,
                totalLoaded: 0,
                totalToLoad: 1,
              },
            },
          },
        ],
      ],
      summary: {
        totalErrored: 0,
        totalLoaded: 1,
        totalToLoad: 1,
      },
      summaryByType: {
        "type-foo": {
          assetErrors: [],
          totalErrored: 0,
          totalLoaded: 1,
          totalToLoad: 1,
        },
      },
    });
    expect(manager.toRatio()).toEqual([0.5, false]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary()))
      .toEqual(`root: (1 loaded, 0 errors) / (1 to load) = 1/1
 - type-foo: (1 loaded, 0 errors) / (1 to load) = 1/1
wss://example.com: (0 loaded, 0 errors) / (1 to load) = 0/1
 - type-bar: (0 loaded, 0 errors) / (1 to load) = 0/1`);

    documentRef1LoadingProgressManager.completedLoadingAsset(innerDocRef1);
    expect(documentRef1LoadingProgressCallback).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenCalledTimes(8);
    expect(manager.toSummary()).toEqual({
      initialLoad: true,
      innerDocuments: [
        [
          "wss://example.com",
          {
            initialLoad: true,
            innerDocuments: [],
            summary: {
              totalErrored: 0,
              totalLoaded: 1,
              totalToLoad: 1,
            },
            summaryByType: {
              "type-bar": {
                assetErrors: [],
                totalErrored: 0,
                totalLoaded: 1,
                totalToLoad: 1,
              },
            },
          },
        ],
      ],
      summary: {
        totalErrored: 0,
        totalLoaded: 1,
        totalToLoad: 1,
      },
      summaryByType: {
        "type-foo": {
          assetErrors: [],
          totalErrored: 0,
          totalLoaded: 1,
          totalToLoad: 1,
        },
      },
    });
    expect(manager.toRatio()).toEqual([1, true]);
    expect(LoadingProgressManager.LoadingProgressSummaryToString(manager.toSummary()))
      .toEqual(`root: (1 loaded, 0 errors) / (1 to load) = 1/1
 - type-foo: (1 loaded, 0 errors) / (1 to load) = 1/1
wss://example.com: (1 loaded, 0 errors) / (1 to load) = 1/1
 - type-bar: (1 loaded, 0 errors) / (1 to load) = 1/1`);
  });
});
