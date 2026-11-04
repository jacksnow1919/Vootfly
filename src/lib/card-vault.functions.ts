import { createServerFn } from "@tanstack/react-start";
import type { VaultConfig } from "./card-vault.server";

/** The public key is safe in a browser: it can only create tokens, never read them. */
export const getCardVaultConfig = createServerFn({ method: "GET" }).handler(async (): Promise<VaultConfig | null> => {
  const { vaultConfig } = await import("./card-vault.server");
  return vaultConfig();
});
