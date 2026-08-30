import type { SecretDetector } from "../types.js";

import { anthropicTokenDetector } from "./anthropic.js";
import { awsAccessKeyDetector } from "./aws.js";
import { bearerTokenDetector } from "./bearer-token.js";
import { connectionStringDetector } from "./connection-string.js";
import { genericTokenDetector } from "./generic-token.js";
import { githubTokenDetector } from "./github.js";
import { gitlabTokenDetector } from "./gitlab.js";
import { jwtDetector } from "./jwt.js";
import { openAiTokenDetector } from "./openai.js";
import { privateKeyDetector } from "./private-key.js";
import { shopifyTokenDetector } from "./shopify.js";
import { vaultTokenDetector } from "./vault.js";

export {
  anthropicTokenDetector,
  awsAccessKeyDetector,
  bearerTokenDetector,
  connectionStringDetector,
  genericTokenDetector,
  githubTokenDetector,
  gitlabTokenDetector,
  jwtDetector,
  openAiTokenDetector,
  privateKeyDetector,
  shopifyTokenDetector,
  vaultTokenDetector,
};

export const builtInDetectors: readonly SecretDetector[] = Object.freeze([
  privateKeyDetector,
  awsAccessKeyDetector,
  githubTokenDetector,
  gitlabTokenDetector,
  openAiTokenDetector,
  anthropicTokenDetector,
  shopifyTokenDetector,
  vaultTokenDetector,
  jwtDetector,
  bearerTokenDetector,
  connectionStringDetector,
  genericTokenDetector,
]);
