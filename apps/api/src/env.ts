import { config } from "dotenv";
import { resolve } from "node:path";

// Workspace commands run with apps/api as cwd, while the canonical env file is at repo root.
config({ path: resolve(__dirname, "../../../.env") });
