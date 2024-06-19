export function waitFor(condition: () => boolean, timeout = 1000) {
  return new Promise<void>((resolve, reject) => {
    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval);
        resolve();
      }
    }, 10);
    setTimeout(() => {
      clearInterval(interval);
      reject(new Error("waitFor timeout"));
    }, timeout);
  });
}

export function formatHTML(html: string) {
  const indentSpaces = "  ";
  let result = "";
  let indent = "";

  html.split(/>\s*</).forEach(function (element) {
    if (element.match(/^\/\w/)) {
      indent = indent.substring(indentSpaces.length);
    }

    result += indent + "<" + element + ">\r\n";

    if (element.match(/^<?\w[^>]*[^/]$/) && !element.startsWith("input")) {
      indent += indentSpaces;
    }
  });

  return result.substring(1, result.length - 3);
}

export function htmlStringWithFilters(htmlString: string): string {
  const domParser = new DOMParser();
  const doc = domParser.parseFromString(htmlString, "text/html");
  // Remove <script> tags
  const scripts = doc.querySelectorAll("script");
  for (const script of scripts) {
    script.remove();
  }
  const outerHtml = doc.documentElement.outerHTML;
  return outerHtml;
}
