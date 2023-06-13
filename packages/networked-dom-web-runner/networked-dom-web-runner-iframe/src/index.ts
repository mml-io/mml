import { setupIframeWebRunner } from "./IframeWebRunner";

const args = (window as any).args;
setupIframeWebRunner(args);
