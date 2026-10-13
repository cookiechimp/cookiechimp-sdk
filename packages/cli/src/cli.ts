#!/usr/bin/env node
import { main } from "./main";

void Promise.resolve(main(process.argv.slice(2))).then((code) => {
  process.exitCode = code;
});
