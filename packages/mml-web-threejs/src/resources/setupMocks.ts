// Mocks to be used via vi.mock in test files as needed
import { vi } from "vitest";

import * as modelLoaderMock from "./__mocks__/model-loader";
import * as skeletonUtilsMock from "./__mocks__/SkeletonUtils.js";

vi.mock("@mml-io/model-loader", () => modelLoaderMock);
vi.mock("three/examples/jsm/utils/SkeletonUtils.js", () => skeletonUtilsMock);
