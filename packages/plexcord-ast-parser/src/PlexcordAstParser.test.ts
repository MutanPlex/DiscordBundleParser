import { assert, describe, expect, it } from "vitest";

import { ChildProcess, exec } from "node:child_process";
import { Dirent, PathLike, readFileSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import { PlexcordAstParser } from "./PlexcordAstParser";

const __dirname = import.meta.dirname;
const PLEXCORD_DIR = join(__dirname, "__test__", ".plexcord-source");
const PLEXCORD_REV = "5f62cc1043dcb1492098783a8038a29b49713412";

function parserFor(path: string): PlexcordAstParser {
    path = join(__dirname, "__test__", path);
    return new PlexcordAstParser(readFileSync(path, "utf-8"), path);
}

const IS_WINDOWS = process.platform === "win32";

describe("PlexcordAstParser", async function () {
    await ensurePlexcordDownloaded();

    // collect all plugin paths
    const pluginParsers = await Promise.all((await collectPluginPaths()).map(async (path) => new PlexcordAstParser(await readFile(path, "utf-8"), path)));

    describe("getPluginName", function () {
        it("parses all plugin names to non-null values", function () {
            for (const parser of pluginParsers) {
                const name = parser.getPluginName();

                expect(name, `Parsing plugin name failed for plugin at path ${parser.path}`).to.be.a("string");
            }
        });
        it("parses all plugin names correctly", function () {
            const names = pluginParsers.map((parser) => parser.getPluginName());

            // sort to keep snapshot sane && stable
            expect(names.toSorted())
                .toMatchSnapshot();
        });
        it.skip("gets the correct plugin name for a weird plugin", function () {
            const parser = parserFor("pluginImports.ts");

            expect(parser.getPluginName()).to.equal("2");
        });
    });
    describe("getPatches()", function () {
        it.skipIf(IS_WINDOWS)("gets the patches for all plugins", async function () {
            const patches = Object.fromEntries(
                pluginParsers
                    .map((parser) => [parser.getPluginName() ?? assert.fail("Plugin name is missing"), parser.getPatches()] as const)
                    .sort(([a], [b]) => a.localeCompare(b))
            );

            await expect(JSON.stringify(patches, null, 4))
                .toMatchFileSnapshot(join(__dirname, "__snapshots__", "allPatches.json"));
        });
    });
});

function waitForProcess(process: ChildProcess): Promise<void> {
    return new Promise<void>((res, rej) => {
        process.on("exit", (code) => {
            if (code === 0) {
                res();
            } else {
                rej(new Error(`Child process exited with code: ${code}`));
            }
        });
    });
}

async function ensurePlexcordDownloaded() {
    if (await exists(PLEXCORD_DIR) && await isDirectory(PLEXCORD_DIR)) {
        return;
    }


    await waitForProcess(exec(`git clone https://github.com/MutanPlex/Plexcord.git ${PLEXCORD_DIR}`));
    await waitForProcess(exec(`git checkout --detach ${PLEXCORD_REV}`, {
        cwd: PLEXCORD_DIR,
    }));
}

async function resolvePluginEntrypoint(pluginEntry: Dirent): Promise<string> {
    const pluginEntryPath = join(pluginEntry.parentPath, pluginEntry.name);

    if (pluginEntry.isFile()) {
        return pluginEntryPath;
    }

    let path = join(pluginEntryPath, "index.ts");

    if (await exists(path)) {
        return path;
    } else if (await exists(path = join(pluginEntryPath, "index.tsx"))) {
        return path;
    }
    throw new Error("No valid entry point found");
}

async function collectPluginPaths(): Promise<string[]> {
    const basePluginDir = join(PLEXCORD_DIR, "src", "plugins");
    const pluginDirs = [basePluginDir, join(basePluginDir, "_api"), join(basePluginDir, "_core")];

    for (const dir of pluginDirs) {
        assert(await isDirectory(dir));
    }

    const pluginFiles = await Promise.all(pluginDirs.map((dir) => readdir(dir, { withFileTypes: true })));

    return await Promise.all(pluginFiles
        .flat()
        .filter((dir) => {
            // don't match index.ts at root of plugin tree, it's not a plugin
            return dir.name[0] !== "_" && dir.name !== "index.ts";
        })
        .map(resolvePluginEntrypoint));
}

async function exists(path: PathLike) {
    try {
        return !!await stat(path);
    } catch {
        return false;
    }
}
/**
 * **PATH MUST EXIST**
 *
 * \@throws if the path doesnt exist
 *
 * use {@link exists} to check if it exists
 */
async function isDirectory(path: PathLike) {
    return (await stat(path)).isDirectory();
}
