import { createCanvas } from "@napi-rs/canvas";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import path from "path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { expect } from "vitest";

interface SnapshotOptions {
  failureThresholdType?: "percent" | "pixel";
  failureThreshold?: number;
  customSnapshotIdentifier?: (info: { defaultIdentifier: string }) => string;
}

// Track snapshot counts per test to support multiple snapshots in the same test
const snapshotCounters = new Map<string, number>();

/**
 * Create a composite image showing Expected, Actual, and Diff side by side with labels
 */
function saveCompositeDiffImage(
  expectedPixels: Uint8Array,
  actualPixels: Uint8Array,
  diffPixels: Uint8Array,
  outputPath: string,
  width: number,
  height: number,
): void {
  const labelHeight = 60;
  const padding = 20;
  const compositeWidth = width * 3 + padding * 4;
  const compositeHeight = height + labelHeight + padding * 2;

  const composite = new PNG({
    width: compositeWidth,
    height: compositeHeight,
    filterType: -1,
  });

  // Fill background with dark gray
  for (let y = 0; y < compositeHeight; y++) {
    for (let x = 0; x < compositeWidth; x++) {
      const idx = (y * compositeWidth + x) * 4;
      composite.data[idx] = 0x2a;
      composite.data[idx + 1] = 0x2a;
      composite.data[idx + 2] = 0x2a;
      composite.data[idx + 3] = 255;
    }
  }

  const copyImage = (sourcePixels: Uint8Array, xOffset: number, yOffset: number) => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * 4;
        const dstX = xOffset + x;
        const dstY = yOffset + y;
        const dstIdx = (dstY * compositeWidth + dstX) * 4;

        composite.data[dstIdx] = sourcePixels[srcIdx];
        composite.data[dstIdx + 1] = sourcePixels[srcIdx + 1];
        composite.data[dstIdx + 2] = sourcePixels[srcIdx + 2];
        composite.data[dstIdx + 3] = sourcePixels[srcIdx + 3];
      }
    }
  };

  // Create labels using canvas
  const labelCanvas = createCanvas(compositeWidth, labelHeight + padding * 2);
  const ctx = labelCanvas.getContext("2d");

  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(0, 0, compositeWidth, labelHeight + padding * 2);

  const drawLabel = (text: string, xOffset: number) => {
    const centerX = xOffset + width / 2;
    const centerY = padding + labelHeight / 2;

    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width || 150;
    const bgPadding = 16;

    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(
      centerX - textWidth / 2 - bgPadding,
      centerY - 20 - bgPadding / 2,
      textWidth + bgPadding * 2,
      40 + bgPadding,
    );

    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 3;
    ctx.strokeRect(
      centerX - textWidth / 2 - bgPadding,
      centerY - 20 - bgPadding / 2,
      textWidth + bgPadding * 2,
      40 + bgPadding,
    );

    ctx.fillStyle = "#00ff00";
    ctx.fillText(text, centerX, centerY);
  };

  drawLabel("EXPECTED", padding);
  drawLabel("ACTUAL", width + padding * 2);
  drawLabel("DIFF", width * 2 + padding * 3);

  // Get label canvas as PNG and copy to composite
  const labelBuffer = labelCanvas.toBuffer("image/png");
  const labelPng = PNG.sync.read(labelBuffer);

  for (let y = 0; y < labelHeight + padding * 2; y++) {
    for (let x = 0; x < compositeWidth; x++) {
      const srcIdx = (y * compositeWidth + x) * 4;
      const dstIdx = (y * compositeWidth + x) * 4;
      composite.data[dstIdx] = labelPng.data[srcIdx];
      composite.data[dstIdx + 1] = labelPng.data[srcIdx + 1];
      composite.data[dstIdx + 2] = labelPng.data[srcIdx + 2];
      composite.data[dstIdx + 3] = labelPng.data[srcIdx + 3];
    }
  }

  // Copy the three images below the labels
  const imageYOffset = labelHeight + padding;
  copyImage(expectedPixels, padding, imageYOffset);
  copyImage(actualPixels, width + padding * 2, imageYOffset);
  copyImage(diffPixels, width * 2 + padding * 3, imageYOffset);

  // Write composite image
  writeFileSync(outputPath, PNG.sync.write(composite));
  console.log(`Diff image created: ${outputPath}`);
}

export function toMatchImageSnapshot(received: Buffer | Uint8Array, options: SnapshotOptions = {}) {
  const { failureThresholdType = "percent", failureThreshold = 0.025 } = options;

  const state = expect.getState();
  const testPath = state.testPath ?? "";
  const testName = state.currentTestName ?? "";
  const renderer = process.env.RENDERER || "threejs";

  // Use __dirname-relative path for snapshot directory to avoid issues with vitest's testPath
  const snapshotDir = path.join(__dirname, "__image_snapshots__");
  const diffOutputDir = path.join(snapshotDir, "__diff_output__");

  // Create identifier from test file name and test name
  // Match old naming: replace all dots (including .ts) with dashes
  const testFileName = path.basename(testPath).replace(/\./g, "-");
  const testKey = `${testFileName}-${testName}`;

  // Track snapshot count for this test (for multiple snapshots in same test)
  const currentCount = (snapshotCounters.get(testKey) ?? 0) + 1;
  snapshotCounters.set(testKey, currentCount);

  // Include counter in defaultIdentifier so customSnapshotIdentifier gets it
  const defaultIdentifier = `${testFileName}-${testName}`
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-") // Collapse multiple dashes into one
    .toLowerCase()
    .concat(`-${currentCount}`);
  const identifier = options.customSnapshotIdentifier
    ? options.customSnapshotIdentifier({ defaultIdentifier })
    : `${defaultIdentifier}-${renderer}-snap`;

  const snapshotPath = path.join(snapshotDir, `${identifier}.png`);
  const diffPath = path.join(diffOutputDir, `${identifier}.png`);

  if (!existsSync(snapshotDir)) {
    mkdirSync(snapshotDir, { recursive: true });
  }
  if (!existsSync(diffOutputDir)) {
    mkdirSync(diffOutputDir, { recursive: true });
  }

  const receivedBuffer = Buffer.isBuffer(received) ? received : Buffer.from(received);
  const receivedImage = PNG.sync.read(receivedBuffer);

  // Update mode or first run
  if (process.env.UPDATE_SNAPSHOTS || !existsSync(snapshotPath)) {
    writeFileSync(snapshotPath, receivedBuffer);
    // Clean up any existing diff image when updating snapshot
    if (existsSync(diffPath)) {
      unlinkSync(diffPath);
    }
    return {
      pass: true,
      message: () =>
        `Snapshot ${existsSync(snapshotPath) ? "updated" : "created"}: ${snapshotPath}`,
    };
  }

  const expectedImage = PNG.sync.read(readFileSync(snapshotPath));

  // Check dimensions match
  if (
    receivedImage.width !== expectedImage.width ||
    receivedImage.height !== expectedImage.height
  ) {
    return {
      pass: false,
      message: () =>
        `Image dimensions don't match. Expected ${expectedImage.width}x${expectedImage.height}, got ${receivedImage.width}x${receivedImage.height}.`,
    };
  }

  const { width, height } = receivedImage;
  const diff = new PNG({ width, height });

  const mismatchedPixels = pixelmatch(
    expectedImage.data,
    receivedImage.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 },
  );

  const totalPixels = width * height;
  const mismatchPercentage = (mismatchedPixels / totalPixels) * 100;

  let pass: boolean;
  if (failureThresholdType === "percent") {
    pass = mismatchPercentage <= failureThreshold * 100;
  } else {
    pass = mismatchedPixels <= failureThreshold;
  }

  if (!pass) {
    // Create composite diff image showing Expected, Actual, and Diff side by side
    saveCompositeDiffImage(
      new Uint8Array(expectedImage.data),
      new Uint8Array(receivedImage.data),
      new Uint8Array(diff.data),
      diffPath,
      width,
      height,
    );
  } else {
    // Clean up any existing diff image when test passes
    if (existsSync(diffPath)) {
      unlinkSync(diffPath);
      console.log(`Removed old diff image: ${diffPath}`);
    }
  }

  return {
    pass,
    message: () =>
      pass
        ? "Images match"
        : `Image mismatch: ${mismatchPercentage.toFixed(2)}% difference (${mismatchedPixels} pixels).\nDiff image: ${diffPath}`,
  };
}

// Extend expect with custom matcher types
declare module "vitest" {
  interface Assertion {
    toMatchImageSnapshot(options?: SnapshotOptions): void;
  }
  interface AsymmetricMatchersContaining {
    toMatchImageSnapshot(options?: SnapshotOptions): void;
  }
}
