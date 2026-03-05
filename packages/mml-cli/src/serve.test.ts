import { EventEmitter } from "events";

// --- Mocks ---

const mockDocument = {
  load: vi.fn(),
  addWebSocket: vi.fn(),
  removeWebSocket: vi.fn(),
  dispose: vi.fn(),
};

vi.mock("@mml-io/networked-dom-server", () => {
  return {
    EditableNetworkedDOM: vi.fn().mockImplementation(function () {
      return mockDocument;
    }),
    LocalObservableDOMFactory: {},
  };
});

const mockWatcher = new EventEmitter();
vi.mock("chokidar", () => ({
  watch: vi.fn(() => mockWatcher),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(),
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
  detectFormat: vi.fn((filePath: string) => {
    if (filePath.endsWith(".js")) return "js";
    if (filePath.endsWith(".html") || filePath.endsWith(".htm")) return "html";
    return null;
  }),
  fileContentsToHtml: vi.fn((raw: string, format: string) =>
    format === "js" ? `<body><script>\n${raw}\n</script></body>` : raw,
  ),
}));

import { EditableNetworkedDOM } from "@mml-io/networked-dom-server";
import * as chokidar from "chokidar";
import * as fs from "fs";

import { serve } from "./serve.js";
import { clientPage, createServer, detectFormat } from "./server.js";

function getCloseHandler(ws: { on: ReturnType<typeof vi.fn> }): () => void {
  const call = ws.on.mock.calls.find((c: any[]) => c[0] === "close");
  if (!call) throw new Error("close handler not registered");
  return call[1] as () => void;
}

function getRouteHandler(path: string): (...args: any[]) => void {
  const call = mockApp.get.mock.calls.find((c: any[]) => c[0] === path);
  if (!call) throw new Error(`GET handler for ${path} not registered`);
  return call[1] as (...args: any[]) => void;
}

describe("serve", () => {
  let mockProcessExit: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const defaultOptions = {
    port: 7079,
    host: "127.0.0.1",
    watch: true,
    client: true,
    format: "detect" as const,
    assetsUrlPath: "/assets/",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Default: file exists and has content
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("<m-cube></m-cube>");
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    mockWatcher.removeAllListeners();
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
  });

  describe("file not found", () => {
    test("calls process.exit(1) when file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      serve("nonexistent.html", defaultOptions);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("File not found"));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    test("logs error message with file path when file is missing", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      serve("nonexistent.html", defaultOptions);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("nonexistent.html"));
    });
  });

  describe("format detection", () => {
    test("exits with error when format is detect and extension is unsupported", () => {
      vi.mocked(detectFormat).mockReturnValueOnce(null);

      serve("test.txt", defaultOptions);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Cannot detect format"));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    test("uses explicit html format regardless of extension", () => {
      vi.mocked(fs.readFileSync).mockReturnValue("plain text");

      serve("test.txt", { ...defaultOptions, format: "html" });

      expect(mockDocument.load).toHaveBeenCalledWith("plain text");
    });

    test("uses explicit js format regardless of extension", () => {
      vi.mocked(fs.readFileSync).mockReturnValue("const x = 1;");

      serve("test.txt", { ...defaultOptions, format: "js" });

      expect(mockDocument.load).toHaveBeenCalledWith(
        "<body><script>\nconst x = 1;\n</script></body>",
      );
    });
  });

  describe("document creation", () => {
    test("creates EditableNetworkedDOM with file URL", () => {
      serve("test.html", defaultOptions);

      expect(EditableNetworkedDOM).toHaveBeenCalledWith(
        expect.stringContaining("test.html"),
        expect.anything(),
        false,
      );
    });

    test("loads file contents into the document", () => {
      vi.mocked(fs.readFileSync).mockReturnValue("<m-sphere></m-sphere>");

      serve("test.html", defaultOptions);

      expect(mockDocument.load).toHaveBeenCalledWith("<m-sphere></m-sphere>");
    });

    test("reads file contents with utf8 encoding", () => {
      serve("test.html", defaultOptions);

      expect(fs.readFileSync).toHaveBeenCalledWith(expect.any(String), "utf8");
    });

    test("wraps JS file contents in a script tag", () => {
      vi.mocked(fs.readFileSync).mockReturnValue('document.createElement("m-cube");');

      serve("test.js", defaultOptions);

      expect(mockDocument.load).toHaveBeenCalledWith(
        '<body><script>\ndocument.createElement("m-cube");\n</script></body>',
      );
    });

    test("does not wrap HTML file contents in a script tag", () => {
      vi.mocked(fs.readFileSync).mockReturnValue("<m-cube></m-cube>");

      serve("test.html", defaultOptions);

      expect(mockDocument.load).toHaveBeenCalledWith("<m-cube></m-cube>");
    });
  });

  describe("watch mode", () => {
    test("sets up chokidar watcher when watch is true", () => {
      serve("test.html", defaultOptions);

      expect(chokidar.watch).toHaveBeenCalledWith(expect.stringContaining("test.html"));
    });

    test("reloads document on file change", () => {
      serve("test.html", defaultOptions);

      // Simulate file change
      vi.mocked(fs.readFileSync).mockReturnValue("<m-cube color='red'></m-cube>");
      mockWatcher.emit("change");

      expect(mockDocument.load).toHaveBeenCalledTimes(2); // initial + change
      expect(mockDocument.load).toHaveBeenLastCalledWith("<m-cube color='red'></m-cube>");
    });

    test("logs message on file change", () => {
      serve("test.html", defaultOptions);

      mockWatcher.emit("change");

      expect(consoleLogSpy).toHaveBeenCalledWith("File changed, reloading...");
    });

    test("wraps JS file contents in a script tag on reload", () => {
      vi.mocked(fs.readFileSync).mockReturnValue("const x = 1;");

      serve("test.js", defaultOptions);

      // Simulate file change
      vi.mocked(fs.readFileSync).mockReturnValue("const x = 2;");
      mockWatcher.emit("change");

      expect(mockDocument.load).toHaveBeenLastCalledWith(
        "<body><script>\nconst x = 2;\n</script></body>",
      );
    });

    test("does not set up watcher when watch is false", () => {
      serve("test.html", { ...defaultOptions, watch: false });

      expect(chokidar.watch).not.toHaveBeenCalled();
    });
  });

  describe("WebSocket route", () => {
    test("registers /ws WebSocket route", () => {
      serve("test.html", defaultOptions);

      expect(mockApp.ws).toHaveBeenCalledWith("/ws", expect.any(Function));
    });

    test("adds WebSocket to document on connection", () => {
      serve("test.html", defaultOptions);

      const wsHandler = mockApp.ws.mock.calls[0][1];
      const mockWs = { on: vi.fn() };
      wsHandler(mockWs);

      expect(mockDocument.addWebSocket).toHaveBeenCalledWith(mockWs);
    });

    test("removes WebSocket from document on close", () => {
      serve("test.html", defaultOptions);

      const wsHandler = mockApp.ws.mock.calls[0][1];
      const mockWs = { on: vi.fn() };
      wsHandler(mockWs);

      // Get the close handler
      const closeHandler = getCloseHandler(mockWs);
      closeHandler();

      expect(mockDocument.removeWebSocket).toHaveBeenCalledWith(mockWs);
    });
  });

  describe("client mode", () => {
    test("sets up GET / route when client is true", () => {
      serve("test.html", defaultOptions);

      expect(mockApp.get).toHaveBeenCalledWith("/", expect.any(Function));
    });

    test("GET / sends client page with /ws path", () => {
      serve("test.html", defaultOptions);

      const getHandler = getRouteHandler("/");
      const mockRes = { send: vi.fn() };
      getHandler({}, mockRes);

      expect(clientPage).toHaveBeenCalledWith("/ws");
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining("client:/ws"));
    });

    test("does not set up GET / route when client is false", () => {
      serve("test.html", { ...defaultOptions, client: false });

      const getCalls = mockApp.get.mock.calls.filter((c: any[]) => c[0] === "/");
      expect(getCalls).toHaveLength(0);
    });
  });

  describe("server listening", () => {
    test("listens on configured port and host", () => {
      serve("test.html", { ...defaultOptions, port: 8080, host: "0.0.0.0" });

      expect(mockApp.listen).toHaveBeenCalledWith(8080, "0.0.0.0", expect.any(Function));
    });

    test("logs serving info on listen callback", () => {
      serve("test.html", defaultOptions);

      const listenCallback = mockApp.listen.mock.calls[0][2];
      listenCallback();

      const allOutput = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join("\n");
      expect(allOutput).toContain("Serving");
      expect(allOutput).toContain("ws://127.0.0.1:7079/ws");
    });

    test("logs client URL when client is enabled", () => {
      serve("test.html", defaultOptions);

      const listenCallback = mockApp.listen.mock.calls[0][2];
      listenCallback();

      const allOutput = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join("\n");
      expect(allOutput).toContain("http://127.0.0.1:7079");
    });

    test("does not log client URL when client is disabled", () => {
      serve("test.html", { ...defaultOptions, client: false });

      const listenCallback = mockApp.listen.mock.calls[0][2];
      listenCallback();

      const allOutput = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join("\n");
      expect(allOutput).not.toContain("Client url");
    });

    test("logs assets URL when assets are configured", () => {
      serve("test.html", { ...defaultOptions, assets: "./public", assetsUrlPath: "/static/" });

      const listenCallback = mockApp.listen.mock.calls[0][2];
      listenCallback();

      const allOutput = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join("\n");
      expect(allOutput).toContain("Assets served at");
    });

    test("does not log assets URL when assets are not configured", () => {
      serve("test.html", defaultOptions);

      const listenCallback = mockApp.listen.mock.calls[0][2];
      listenCallback();

      const allOutput = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join("\n");
      expect(allOutput).not.toContain("Assets served at");
    });

    test("logs watch message when watch is enabled", () => {
      serve("test.html", defaultOptions);

      const listenCallback = mockApp.listen.mock.calls[0][2];
      listenCallback();

      const allOutput = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join("\n");
      expect(allOutput).toContain("Watching for file changes");
    });

    test("does not log watch message when watch is disabled", () => {
      serve("test.html", { ...defaultOptions, watch: false });

      const listenCallback = mockApp.listen.mock.calls[0][2];
      listenCallback();

      const allOutput = consoleLogSpy.mock.calls.map((c: any[]) => c[0]).join("\n");
      expect(allOutput).not.toContain("Watching for file changes");
    });
  });

  describe("createServer integration", () => {
    test("passes options to createServer", () => {
      serve("test.html", {
        port: 9000,
        host: "0.0.0.0",
        format: "detect" as const,
        watch: true,
        client: true,
        assets: "./public",
        assetsUrlPath: "/static/",
      });

      expect(createServer).toHaveBeenCalledWith(
        expect.objectContaining({
          client: true,
          assets: "./public",
          assetsUrlPath: "/static/",
        }),
      );
    });
  });

  describe("process cleanup", () => {
    test("disposes document on SIGINT", () => {
      serve("test.html", defaultOptions);

      process.emit("SIGINT");

      expect(mockDocument.dispose).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalled();
    });

    test("disposes document on SIGTERM", () => {
      serve("test.html", defaultOptions);

      process.emit("SIGTERM");

      expect(mockDocument.dispose).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalled();
    });
  });
});
