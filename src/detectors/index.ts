import type { SecretDetector } from "../types.js";

import {
  cloudflareTokenDetector,
  digitalOceanTokenDetector,
  dockerTokenDetector,
  huggingFaceTokenDetector,
  linearTokenDetector,
  pypiTokenDetector,
  slackTokenDetector,
  stripeTokenDetector,
  supabaseTokenDetector,
  vercelTokenDetector,
} from "./additional-providers.js";
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
  cloudflareTokenDetector,
  connectionStringDetector,
  digitalOceanTokenDetector,
  dockerTokenDetector,
  genericTokenDetector,
  githubTokenDetector,
  gitlabTokenDetector,
  huggingFaceTokenDetector,
  jwtDetector,
  linearTokenDetector,
  openAiTokenDetector,
  privateKeyDetector,
  pypiTokenDetector,
  shopifyTokenDetector,
  slackTokenDetector,
  stripeTokenDetector,
  supabaseTokenDetector,
  vaultTokenDetector,
  vercelTokenDetector,
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
  stripeTokenDetector,
  slackTokenDetector,
  pypiTokenDetector,
  huggingFaceTokenDetector,
  dockerTokenDetector,
  cloudflareTokenDetector,
  digitalOceanTokenDetector,
  linearTokenDetector,
  supabaseTokenDetector,
  vercelTokenDetector,
  jwtDetector,
  bearerTokenDetector,
  connectionStringDetector,
  genericTokenDetector,
]);
