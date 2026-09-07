/**
 * Sign in once, print a session string.
 *
 * This is the only interactive part of the whole tool. Telegram authenticates a
 * user account by sending a code to an existing session, so there is no way to
 * do this non-interactively the first time.
 *
 * What comes out is full, non-expiring access to the account. It is printed
 * once and never written to a file here, because a credential this strong
 * should be placed deliberately rather than dropped in the working directory.
 */

import { createInterface } from "node:readline/promises";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { loadAppConfig } from "../config.js";

async function ask(question: string, mask = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    if (!mask) return (await rl.question(question)).trim();
    // The code and the 2FA password should not sit in a scrollback buffer.
    const hidden = rl as unknown as { output?: { write: (s: string) => void } };
    const answer = await rl.question(question);
    hidden.output?.write("\n");
    return answer.trim();
  } finally {
    rl.close();
  }
}

export async function runLogin(_argv: string[]): Promise<number> {
  const { apiId, apiHash } = loadAppConfig();

  // Everything a human reads goes to stderr, so that stdout carries only the
  // session string and `telegram-mcp login > session.txt` does the right thing.
  process.stderr.write("Signing in to Telegram.\n\n");

  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 3,
  });
  client.setLogLevel("none" as never);

  try {
    await client.start({
      phoneNumber: async () => ask("Phone number, with country code: "),
      phoneCode: async () => ask("Code Telegram just sent you: ", true),
      password: async () => ask("Two-step verification password: ", true),
      onError: (error) => {
        process.stderr.write(`${error.message}\n`);
      },
    });

    const session = (client.session as StringSession).save();
    const me = (await client.getMe()) as unknown as { username?: string; firstName?: string };

    process.stderr.write(
      `\nSigned in as ${me.username ? "@" + me.username : (me.firstName ?? "unknown")}.\n\n` +
        "Set this and keep it secret. It is full access to the account and does not expire:\n\n",
    );
    process.stdout.write(`${session}\n`);
    process.stderr.write("\n  export TELEGRAM_SESSION='<the string above>'\n\n");

    await client.disconnect();
    return 0;
  } catch (error) {
    process.stderr.write(`\nLogin failed: ${(error as Error).message}\n`);
    try {
      await client.disconnect();
    } catch {
      // Already failing; a disconnect error here would only mask the real one.
    }
    return 4;
  }
}
