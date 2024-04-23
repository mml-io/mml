import { TextDecoder, TextEncoder } from "util";

import * as nodeFetch from "node-fetch";
import nodeFetchFn from "node-fetch";

(window as any).fetch = nodeFetchFn as unknown as typeof fetch;
(window as any).Headers = nodeFetch.Headers as unknown as typeof Headers;
(window as any).Request = nodeFetch.Request as unknown as typeof Request;
(window as any).Response = nodeFetch.Response as unknown as typeof Response;

(window as any).TextEncoder = TextEncoder;
(window as any).TextDecoder = TextDecoder;
