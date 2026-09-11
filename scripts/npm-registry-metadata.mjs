#!/usr/bin/env node
import { pathToFileURL } from "node:url";

// npm view consults aggregate package metadata, which can remain a cached 404
// after a first publication. Read the immutable version endpoint directly.
export async function viewPublished(name, version, request = fetch) {
  const url = new URL(`https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`);
  url.searchParams.set("release_check", Date.now().toString());
  const response = await request(url, {
    headers: { "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`${name}@${version}: registry returned HTTP ${response.status}`);
  const metadata = await response.json();
  if (metadata.name !== name || metadata.version !== version || !/^[a-f0-9]{40}$/.test(metadata.dist?.shasum ?? "")) {
    throw new Error(`${name}@${version}: invalid registry metadata`);
  }
  return metadata;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [name, version, expected] = process.argv.slice(2);
  if (!name || !version) throw new Error("usage: npm-registry-metadata.mjs <name> <version> [expected-shasum]");
  let metadata;
  for (let attempt = 0; attempt < (expected ? 12 : 1); attempt += 1) {
    metadata = await viewPublished(name, version);
    if (metadata || !expected) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  if (expected && metadata?.dist.shasum !== expected) throw new Error(`${name}@${version}: registry checksum does not match qualified content`);
  console.log(metadata?.dist.shasum ?? "unpublished");
}
