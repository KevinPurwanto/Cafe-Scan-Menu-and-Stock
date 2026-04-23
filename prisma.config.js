"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const config_1 = require("prisma/config");
function loadEnvFileIfPresent(envPath) {
    if (!node_fs_1.default.existsSync(envPath))
        return;
    const raw = node_fs_1.default.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0)
            continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!key)
            continue;
        if (process.env[key] === undefined)
            process.env[key] = value;
    }
}
loadEnvFileIfPresent(node_path_1.default.resolve(process.cwd(), ".env"));
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
}
exports.default = (0, config_1.defineConfig)({
    schema: "prisma/schema.prisma",
    seed: "tsx prisma/seed.ts"
});
