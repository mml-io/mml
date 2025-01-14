import { TextDecoder, TextEncoder } from "util";

(window as any).TextEncoder = TextEncoder;
(window as any).TextDecoder = TextDecoder;
