import esbuild from "esbuild";
import process from "process";
import { readFileSync, copyFileSync, existsSync, mkdirSync } from "fs";
import { resolve, join } from "path";

const prod = process.argv[2] === "production";

/** Read OBSIDIAN_PLUGIN_DIR from .env (if exists) */
function loadPluginDir() {
    const envPath = resolve(".env");
    if (!existsSync(envPath)) return null;
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed.startsWith("#") || !trimmed) continue;
        const match = trimmed.match(/^OBSIDIAN_PLUGIN_DIR\s*=\s*(.+)$/);
        if (match) return match[1].replace(/^["']|["']$/g, "").trim();
    }
    return null;
}

/** Copy build artifacts to vault plugin directory */
function copyToVault() {
    const pluginDir = loadPluginDir();
    if (!pluginDir) return;

    if (!existsSync(pluginDir)) {
        mkdirSync(pluginDir, { recursive: true });
    }

    const files = ["main.js", "manifest.json", "styles.css"];
    for (const file of files) {
        if (existsSync(file)) {
            copyFileSync(file, join(pluginDir, file));
            console.log(`[gfm-anchor] Copied ${file} → ${pluginDir}`);
        }
    }
}

const context = await esbuild.context({
    entryPoints: ["src/main.ts"],
    bundle: true,
    external: [
        "obsidian",
        "electron",
        "@codemirror/autocomplete",
        "@codemirror/collab",
        "@codemirror/commands",
        "@codemirror/language",
        "@codemirror/lint",
        "@codemirror/search",
        "@codemirror/state",
        "@codemirror/view",
        "@lezer/common",
        "@lezer/highlight",
        "@lezer/lr",
    ],
    format: "cjs",
    target: "es2022",
    logLevel: "info",
    sourcemap: prod ? false : "inline",
    treeShaking: true,
    outfile: "main.js",
    plugins: [
        {
            name: "copy-to-vault",
            setup(build) {
                build.onEnd(() => {
                    copyToVault();
                });
            },
        },
    ],
});

if (prod) {
    await context.rebuild();
    process.exit(0);
} else {
    await context.watch();
}
