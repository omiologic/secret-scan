import { calculateShannonEntropy } from "../entropy.js";
import type { SecretCandidate, SecretDetector } from "../types.js";

const CONNECTION_SCHEME_PATTERN =
  /(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqp|amqps):\/\//gi;
const MAX_PASSWORD_LENGTH = 4_096;
const MAX_AUTHORITY_LENGTH = 8_192;
const HEXADECIMAL = /^[0-9A-Fa-f]$/;
const USERINFO_CHARACTER = /^[A-Za-z0-9._~!$&'()*+,;=:-]$/;
const REG_NAME = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)(?:\.(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?))*$/;

function isPlaceholder(value: string): boolean {
  return /^(?:password|secret|example|sample|placeholder|redacted|changeme|<[^>]+>|\$\{[^}]+\})$/i.test(
    value,
  );
}

function hasValidUserInfoEncoding(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "%") {
      if (
        !HEXADECIMAL.test(value[index + 1] ?? "") ||
        !HEXADECIMAL.test(value[index + 2] ?? "")
      ) {
        return false;
      }
      index += 2;
    } else if (!USERINFO_CHARACTER.test(character ?? "")) {
      return false;
    }
  }
  return true;
}

function isValidIpv4(value: string): boolean {
  const parts = value.split(".");
  return (
    parts.length === 4 &&
    parts.every(
      (part) =>
        /^(?:0|[1-9][0-9]{0,2})$/.test(part) && Number(part) <= 255,
    )
  );
}

function isValidIpv6(value: string): boolean {
  if (!value.includes(":")) return false;
  const compression = value.indexOf("::");
  if (compression !== value.lastIndexOf("::")) return false;

  const sides = compression < 0 ? [value] : [value.slice(0, compression), value.slice(compression + 2)];
  const groups = sides.flatMap((side) => (side === "" ? [] : side.split(":")));
  if (groups.some((group) => group.length === 0)) return false;

  let units = 0;
  for (const [index, group] of groups.entries()) {
    if (group.includes(".")) {
      if (index !== groups.length - 1 || !isValidIpv4(group)) return false;
      units += 2;
    } else {
      if (!/^[0-9A-Fa-f]{1,4}$/.test(group)) return false;
      units += 1;
    }
  }
  return compression < 0 ? units === 8 : units < 8;
}

function isValidPort(value: string): boolean {
  return /^[0-9]{1,5}$/.test(value) && Number(value) <= 65_535;
}

function hasValidHostAndPort(value: string): boolean {
  if (value.startsWith("[")) {
    const close = value.indexOf("]");
    if (close < 0 || !isValidIpv6(value.slice(1, close))) return false;
    const suffix = value.slice(close + 1);
    return suffix === "" || (suffix.startsWith(":") && isValidPort(suffix.slice(1)));
  }

  const separator = value.lastIndexOf(":");
  const host = separator < 0 ? value : value.slice(0, separator);
  const port = separator < 0 ? undefined : value.slice(separator + 1);
  return REG_NAME.test(host) && (port === undefined || isValidPort(port));
}

function hasValidMongoHostList(value: string): boolean {
  const hosts = value.split(",");
  return hosts.length > 0 && hosts.every(hasValidHostAndPort);
}

function hasValidSrvHost(value: string): boolean {
  return (
    !value.includes(",") &&
    !value.includes(":") &&
    REG_NAME.test(value) &&
    value.split(".").length >= 3
  );
}

function hasValidHostForScheme(scheme: string, value: string): boolean {
  if (scheme === "mongodb") return hasValidMongoHostList(value);
  if (scheme === "mongodb+srv") return hasValidSrvHost(value);
  return hasValidHostAndPort(value);
}

function authorityEnd(input: string, start: number): number | undefined {
  let end = start;
  while (end < input.length && !/[\s/?#"'<>\\]/.test(input[end] ?? "")) {
    if (end - start >= MAX_AUTHORITY_LENGTH) return undefined;
    end += 1;
  }
  return end;
}

/**
 * Selects the original, undecoded password portion of credential-bearing URLs
 * for a bounded set of schemes. Requiring a valid credential-bearing
 * authority avoids classifying host-only and malformed URLs. Standard MongoDB
 * seed lists and Redis password-only authorities are handled explicitly;
 * unsupported schemes and placeholder passwords are false negatives by design.
 */
export const connectionStringDetector: SecretDetector = Object.freeze({
  id: "connection-string",
  detect(input: string): readonly SecretCandidate[] {
    const candidates: SecretCandidate[] = [];
    for (const match of input.matchAll(CONNECTION_SCHEME_PATTERN)) {
      const matchStart = match.index;
      if (matchStart === undefined) continue;
      if (
        matchStart > 0 &&
        /[A-Za-z0-9+.-]/.test(input[matchStart - 1] ?? "")
      ) {
        continue;
      }

      const scheme = match[0].slice(0, -3).toLowerCase();
      const userInfoStart = matchStart + match[0].length;
      const end = authorityEnd(input, userInfoStart);
      if (end === undefined) continue;
      const authority = input.slice(userInfoStart, end);
      const at = authority.indexOf("@");
      if (at <= 0 || at !== authority.lastIndexOf("@")) continue;

      const userInfo = authority.slice(0, at);
      const separator = userInfo.indexOf(":");
      const passwordOnlyRedis =
        separator === 0 && (scheme === "redis" || scheme === "rediss");
      if (
        separator < 0 ||
        (!passwordOnlyRedis && separator === 0) ||
        separator === userInfo.length - 1
      ) {
        continue;
      }
      const password = userInfo.slice(separator + 1);
      if (password.length > MAX_PASSWORD_LENGTH || isPlaceholder(password)) {
        continue;
      }
      if (
        !hasValidUserInfoEncoding(userInfo) ||
        !hasValidHostForScheme(scheme, authority.slice(at + 1))
      ) {
        continue;
      }

      const start = userInfoStart + separator + 1;
      const confidence =
        password.length >= 12 && calculateShannonEntropy(password) >= 2.5
          ? "high"
          : "medium";
      candidates.push({
        type: "connection_string_password",
        detector: "connection-string",
        confidence,
        specificity: "structural",
        signals: [
          "credential-bearing-authority",
          "supported-scheme",
          ...(passwordOnlyRedis ? ["redis-password-only"] : []),
          ...(scheme === "mongodb" && authority.includes(",")
            ? ["mongodb-seed-list"]
            : []),
        ],
        start,
        end: start + password.length,
      });
    }
    return candidates;
  },
});
