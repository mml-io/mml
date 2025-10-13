// Mocks to be used via jest.mock in test files as needed
import * as modelLoaderMock from "./__mocks__/model-loader";
import * as skeletonUtilsMock from "./__mocks__/SkeletonUtils.js";

jest.mock("@mml-io/model-loader", () => modelLoaderMock);
jest.mock("three/examples/jsm/utils/SkeletonUtils.js", () => skeletonUtilsMock);
