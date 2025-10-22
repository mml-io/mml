export function waitFor(condition: () => true | string, timeout = 1000) {
  const stack = new Error().stack;
  return new Promise<void>((resolve, reject) => {
    const interval = setInterval(() => {
      const result = condition();
      if (result === true) {
        clearInterval(interval);
        resolve();
      }
    }, 10);
    setTimeout(() => {
      clearInterval(interval);
      const result = condition();
      if (result === true) {
        resolve();
      } else {
        reject(new Error(`waitFor timeout. ${result}. Stack: ${stack}`));
      }
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

export function normalizeV02ClientHtml(formattedClientHtml: string): string {
  // formattedClientHtml is a pretty-printed string that wraps the document HTML in a <div>…</div>
  const domParser = new DOMParser();
  const doc = domParser.parseFromString(formattedClientHtml, "text/html");
  const placeholders = doc.querySelectorAll("x-hidden");
  for (const el of placeholders) {
    el.remove();
  }
  const wrapper = doc.body.firstElementChild as HTMLElement | null;
  const outer = wrapper ? wrapper.outerHTML : formattedClientHtml;
  return normalizeAttributeOrder(outer);
}

export function normalizeAttributeOrder(htmlString: string): string {
  const domParser = new DOMParser();
  const doc = domParser.parseFromString(htmlString, "text/html");

  const reorderAttributes = (el: Element) => {
    const attrs = Array.from(el.attributes).map((a) => [a.name, a.value] as const);
    for (const a of Array.from(el.attributes)) {
      el.removeAttribute(a.name);
    }
    attrs
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .forEach(([name, value]) => el.setAttribute(name, value));
    for (const child of Array.from(el.children)) {
      reorderAttributes(child);
    }
  };

  const root = doc.body.firstElementChild ?? doc.documentElement;
  if (root) {
    reorderAttributes(root);
  }
  const outer =
    (doc.body.firstElementChild as HTMLElement | null)?.outerHTML ?? doc.documentElement.outerHTML;
  return formatHTML(outer);
}
