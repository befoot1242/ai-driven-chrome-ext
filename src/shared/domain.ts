// @trace DD-reminder-001 DD-task-002
import { getDomain } from "tldts";
import type { DomainKey } from "./domain-types";

export function normalizeHostname(hostname: string): string {
  if (
    !hostname ||
    /[\s/?#@\\]/u.test(hostname) ||
    (hostname.includes(":") && !(hostname.startsWith("[") && hostname.endsWith("]")))
  ) {
    throw new RangeError("ホスト名が不正です。");
  }
  let url: URL;
  try {
    url = new URL(`http://${hostname}/`);
  } catch (error) {
    if (error instanceof TypeError) throw new RangeError("ホスト名が不正です。");
    throw error;
  }
  if (!url.hostname || url.port || url.username || url.password) {
    throw new RangeError("ホスト名が不正です。");
  }
  return url.hostname;
}

export function getDomainKeyFromHostname(hostname: string): DomainKey {
  const normalized = normalizeHostname(hostname);
  const domain = getDomain(normalized, { allowPrivateDomains: true, extractHostname: false });
  return domain === null ? { kind: "host", value: normalized } : { kind: "domain", value: domain };
}

export function getDomainKey(input: string): DomainKey {
  let url: URL;
  try {
    url = new URL(input);
  } catch (error) {
    if (error instanceof TypeError) throw new RangeError("URLが不正です。");
    throw error;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new RangeError("HTTPまたはHTTPSのURLを指定してください。");
  }
  return getDomainKeyFromHostname(url.hostname);
}
