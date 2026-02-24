import { Command } from "commander";
import { registerInit } from "./commands/init.js";
import { registerStart } from "./commands/start.js";
import { registerJoin } from "./commands/join.js";
import { registerStatus } from "./commands/status.js";
import { registerTx } from "./commands/tx.js";
import { registerQuery } from "./commands/query.js";
import { registerKeys } from "./commands/keys.js";
import { registerPeers } from "./commands/peers.js";

export function createCLI(): Command {
  const program = new Command();

  program
    .name("miniledger")
    .description("The SQLite of private blockchains")
    .version("0.1.0");

  registerInit(program);
  registerStart(program);
  registerJoin(program);
  registerStatus(program);
  registerTx(program);
  registerQuery(program);
  registerKeys(program);
  registerPeers(program);

  return program;
}

// Direct execution
const program = createCLI();
program.parse();
