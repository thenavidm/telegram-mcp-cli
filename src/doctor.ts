/**
 * Diagnose a broken setup in plain language.
 *
 * This is what someone runs when nothing works yet, so every line says what is
 * wrong and what to do, never just a status.
 */

import { TelegramApi } from "./api/client.js";
import { loadConfig } from "./config.js";
import { activeProfile, toolsFor } from "./tools/index.js";

type Check = { name: string; ok: boolean; detail: string };

export async function doctor(): Promise<{ ok: boolean; checks: Check[] }> {
  const checks: Check[] = [];

  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  const session = process.env.TELEGRAM_SESSION;

  checks.push({
    name: "TELEGRAM_API_ID",
    ok: Boolean(apiId),
    detail: apiId ? "set" : "missing. Get one at https://my.telegram.org, API development tools.",
  });
  checks.push({
    name: "TELEGRAM_API_HASH",
    ok: Boolean(apiHash),
    detail: apiHash ? "set" : "missing. It comes with the api_id, same page.",
  });
  checks.push({
    name: "TELEGRAM_SESSION",
    ok: Boolean(session),
    detail: session ? "set" : "missing. Run: telegram-cli login",
  });

  const profile = activeProfile();
  checks.push({
    name: "profile",
    ok: true,
    detail: `${profile}, ${toolsFor(profile).length} tools advertised. TELEGRAM_TOOLS=full exposes every tool.`,
  });

  if (apiId && apiHash && session) {
    try {
      const config = loadConfig();
      const api = new TelegramApi(config);
      const me = await api.run(async (client) => client.getMe());
      const name = (me as unknown as { username?: string; firstName?: string });
      checks.push({
        name: "connection",
        ok: true,
        detail: `signed in as ${name.username ? "@" + name.username : name.firstName ?? "unknown"}`,
      });
      await api.disconnect();
    } catch (error) {
      checks.push({
        name: "connection",
        ok: false,
        detail: (error as Error).message,
      });
    }
  } else {
    checks.push({ name: "connection", ok: false, detail: "skipped, credentials incomplete" });
  }

  return { ok: checks.every((c) => c.ok), checks };
}

/** The `doctor` command: print every check and exit non-zero if any failed. */
export async function runDoctor(): Promise<number> {
  const { ok, checks } = await doctor();
  for (const check of checks) {
    process.stdout.write(`${check.ok ? "ok  " : "FAIL"}  ${check.name.padEnd(22)}${check.detail}\n`);
  }
  return ok ? 0 : 1;
}
