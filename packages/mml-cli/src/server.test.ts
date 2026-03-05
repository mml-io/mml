// Mock dependencies before importing the module under test
vi.mock("@mml-io/networked-dom-document", () => ({
  NetworkedDOM: {
    handleWebsocketSubprotocol: vi.fn(),
  },
}));

vi.mock("express", () => {
  const mockApp = {
    enable: vi.fn(),
    use: vi.fn(),
    get: vi.fn(),
    ws: vi.fn(),
    listen: vi.fn(),
  };
  const expressFn = vi.fn(() => mockApp);
  (expressFn as any).static = vi.fn((dir: string) => `static:${dir}`);
  return {
    default: expressFn,
    static: (expressFn as any).static,
  };
});

vi.mock("express-ws", () => ({
  default: vi.fn((app: any) => ({ app })),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:module", () => {
  const mockRequire = vi.fn((mod: string) => {
    if (mod === "@mml-io/mml-web-client") {
      return "/fake/client/build/index.js";
    }
    throw new Error(`Cannot find module '${mod}'`);
  }) as any;
  mockRequire.resolve = vi.fn((mod: string) => {
    if (mod === "@mml-io/mml-web-client") {
      return "/fake/client/build/index.js";
    }
    throw new Error(`Cannot find module '${mod}'`);
  });
  return {
    createRequire: vi.fn(() => mockRequire),
  };
});

import enableWs from "express-ws";
import * as fs from "fs";

import {
  clientPage,
  createServer,
  detectFormat,
  fileContentsToHtml,
  normalizeUrlPath,
} from "./server.js";

describe("normalizeUrlPath", () => {
  test("returns path unchanged if it already starts with /", () => {
    expect(normalizeUrlPath("/assets/")).toBe("/assets/");
  });

  test("prepends / if path does not start with /", () => {
    expect(normalizeUrlPath("assets/")).toBe("/assets/");
  });

  test("handles empty string", () => {
    expect(normalizeUrlPath("")).toBe("/");
  });

  test("handles path with multiple segments", () => {
    expect(normalizeUrlPath("assets/images")).toBe("/assets/images");
  });

  test("does not double-prepend /", () => {
    expect(normalizeUrlPath("/already/slashed")).toBe("/already/slashed");
  });
});

describe("detectFormat", () => {
  test("returns 'js' for .js files", () => {
    expect(detectFormat("app.js")).toBe("js");
  });

  test("returns 'js' for paths ending with .js", () => {
    expect(detectFormat("/some/path/bundle.js")).toBe("js");
  });

  test("returns 'html' for .html files", () => {
    expect(detectFormat("index.html")).toBe("html");
  });

  test("returns 'html' for paths ending with .html", () => {
    expect(detectFormat("/some/path/doc.html")).toBe("html");
  });

  test("returns 'html' for .htm files", () => {
    expect(detectFormat("index.htm")).toBe("html");
  });

  test("returns 'html' for paths ending with .htm", () => {
    expect(detectFormat("/some/path/doc.htm")).toBe("html");
  });

  test("returns null for .txt files", () => {
    expect(detectFormat("readme.txt")).toBeNull();
  });

  test("returns null for .mjs files", () => {
    expect(detectFormat("module.mjs")).toBeNull();
  });

  test("returns null for .jsx files", () => {
    expect(detectFormat("component.jsx")).toBeNull();
  });

  test("returns null for files with no extension", () => {
    expect(detectFormat("Makefile")).toBeNull();
  });
});

describe("fileContentsToHtml", () => {
  test("wraps content in script tags for js format", () => {
    expect(fileContentsToHtml("const x = 1;", "js")).toBe(
      "<body><script>\nconst x = 1;\n</script></body>",
    );
  });

  test("returns content unchanged for html format", () => {
    expect(fileContentsToHtml("<m-cube></m-cube>", "html")).toBe("<m-cube></m-cube>");
  });

  test("handles empty content for js format", () => {
    expect(fileContentsToHtml("", "js")).toBe("<body><script>\n\n</script></body>");
  });

  test("handles empty content for html format", () => {
    expect(fileContentsToHtml("", "html")).toBe("");
  });

  test("escapes </script in js content to prevent premature tag closing", () => {
    const content = 'document.write("</script><script>alert(1)");';
    const result = fileContentsToHtml(content, "js");
    expect(result).not.toContain("</script><script>");
    expect(result).toContain("<\\/script>");
  });

  test("escapes </script case-insensitively", () => {
    const content = 'x = "</Script>";';
    const result = fileContentsToHtml(content, "js");
    expect(result).not.toContain("</Script>");
    expect(result).toContain("<\\/Script>");
  });
});

describe("clientPage", () => {
  test("returns valid HTML with DOCTYPE", () => {
    const html = clientPage("/ws");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html>");
    expect(html).toContain("</html>");
  });

  test("embeds the wsPath in the script tag", () => {
    const html = clientPage("/ws");
    // The path is JSON.stringify'd so it appears as "/ws"
    expect(html).toContain("/ws");
  });

  test("references the client index.js", () => {
    const html = clientPage("/ws");
    expect(html).toContain("/client/index.js");
  });

  test("escapes < to \\u003c to prevent XSS", () => {
    const html = clientPage("</script><script>alert(1)");
    // The < should be escaped as \u003c
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c");
  });

  test("uses protocol detection for ws/wss", () => {
    const html = clientPage("/ws");
    expect(html).toContain('location.protocol === "https:"');
    expect(html).toContain('"wss:"');
    expect(html).toContain('"ws:"');
  });

  test("works with paths containing special characters", () => {
    const html = clientPage("/my-doc/path");
    expect(html).toContain("/my-doc/path");
  });
});

describe("createServer", () => {
  let mockApp: any;
  let mockProcessExit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApp = {
      enable: vi.fn(),
      use: vi.fn(),
      get: vi.fn(),
      ws: vi.fn(),
      listen: vi.fn(),
    };
    vi.mocked(enableWs).mockReturnValue({ app: mockApp } as any);
    mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
  });

  test("returns an express app with expected methods", () => {
    const app = createServer({ client: false, assetsUrlPath: "/assets/" });
    expect(app).toBe(mockApp);
    expect(app.enable).toHaveBeenCalledWith("trust proxy");
  });

  test("creates express-ws with WebSocket subprotocol handler", () => {
    createServer({ client: false, assetsUrlPath: "/assets/" });
    expect(enableWs).toHaveBeenCalledWith(expect.anything(), undefined, {
      wsOptions: {
        handleProtocols: expect.any(Function),
      },
    });
  });

  test("mounts /client/ static route when client is true", () => {
    createServer({ client: true, assetsUrlPath: "/assets/" });
    expect(mockApp.use).toHaveBeenCalledWith("/client/", expect.anything());
  });

  test("does not mount /client/ route when client is false", () => {
    createServer({ client: false, assetsUrlPath: "/assets/" });
    const clientCalls = mockApp.use.mock.calls.filter((call: any[]) => call[0] === "/client/");
    expect(clientCalls).toHaveLength(0);
  });

  test("mounts assets static route when assets path exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    createServer({
      client: false,
      assets: "./my-assets",
      assetsUrlPath: "/static/",
    });
    expect(mockApp.use).toHaveBeenCalledWith("/static/", expect.anything());
  });

  test("normalizes assets URL path without leading /", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    createServer({
      client: false,
      assets: "./my-assets",
      assetsUrlPath: "static/",
    });
    expect(mockApp.use).toHaveBeenCalledWith("/static/", expect.anything());
  });

  test("calls process.exit(1) when assets directory not found", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    createServer({
      client: false,
      assets: "./nonexistent",
      assetsUrlPath: "/assets/",
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Assets directory not found"),
    );
    expect(mockProcessExit).toHaveBeenCalledWith(1);
    consoleErrorSpy.mockRestore();
  });

  test("does not mount assets route when assets is undefined", () => {
    createServer({ client: false, assetsUrlPath: "/assets/" });
    // No use calls for assets
    const assetsCalls = mockApp.use.mock.calls.filter(
      (call: any[]) => typeof call[0] === "string" && call[0] !== "/client/",
    );
    expect(assetsCalls).toHaveLength(0);
  });

  test("registers CORS middleware that sets Access-Control-Allow-Origin", () => {
    createServer({ client: false, assetsUrlPath: "/assets/" });

    const functionMiddlewares = mockApp.use.mock.calls.filter(
      (call: any[]) => typeof call[0] === "function",
    );
    // CORS middleware is always registered
    expect(functionMiddlewares.length).toBeGreaterThanOrEqual(1);

    const corsMiddleware = functionMiddlewares[0][0];
    const mockRes = { header: vi.fn() };
    const next = vi.fn();
    corsMiddleware({}, mockRes, next);

    expect(mockRes.header).toHaveBeenCalledWith("Access-Control-Allow-Origin", "*");
    expect(next).toHaveBeenCalled();
  });

  test("registers delay middleware when delay is true", () => {
    createServer({ client: false, assetsUrlPath: "/assets/", delay: true });

    // Function middlewares: CORS + delay
    const middlewareCalls = mockApp.use.mock.calls.filter(
      (call: any[]) => typeof call[0] === "function",
    );
    expect(middlewareCalls).toHaveLength(2);
  });

  test("does not register delay middleware when delay is false", () => {
    createServer({ client: false, assetsUrlPath: "/assets/", delay: false });

    // Function middlewares: CORS only
    const middlewareCalls = mockApp.use.mock.calls.filter(
      (call: any[]) => typeof call[0] === "function",
    );
    expect(middlewareCalls).toHaveLength(1);
  });

  test("does not register delay middleware by default", () => {
    createServer({ client: false, assetsUrlPath: "/assets/" });

    // Function middlewares: CORS only
    const middlewareCalls = mockApp.use.mock.calls.filter(
      (call: any[]) => typeof call[0] === "function",
    );
    expect(middlewareCalls).toHaveLength(1);
  });

  test("delay middleware calls next immediately when no delay param", () => {
    createServer({ client: false, assetsUrlPath: "/assets/", delay: true });

    // Delay middleware is the second function middleware (after CORS)
    const functionMiddlewares = mockApp.use.mock.calls.filter(
      (call: any[]) => typeof call[0] === "function",
    );
    const delayMiddleware = functionMiddlewares[1][0];

    const next = vi.fn();
    delayMiddleware({ query: {} }, {}, next);
    expect(next).toHaveBeenCalled();
  });

  test("delay middleware calls next immediately for non-numeric delay", () => {
    createServer({ client: false, assetsUrlPath: "/assets/", delay: true });

    const functionMiddlewares = mockApp.use.mock.calls.filter(
      (call: any[]) => typeof call[0] === "function",
    );
    const delayMiddleware = functionMiddlewares[1][0];

    const next = vi.fn();
    delayMiddleware({ query: { delay: "abc" } }, {}, next);
    expect(next).toHaveBeenCalled();
  });

  test("delay middleware delays response for valid delay param", () => {
    vi.useFakeTimers();

    createServer({ client: false, assetsUrlPath: "/assets/", delay: true });

    const functionMiddlewares = mockApp.use.mock.calls.filter(
      (call: any[]) => typeof call[0] === "function",
    );
    const delayMiddleware = functionMiddlewares[1][0];

    const next = vi.fn();
    delayMiddleware({ query: { delay: "500" } }, {}, next);

    // next should not be called yet
    expect(next).not.toHaveBeenCalled();

    // Advance time
    vi.advanceTimersByTime(500);
    expect(next).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
