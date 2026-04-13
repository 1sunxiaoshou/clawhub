#!/usr/bin/env bun

import { generateKeyPairSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function parseArgs(argv: string[]) {
  let kid = `prod-${Date.now()}`;
  let dryRun = false;
  let prod = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--kid") {
      const next = argv[i + 1];
      if (!next) throw new Error("Missing value for --kid");
      kid = next;
      i += 1;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--prod") {
      prod = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      return { help: true as const };
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { help: false as const, kid, dryRun, prod };
}

function generateAuthKeys(kid: string) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicJwk = publicKey.export({ format: "jwk" }) as JsonWebKey & {
    use?: string;
    alg?: string;
    kid?: string;
  };

  publicJwk.use = "sig";
  publicJwk.alg = "RS256";
  publicJwk.kid = kid;

  return {
    JWT_PRIVATE_KEY: privatePem,
    JWKS: JSON.stringify({ keys: [publicJwk] }),
  };
}

function printHelp() {
  console.log(`Generate and apply Convex Auth signing keys to the current deployment.

Usage:
  bun scripts/apply-convex-auth-keys.ts [options]

Options:
  --kid <value>   Override the key id used in JWKS
  --dry-run       Print the commands without executing them
  --prod          Apply to the production deployment
  -h, --help      Show this help text

Requires a configured CONVEX_DEPLOYMENT, or pass --prod to target the production deployment.
`);
}

function runConvexEnvSetFromFile(envFilePath: string, useProd: boolean) {
  const args = ["convex", "env", "set", "--from-file", envFilePath, "--force"];
  if (useProd) {
    args.push("--prod");
  }

  const result = spawnSync("bunx", args, {
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error("Failed to set Convex env values");
  }
}

async function main() {
  const parsed = parseArgs(Bun.argv.slice(2));
  if (parsed.help) {
    printHelp();
    return;
  }

  const keys = generateAuthKeys(parsed.kid);

  if (parsed.dryRun) {
    console.log("bunx convex env set --from-file <temp-env-file> --force");
    if (parsed.prod) {
      console.log("(with --prod)");
    }
    return;
  }

  const tempDir = mkdtempSync(join(tmpdir(), "clawhub-convex-auth-"));
  const tempEnvPath = join(tempDir, "auth.env");
  const tempEnvContent = [
    `JWT_PRIVATE_KEY=${JSON.stringify(keys.JWT_PRIVATE_KEY)}`,
    `JWKS=${JSON.stringify(keys.JWKS)}`,
    "",
  ].join("\n");

  try {
    writeFileSync(tempEnvPath, tempEnvContent, "utf8");
    console.log("Applying JWT_PRIVATE_KEY and JWKS...");
    runConvexEnvSetFromFile(tempEnvPath, parsed.prod);
    console.log("Done.");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

await main();
