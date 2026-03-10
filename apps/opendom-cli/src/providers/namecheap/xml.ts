export interface XmlErrorItem {
  code?: string;
  message: string;
}

export interface XmlTagMatch {
  raw: string;
  attrs: Record<string, string>;
  inner?: string;
}

function decodeEntities(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

export function parseAttributes(tagFragment: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match = regex.exec(tagFragment);
  while (match !== null) {
    attrs[match[1]] = decodeEntities(match[2]);
    match = regex.exec(tagFragment);
  }
  return attrs;
}

export function getApiStatus(xml: string): string {
  const match = xml.match(/<ApiResponse[^>]*Status="([^"]+)"[^>]*>/i);
  return (match?.[1] || "").toUpperCase();
}

export function getErrors(xml: string): XmlErrorItem[] {
  const errors: XmlErrorItem[] = [];
  const regex = /<Error(?:\s+Number="([^"]+)")?[^>]*>([\s\S]*?)<\/Error>/gi;
  let match = regex.exec(xml);
  while (match !== null) {
    errors.push({
      code: match[1],
      message: decodeEntities(match[2].trim()),
    });
    match = regex.exec(xml);
  }
  return errors;
}

export function findSelfClosingTags(
  xml: string,
  tagName: string,
): XmlTagMatch[] {
  const out: XmlTagMatch[] = [];
  const regex = new RegExp(`<${tagName}\\b([^>]*)\\/>`, "gi");
  let match = regex.exec(xml);
  while (match !== null) {
    out.push({
      raw: match[0],
      attrs: parseAttributes(match[1] || ""),
    });
    match = regex.exec(xml);
  }
  return out;
}

export function findTags(xml: string, tagName: string): XmlTagMatch[] {
  const out: XmlTagMatch[] = [];
  const regex = new RegExp(
    `<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`,
    "gi",
  );
  let match = regex.exec(xml);
  while (match !== null) {
    out.push({
      raw: match[0],
      attrs: parseAttributes(match[1] || ""),
      inner: decodeEntities((match[2] || "").trim()),
    });
    match = regex.exec(xml);
  }
  return out;
}

export function firstTagText(xml: string, tagName: string): string | undefined {
  const tags = findTags(xml, tagName);
  if (tags.length === 0) return undefined;
  return tags[0].inner;
}
