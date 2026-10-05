import { createRequire } from "node:module";

/** The package's own version, read once, so both servers agree with npm. */
export const VERSION: string = (createRequire(import.meta.url)("../package.json") as { version: string }).version;
