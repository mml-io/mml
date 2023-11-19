type AssetStatus = {
  type: string;
  assetUrl: string;
  progressRatio: number;
  loadStatus: boolean | Error;
};

type LoadingCountSummary = {
  totalLoaded: number;
  totalErrored: number;
  totalToLoad: number;
};

type LoadingProgressSummary = {
  initialLoad: boolean | Error;
  summary: LoadingCountSummary;
  summaryByType: { [key: string]: LoadingCountSummary & { assetErrors: Array<[string, Error]> } };
  innerDocuments: Array<[string, LoadingProgressSummary]>;
};

export class LoadingProgressManager {
  public summary: LoadingCountSummary = {
    totalLoaded: 0,
    totalErrored: 0,
    totalToLoad: 0,
  };

  public initialLoad: boolean | Error = false;

  public loadingAssets = new Map<unknown, AssetStatus>();
  public summaryByType = new Map<
    string,
    LoadingCountSummary & {
      assets: Map<unknown, AssetStatus>;
    }
  >();
  public loadingDocuments = new Map<
    unknown,
    { documentUrl: string; progressManager: LoadingProgressManager }
  >();

  private onProgressCallbacks = new Set<() => void>();

  constructor() {}

  public addProgressCallback(callback: () => void): void {
    this.onProgressCallbacks.add(callback);
  }

  public removeProgressCallback(callback: () => void): void {
    this.onProgressCallbacks.delete(callback);
  }

  private onProgress(): void {
    for (const callback of this.onProgressCallbacks) {
      callback();
    }
  }

  public addLoadingAsset(ref: unknown, url: string, type: string): void {
    if (this.loadingAssets.has(ref)) {
      throw new Error("Asset reference already exists");
    }
    const assetRecord: AssetStatus = { type, assetUrl: url, progressRatio: 0, loadStatus: false };
    this.loadingAssets.set(ref, assetRecord);

    let typeSummary = this.summaryByType.get(type);
    if (!typeSummary) {
      typeSummary = { totalLoaded: 0, totalToLoad: 0, totalErrored: 0, assets: new Map() };
      this.summaryByType.set(type, typeSummary);
    }
    typeSummary.assets.set(ref, assetRecord);
    typeSummary.totalToLoad++;
    this.summary.totalToLoad++;
    this.onProgress();
  }

  public setInitialLoad(result: true | Error): void {
    if (result instanceof Error) {
      this.initialLoad = result;
    } else {
      this.initialLoad = true;
    }
    this.onProgress();
  }

  public disposeOfLoadingAsset(ref: unknown): void {
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

  public errorLoadingAsset(ref: unknown, err: Error) {
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

  public updateAssetProgress(ref: unknown, progressRatio: number): void {
    const asset = this.loadingAssets.get(ref);
    if (asset) {
      asset.progressRatio = progressRatio;
      this.onProgress();
    }
  }

  public completedLoadingAsset(ref: unknown): void {
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

  public addLoadingDocument(
    ref: unknown,
    documentUrl: string,
    progressManager: LoadingProgressManager,
  ): void {
    this.loadingDocuments.set(ref, { documentUrl, progressManager });
    this.onProgress();
  }

  public removeLoadingDocument(ref: unknown): void {
    this.loadingDocuments.delete(ref);
    this.onProgress();
  }

  public updateDocumentProgress(ref: unknown): void {
    const loadingDocument = this.loadingDocuments.get(ref);
    if (loadingDocument) {
      this.onProgress();
    }
  }

  public toSummary(): LoadingProgressSummary {
    const loadingProgressSummary: LoadingProgressSummary = {
      initialLoad: this.initialLoad,
      summary: { ...this.summary },
      summaryByType: {},
      innerDocuments: [],
    };

    for (const [key, ofType] of this.summaryByType) {
      const ofTypeSummary: LoadingCountSummary & { assetErrors: Array<[string, Error]> } = {
        totalToLoad: ofType.totalToLoad,
        totalLoaded: ofType.totalLoaded,
        totalErrored: ofType.totalErrored,
        assetErrors: [],
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
        innerDocProgress.progressManager.toSummary(),
      ]);
    }
    return loadingProgressSummary;
  }

  public static LoadingProgressSummaryToString(
    loadingProgressSummary: LoadingProgressSummary,
  ): string {
    const text: Array<string> = [];
    const showDocProgress = (docUrl: string, docProgress: LoadingProgressSummary) => {
      if (docProgress.initialLoad instanceof Error) {
        text.push(`${docUrl}: Error: ${docProgress.initialLoad.message}`);
        return;
      } else if (!docProgress.initialLoad) {
        text.push(`${docUrl}: Loading...`);
        return;
      }
      text.push(
        `${docUrl}: (${docProgress.summary.totalLoaded} loaded, ${
          docProgress.summary.totalErrored
        } errors) / (${docProgress.summary.totalToLoad} to load) = ${
          docProgress.summary.totalLoaded + docProgress.summary.totalErrored
        }/${docProgress.summary.totalToLoad}`,
      );
      for (const key in docProgress.summaryByType) {
        const ofType = docProgress.summaryByType[key];
        text.push(
          ` - ${key}: (${ofType.totalLoaded} loaded, ${ofType.totalErrored} errors) / (${
            ofType.totalToLoad
          } to load) = ${ofType.totalLoaded + ofType.totalErrored}/${ofType.totalToLoad}`,
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

  public toRatio(): [number, boolean] {
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
      // There are no assets to load and no inner documents, so loading is complete
      return [1, true];
    }

    for (const [, innerDocument] of this.loadingDocuments) {
      const [innerDocumentRatio, innerDocumentComplete] = innerDocument.progressManager.toRatio();
      totalRatio += innerDocumentRatio / numberOfDocuments;
      complete = complete && innerDocumentComplete;
    }

    return [totalRatio, complete];
  }
}
