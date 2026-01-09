export function stripScriptTags(code: string): string {
  return code.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

export function ensureHTMLDocument(code: string): string {
  const hasHtmlTag = /<html[\s>]/i.test(code);
  const hasBodyTag = /<body[\s>]/i.test(code);

  let wrapped = code;
  if (!hasBodyTag) wrapped = `<body>${wrapped}</body>`;
  if (!hasHtmlTag) wrapped = `<html>${wrapped}</html>`;
  return wrapped;
}
