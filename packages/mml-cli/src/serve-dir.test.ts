import { EventEmitter } from "events";

// --- Mocks ---

let mockDocumentIdCounter = 0;
const mockDocumentInstances: Array<{
  id: number;
  load: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
  addWebSocket: ReturnType<typeof vi.fn>;
  removeWebSocket: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("@mml-io/networked-dom-server", () => ({
  EditableNetworkedDOM: vi.fn().mockImplementation(function () {
    const doc = {
      id: mockDocumentIdCounter++,
      load: vi.fn(),
      reload: vi.fn(),
      addWebSocket: vi.fn(),
      removeWebSocket: vi.fn(),
      dispose: vi.fn(),
    };
    mockDocumentInstances.push(doc);
    return doc;
  }),
  LocalObservableDOMFactory: {},
}));

class MockWatcher extends EventEmitter {
  // chokidar returns itself from on() for chaining
  on(event: string, handler: (...args: any[]) => void): this {
    super.on(event, handler);
    return this;
  }
}

let mockWatcher: MockWatcher;

vi.mock("chokidar", () => ({
  watch: vi.fn(() => {
    mockWatcher = new MockWatcher();
    return mockWatcher;
  }),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
}));

const mockApp = {
  enable: vi.fn(),
  use: vi.fn(),
  get: vi.fn(),
  ws: vi.fn(),
  listen: vi.fn(),
};

vi.mock("./server.js", () => ({
  createServer: vi.fn(() => mockApp),
  clientPage: vi.fn((wsPath: string) => `<html>client:${wsPath}</html>`),
  normalizeUrlPath: vi.fn((p: string) => (p.startsWith("/") ? p : `/${p}`)),
}));

import { EditableNetworkedDOM } from "@mml-io/networked-dom-server";
import * as chokidar from "chokidar";
import * as fs from "fs";

import { serveDir } from "./serve-dir.js";
import { clientPage } from "./server.js";

// --- Helpers ---

function getWsHandler(): (...args: any[]) => void {
  const call = mockApp.ws.mock.calls.find((c: any[]) => c[0] === "/:documentPath");
  if (!call) throw new Error("WebSocket handler for /:documentPath not registered");
  return call[1] as (...args: any[]) => void;
}

function getRouteHandler(path: string): (...args: any[]) => void {
  const call = mockApp.get.mock.calls.find((c: any[]) => c[0] === path);
  if (!call) throw new Error(`GET handler for ${path} not registered`);
  return call[1] as (...args: any[]) => void;
}

function getCloseHandler(ws: { on: ReturnType<typeof vi.fn> }): () => void {
  const call = ws.on.mock.calls.find((c: any[]) => c[0] === "close");
  if (!call) throw new Error("close handler not registered");
  return call[1] as () => void;
}

describe("serveDir", () => {
  let mockProcessExit: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const defaultOptions = {
    port: 7079,
    host: "127.0.0.1",
    client: true,
    assetsUrlPath: "/assets/",
    idleTimeout: 60,
    reset: false,
    defineGlobals: false,
    delay: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDocumentIdCounter = 0;
    mockDocumentInstances.length = 0;

    mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Default: directory exists
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
    vi.mocked(fs.readFileSync).mockReturnValue("<m-cube></m-cube>");
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.useRealTimers();
  });

  describe("directory validation", () => {
    test("calls process.exit(1) when directory does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      serveDir("nonexistent", defaultOptions);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Directory not found"));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    test("calls process.exit(1) when path is not a directory", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);

      serveDir("somefile.txt", defaultOptions);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Directory not found"));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("chokidar watcher", () => {
    test("watches directory with depth 0", () => {
      serveDir("mydir", defaultOptions);

      expect(chokidar.watch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          depth: 0,
          persistent: true,
        }),
      );
    });

    test("filters to only .html files via ignored option", () => {
      serveDir("mydir", defaultOptions);

      const watchOptions = vi.mocked(chokidar.watch).mock.calls[0][1] as any;
      const ignored = watchOptions.ignored;

      // A .html file should NOT be ignored
      expect(ignored("test.html", { isFile: () => true })).toBe(false);

      // A .txt file should be ignored
      expect(ignored("test.txt", { isFile: () => true })).toBe(true);

      // Directories should not be ignored (even without .html extension)
      expect(ignored("subdir", { isFile: () => false })).toBe(false);

      // Paths without stats should not be ignored
      expect(ignored("something")).toBe(false);
    });
  });

  describe("document add event", () => {
    test("reads file and logs addition", () => {
      vi.mocked(fs.readFileSync).mockReturnValue("<m-sphere />");

      serveDir("mydir", defaultOptions);
      mockWatcher.emit("add", "/abs/path/mydir/test.html");

      expect(fs.readFileSync).toHaveBeenCalledWith("/abs/path/mydir/test.html", "utf8");
      expect(consoleLogSpy).toHaveBeenCalledWith("Document added: test.html");
    });

    test("does not create EditableNetworkedDOM on add (lazy loading)", () => {
      serveDir("mydir", defaultOptions);
      mockWatcher.emit("add", "/abs/path/mydir/test.html");

      expect(EditableNetworkedDOM).not.toHaveBeenCalled();
    });
  });

  describe("document change event", () => {
    test("updates stored contents and logs change", () => {
      serveDir("mydir", defaultOptions);
      mockWatcher.emit("add", "/abs/path/mydir/test.html");

      vi.mocked(fs.readFileSync).mockReturnValue("<m-cube color='blue' />");
      mockWatcher.emit("change", "/abs/path/mydir/test.html");

      expect(consoleLogSpy).toHaveBeenCalledWith("Document changed: test.html");
    });

    test("reloads document if it is loaded", () => {
      serveDir("mydir", defaultOptions);
      mockWatcher.emit("add", "/abs/path/mydir/test.html");

      // Trigger a WebSocket connection to load the document
      const wsHandler = getWsHandler();
      const mockWs = { on: vi.fn(), close: vi.fn() };
      wsHandler(mockWs, { params: { documentPath: "test.html" } });

      // Now change the file
      vi.mocked(fs.readFileSync).mockReturnValue("<m-cube color='red' />");
      mockWatcher.emit("change", "/abs/path/mydir/test.html");

      // The loaded document should have load called with new contents
      const doc = mockDocumentInstances[0];
      expect(doc.load).toHaveBeenLastCalledWith("<m-cube color='red' />");
    });

    test("does not call load if document is not loaded", () => {
      serveDir("mydir", defaultOptions);
      mockWatcher.emit("add", "/abs/path/mydir/test.html");

      // Change without any WebSocket connection (document not loaded)
      vi.mocked(fs.readFileSync).mockReturnValue("<m-cube color='green' />");
      mockWatcher.emit("change", "/abs/path/mydir/test.html");

      // No documents should have been created
      expect(mockDocumentInstances).toHaveLength(0);
    });
  });

  describe("document unlink event", () => {
    test("disposes loaded document and removes from registry", () => {
      serveDir("mydir", defaultOptions);
      mockWatcher.emit("add", "/abs/path/mydir/test.html");

      // Load the document via WebSocket
      const wsHandler = getWsHandler();
      const mockWs = { on: vi.fn(), close: vi.fn() };
      wsHandler(mockWs, { params: { documentPath: "test.html" } });

      const doc = mockDocumentInstances[0];

      // Unlink the file
      mockWatcher.emit("unlink", "/abs/path/mydir/test.html");

      expect(doc.dispose).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith("Document removed: test.html");
    });

    test("handles unlink of non-loaded document", () => {
      serveDir("mydir", defaultOptions);
      mockWatcher.emit("add", "/abs/path/mydir/test.html");

      // Unlink without loading
      mockWatcher.emit("unlink", "/abs/path/mydir/test.html");

      expect(consoleLogSpy).toHaveBeenCalledWith("Document removed: test.html");
    });
  });

  describe("lazy document loading via WebSocket", () => {
    test("creates document on first WebSocket connection", () => {
      serveDir("mydir", defaultOptions);
      mockWatcher.emit("add", "/abs/path/mydir/doc.html");

      const wsHandler = getWsHandler();
      const mockWs = { on: vi.fn(), close: vi.fn() };
      wsHandler(mockWs, { params: { documentPath: "doc.html" } });

      expect(EditableNetworkedDOM).toHaveBeenCalledTimes(1);
      expect(mockDocumentInstances[0].load).toHaveBeenCalledWith("<m-cube></m-cube>");
    });

    test("reuses existing document for subsequent connections", () => {
      serveDir("mydir", defaultOptions);
      mockWatcher.emit("add", "/abs/path/mydir/doc.html");

      const wsHandler = getWsHandler();

      const ws1 = { on: vi.fn(), close: vi.fn() };
      wsHandler(ws1, { params: { documentPath: "doc.html" } });

      const ws2 = { on: vi.fn(), close: vi.fn() };
      wsHandler(ws2, { params: { documentPath: "doc.html" } });

      // Only one document created
      expect(EditableNetworkedDOM).toHaveBeenCalledTimes(1);
    });

    test("closes WebSocket for unknown document path", () => {
      serveDir("mydir", defaultOptions);

      const wsHandler = getWsHandler();
      const mockWs = { on: vi.fn(), close: vi.fn() };
      wsHandler(mockWs, { params: { documentPath: "nonexistent.html" } });

      expect(mockWs.close).toHaveBeenCalled();
    });
  });

  describe("connection management", () => {
    test("adds WebSocket to document on connection", () => {
      serveDir("mydir", defaultOptions);
      mockWatcher.emit("add", "/abs/path/mydir/doc.html");

      const wsHandler = getWsHandler();
      const mockWs = { on: vi.fn(), close: vi.fn() };
      wsHandler(mockWs, { params: { documentPath: "doc.html" } });

      expect(mockDocumentInstances[0].addWebSocket).toHaveBeenCalledWith(mockWs);
    });

    test("removes WebSocket from document on close", () => {
      serveDir("mydir", defaultOptions);
      mockWatcher.emit("add", "/abs/path/mydir/doc.html");

      const wsHandler = getWsHandler();
      const mockWs = { on: vi.fn(), close: vi.fn() };
      wsHandler(mockWs, { params: { documentPath: "doc.html" } });

      const closeHandler = getCloseHandler(mockWs);
      closeHandler();

      expect(mockDocumentInstances[0].removeWebSocket).toHaveBeenCalledWith(mockWs);
    });
  });

  describe("idle timeout", () => {
    test("disposes document after idle timeout when last connection closes", () => {
      vi.useFakeTimers();

      serveDir("mydir", { ...defaultOptions, idleTimeout: 30 });
      mockWatcher.emit("add", "/abs/path/mydir/doc.html");

      // Connect
      const wsHandler = getWsHandler();
      const mockWs = { on: vi.fn(), close: vi.fn() };
      wsHandler(mockWs, { params: { documentPath: "doc.html" } });

      const doc = mockDocumentInstances[0];

      // Disconnect
      const closeHandler = getCloseHandler(mockWs);
      closeHandler();

      // Document should not be disposed yet
      expect(doc.dispose).not.toHaveBeenCalled();

      // Advance time past idle timeout
      vi.advanceTimersByTime(30_000);

      expect(doc.dispose).toHaveBeenCalled();
    });

    test("cancels idle timer when new connection arrives", () => {
      vi.useFakeTimers();

      serveDir("mydir", { ...defaultOptions, idleTimeout: 30 });
      mockWatcher.emit("add", "/abs/path/mydir/doc.html");

      const wsHandler = getWsHandler();

      // First connection
      const ws1 = { on: vi.fn(), close: vi.fn() };
      wsHandler(ws1, { params: { documentPath: "doc.html" } });

      // Disconnect first
      const closeHandler1 = getCloseHandler(ws1);
      closeHandler1();

      // Advance time partially
      vi.advanceTimersByTime(15_000);

      // New connection before timeout
      const ws2 = { on: vi.fn(), close: vi.fn() };
      wsHandler(ws2, { params: { documentPath: "doc.html" } });

      // Advance past original timeout
      vi.advanceTimersByTime(20_000);

      // Document should NOT be disposed since a new connection arrived
      expect(mockDocumentInstances[0].dispose).not.toHaveBeenCalled();
    });

    test("does not start idle timer when idleTimeout is 0", () => {
      vi.useFakeTimers();

      serveDir("mydir", { ...defaultOptions, idleTimeout: 0 });
      mockWatcher.emit("add", "/abs/path/mydir/doc.html");

      const wsHandler = getWsHandler();
      const mockWs = { on: vi.fn(), close: vi.fn() };
      wsHandler(mockWs, { params: { documentPath: "doc.html" } });

      // Disconnect
      const closeHandler = getCloseHandler(mockWs);
      closeHandler();

      // Advance a long time
      vi.advanceTimersByTime(600_000);

      // Document should NOT be disposed
      expect(mockDocumentInstances[0].dispose).not.toHaveBeenCalled();
    });

    test("does not start idle timer while connections remain", () => {
      vi.useFakeTimers();

      serveDir("mydir", { ...defaultOptions, idleTimeout: 10 });
      mockWatcher.emit("add", "/abs/path/mydir/doc.html");

      const wsHandler = getWsHandler();

      // Two connections
      const ws1 = { on: vi.fn(), close: vi.fn() };
      wsHandler(ws1, { params: { documentPath: "doc.html" } });

      const ws2 = { on: vi.fn(), close: vi.fn() };
      wsHandler(ws2, { params: { documentPath: "doc.html" } });

      // Close first connection
      const closeHandler1 = getCloseHandler(ws1);
      closeHandler1();

      // Advance past timeout
      vi.advanceTimersByTime(15_000);

      // Document should NOT be disposed — still has one connection
      expect(mockDocumentInstances[0].dispose).not.toHaveBeenCalled();
    });

    test("re-creates document after idle disposal on new connection", () => {
      vi.useFakeTimers();

      serveDir("mydir", { ...defaultOptions, idleTimeout: 5 });
      mockWatcher.emit("add", "/abs/path/mydir/doc.html");

      const wsHandler = getWsHandler();

      // First connection + disconnect
      const ws1 = { on: vi.fn(), close: vi.fn() };
      wsHandler(ws1, { params: { documentPath: "doc.html" } });
      const closeHandler1 = getCloseHandler(ws1);
      closeHandler1();

      // Wait for disposal
      vi.advanceTimersByTime(5_000);
      expect(mockDocumentInstances).toHaveLength(1);
      expect(mockDocumentInstances[0].dispose).toHaveBeenCalled();

      // New connection — should create a new document
      const ws2 = { on: vi.fn(), close: vi.fn() };
      wsHandler(ws2, { params: { documentPath: "doc.html" } });

      expect(mockDocumentInstances).toHaveLength(2);
      expect(mockDocumentInstances[1].load).toHaveBeenCalled();
    });
  });

  describe("index page (GET /)", () => {
    test("registers GET / route", () => {
      serveDir("mydir", defaultOptions);

      expect(mockApp.get).toHaveBeenCalledWith("/", expect.any(Function));
    });

    test("returns HTML listing documents", () => {
      serveDir("mydir", defaultOptions);
      mockWatcher.emit("add", "/abs/path/mydir/alpha.html");
      mockWatcher.emit("add", "/abs/path/mydir/beta.html");

      const handler = getRouteHandler("/");
      const mockRes = { send: vi.fn() };
      handler({}, mockRes);

      const html = mockRes.send.mock.calls[0][0] as string;
      expect(html).toContain("MML Documents");
      expect(html).toContain("alpha.html");
      expect(html).toContain("beta.html");
    });

    test("documents are sorted alphabetically", () => {
      serveDir("mydir", defaultOptions);
      mockWatcher.emit("add", "/abs/path/mydir/zebra.html");
      mockWatcher.emit("add", "/abs/path/mydir/apple.html");

      const handler = getRouteHandler("/");
      const mockRes = { send: vi.fn() };
      handler({}, mockRes);

      const html = mockRes.send.mock.calls[0][0] as string;
      const appleIdx = html.indexOf("apple.html");
      const zebraIdx = html.indexOf("zebra.html");
      expect(appleIdx).toBeLessThan(zebraIdx);
    });

    test("shows stopped status for unloaded documents", () => {
      serveDir("mydir", defaultOptions);
      mockWatcher.emit("add", "/abs/path/mydir/doc.html");

      const handler = getRouteHandler("/");
      const mockRes = { send: vi.fn() };
      handler({}, mockRes);

      const html = mockRes.send.mock.calls[0][0] as string;
      // The JSON data embedded in the page should show running: false
      expect(html).toContain('"running":false');
    });

    test("shows running status for loaded documents", () => {
      serveDir("mydir", defaultOptions);
      mockWatcher.emit("add", "/abs/path/mydir/doc.html");

      // Load via WebSocket connection
      const wsHandler = getWsHandler();
      const mockWs = { on: vi.fn(), close: vi.fn() };
      wsHandler(mockWs, { params: { documentPath: "doc.html" } });

      const handler = getRouteHandler("/");
      const mockRes = { send: vi.fn() };
      handler({}, mockRes);

      const html = mockRes.send.mock.calls[0][0] as string;
      expect(html).toContain('"running":true');
      expect(html).toContain('"connections":1');
    });

    test("shows empty message when no documents", () => {
      serveDir("mydir", defaultOptions);

      const handler = getRouteHandler("/");
      const mockRes = { send: vi.fn() };
      handler({}, mockRes);

      const html = mockRes.send.mock.calls[0][0] as string;
      expect(html).toContain("No documents found");
    });
  });

  describe("client pages (GET /:documentPath/)", () => {
    test("serves client page for existing document when client enabled", () => {
      serveDir("mydir", defaultOptions);
      mockWatcher.emit("add", "/abs/path/mydir/doc.html");

      const handler = getRouteHandler("/:documentPath/");
      const mockRes = { send: vi.fn(), status: vi.fn(() => mockRes) };
      handler({ params: { documentPath: "doc.html" } }, mockRes);

      expect(clientPage).toHaveBeenCalledWith("/doc.html", false);
      expect(mockRes.send).toHaveBeenCalled();
    });

    test("returns 404 for non-existent document", () => {
      serveDir("mydir", defaultOptions);

      const handler = getRouteHandler("/:documentPath/");
      const mockRes = { send: vi.fn(), status: vi.fn(() => mockRes) };
      handler({ params: { documentPath: "nonexistent.html" } }, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    test("does not register client route when client is disabled", () => {
      serveDir("mydir", { ...defaultOptions, client: false });

      const getDocHandler = mockApp.get.mock.calls.find((c: any[]) => c[0] === "/:documentPath/");
      expect(getDocHandler).toBeUndefined();
    });
  });

  describe("reset endpoint (GET /:documentPath/reset)", () => {
    test("registers reset route when reset is true", () => {
      serveDir("mydir", { ...defaultOptions, reset: true });

      const resetHandler = mockApp.get.mock.calls.find(
        (c: any[]) => c[0] === "/:documentPath/reset",
      );
      expect(resetHandler).toBeDefined();
    });

    test("does not register reset route when reset is false", () => {
      serveDir("mydir", { ...defaultOptions, reset: false });

      const resetHandler = mockApp.get.mock.calls.find(
        (c: any[]) => c[0] === "/:documentPath/reset",
      );
      expect(resetHandler).toBeUndefined();
    });

    test("reloads an already-loaded document", () => {
      serveDir("mydir", { ...defaultOptions, reset: true });
      mockWatcher.emit("add", "/abs/path/mydir/doc.html");

      // Load the document via WebSocket
      const wsHandler = getWsHandler();
      const mockWs = { on: vi.fn(), close: vi.fn() };
      wsHandler(mockWs, { params: { documentPath: "doc.html" } });

      const doc = mockDocumentInstances[0];

      // Call the reset endpoint
      const handler = getRouteHandler("/:documentPath/reset");
      const mockRes = { send: vi.fn(), status: vi.fn(() => mockRes), redirect: vi.fn() };
      handler({ params: { documentPath: "doc.html" }, query: {} }, mockRes);

      expect(doc.reload).toHaveBeenCalled();
      expect(mockRes.redirect).toHaveBeenCalledWith("/doc.html/");
    });

    test("loads but does not reload a previously unloaded document", () => {
      serveDir("mydir", { ...defaultOptions, reset: true });
      mockWatcher.emit("add", "/abs/path/mydir/doc.html");

      // Do NOT load via WebSocket — document is not yet loaded

      const handler = getRouteHandler("/:documentPath/reset");
      const mockRes = { send: vi.fn(), status: vi.fn(() => mockRes), redirect: vi.fn() };
      handler({ params: { documentPath: "doc.html" }, query: {} }, mockRes);

      // Should have created the document (ensureDocumentLoaded)
      expect(EditableNetworkedDOM).toHaveBeenCalledTimes(1);
      // Should NOT call reload since it was freshly loaded
      expect(mockDocumentInstances[0].reload).not.toHaveBeenCalled();
      expect(mockRes.redirect).toHaveBeenCalled();
    });

    test("returns 404 for unknown document path", () => {
      serveDir("mydir", { ...defaultOptions, reset: true });

      const handler = getRouteHandler("/:documentPath/reset");
      const mockRes = { send: vi.fn(), status: vi.fn(() => mockRes), redirect: vi.fn() };
      handler({ params: { documentPath: "nonexistent.html" }, query: {} }, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    test("preserves query string on redirect", () => {
      serveDir("mydir", { ...defaultOptions, reset: true });
      mockWatcher.emit("add", "/abs/path/mydir/doc.html");

      const handler = getRouteHandler("/:documentPath/reset");
      const mockRes = { send: vi.fn(), status: vi.fn(() => mockRes), redirect: vi.fn() };
      handler({ params: { documentPath: "doc.html" }, query: { foo: "bar" } }, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith("/doc.html/?foo=bar");
    });
  });

  describe("server listening", () => {
    test("listens on configured port and host", () => {
      serveDir("mydir", { ...defaultOptions, port: 9090, host: "0.0.0.0" });

      expect(mockApp.listen).toHaveBeenCalledWith(9090, "0.0.0.0", expect.any(Function));
    });

    test("logs directory path and URL on listen", () => {
      serveDir("mydir", defaultOptions);

      const listenCallback = mockApp.listen.mock.calls[0][2] as () => void;
      listenCallback();

      const allOutput = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join("\n");
      expect(allOutput).toContain("Serving directory");
      expect(allOutput).toContain("http://127.0.0.1:7079");
    });

    test("logs assets URL when assets configured", () => {
      serveDir("mydir", { ...defaultOptions, assets: "./public", assetsUrlPath: "/static/" });

      const listenCallback = mockApp.listen.mock.calls[0][2] as () => void;
      listenCallback();

      const allOutput = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join("\n");
      expect(allOutput).toContain("Assets served at");
    });

    test("always logs watch message", () => {
      serveDir("mydir", defaultOptions);

      const listenCallback = mockApp.listen.mock.calls[0][2] as () => void;
      listenCallback();

      const allOutput = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join("\n");
      expect(allOutput).toContain("Watching for file changes");
    });
  });

  describe("watcher error handling", () => {
    test("logs errors from chokidar watcher", () => {
      serveDir("mydir", defaultOptions);

      const error = new Error("watch ENOSPC");
      mockWatcher.emit("error", error);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error watching directory:", error);
    });
  });

  describe("unlink during idle timeout", () => {
    test("clears idle timer when file is unlinked", () => {
      vi.useFakeTimers();

      serveDir("mydir", { ...defaultOptions, idleTimeout: 30 });
      mockWatcher.emit("add", "/abs/path/mydir/doc.html");

      // Connect and disconnect to start idle timer
      const wsHandler = getWsHandler();
      const mockWs = { on: vi.fn(), close: vi.fn() };
      wsHandler(mockWs, { params: { documentPath: "doc.html" } });
      const closeHandler = getCloseHandler(mockWs);
      closeHandler();

      // Unlink the file before timeout
      mockWatcher.emit("unlink", "/abs/path/mydir/doc.html");

      const doc = mockDocumentInstances[0];
      expect(doc.dispose).toHaveBeenCalledTimes(1);

      // Advancing timer should NOT cause another dispose
      vi.advanceTimersByTime(30_000);
      expect(doc.dispose).toHaveBeenCalledTimes(1);
    });
  });
});
