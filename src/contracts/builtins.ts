/**
 * Built-in contract: token transfer.
 *
 * State keys: "balance:<address>" -> number
 */
export const TRANSFER_CONTRACT = `
return {
  init(ctx, initialBalance) {
    ctx.set("balance:" + ctx.sender, initialBalance || 0);
    ctx.log("Account initialized with balance: " + (initialBalance || 0));
  },

  mint(ctx, amount) {
    if (typeof amount !== "number" || amount <= 0) throw new Error("Invalid amount");
    const key = "balance:" + ctx.sender;
    const current = ctx.get(key) || 0;
    ctx.set(key, current + amount);
    ctx.log("Minted " + amount + " to " + ctx.sender);
    return current + amount;
  },

  transfer(ctx, to, amount) {
    if (typeof amount !== "number" || amount <= 0) throw new Error("Invalid amount");
    if (!to) throw new Error("Recipient required");

    const fromKey = "balance:" + ctx.sender;
    const toKey = "balance:" + to;

    const fromBalance = ctx.get(fromKey) || 0;
    if (fromBalance < amount) throw new Error("Insufficient balance");

    const toBalance = ctx.get(toKey) || 0;
    ctx.set(fromKey, fromBalance - amount);
    ctx.set(toKey, toBalance + amount);
    ctx.log("Transfer " + amount + " from " + ctx.sender + " to " + to);
  },

  balance(ctx, address) {
    const key = "balance:" + (address || ctx.sender);
    return ctx.get(key) || 0;
  }
}
`;

/**
 * Built-in contract: simple key-value store with ownership.
 */
export const KV_STORE_CONTRACT = `
return {
  set(ctx, key, value) {
    const fullKey = "kv:" + key;
    const existing = ctx.get(fullKey + ":owner");
    if (existing && existing !== ctx.sender) throw new Error("Not owner of key: " + key);
    ctx.set(fullKey, value);
    ctx.set(fullKey + ":owner", ctx.sender);
  },

  get(ctx, key) {
    return ctx.get("kv:" + key);
  },

  del(ctx, key) {
    const owner = ctx.get("kv:" + key + ":owner");
    if (owner && owner !== ctx.sender) throw new Error("Not owner of key: " + key);
    ctx.del("kv:" + key);
    ctx.del("kv:" + key + ":owner");
  }
}
`;
