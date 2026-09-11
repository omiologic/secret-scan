import { test } from "node:test";
import assert from "node:assert/strict";
import { viewPublished } from "../npm-registry-metadata.mjs";

const name = "@redact-secret/test";
const version = "0.1.0-beta.1";
const metadata = { name, version, dist: { shasum: "a".repeat(40) } };
test("uses exact version endpoint without aggregate metadata or credentials", async () => {
  assert.deepEqual(await viewPublished(name, version, async (url, options) => {
    assert.equal(url.origin, "https://registry.npmjs.org");
    assert.equal(url.pathname, "/%40redact-secret%2Ftest/0.1.0-beta.1");
    assert.ok(url.searchParams.has("release_check"));
    assert.deepEqual(options.headers, { "Cache-Control": "no-cache" });
    return Response.json(metadata);
  }), metadata);
});
test("only 404 is unpublished; authorization and server errors fail closed", async () => {
  assert.equal(await viewPublished(name, version, async () => new Response(null, { status: 404 })), undefined);
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(viewPublished(name, version, async () => new Response(null, { status })), /registry returned HTTP/);
  }
});
test("rejects wrong package, version, and absent checksum", async () => {
  for (const data of [{ ...metadata, name: "wrong" }, { ...metadata, version: "wrong" }, { ...metadata, dist: {} }]) {
    await assert.rejects(viewPublished(name, version, async () => Response.json(data)), /invalid registry metadata/);
  }
});
