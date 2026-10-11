import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
);

const applications = [
    { name: "Backend", directory: "backend" },
    { name: "Frontend", directory: "frontend" }
];

const processes = [];
let stopping = false;

function stop(exitCode = 0) {
    if (stopping) return;

    stopping = true;
    process.exitCode = exitCode;

    for (const child of processes) {
        if (child.exitCode === null && !child.killed) {
            child.kill("SIGTERM");
        }
    }
}

for (const application of applications) {
    const child = spawn(
        process.platform === "win32" ? "npm.cmd" : "npm",
        ["start"],
        {
            cwd: path.join(rootDirectory, application.directory),
            stdio: "inherit",
            shell: process.platform === "win32"
        }
    );

    processes.push(child);

    child.on("error", error => {
        console.error(`${application.name}: ${error.message}`);
        stop(1);
    });

    child.on("exit", code => {
        if (!stopping) {
            console.error(`${application.name} stopped.`);
            stop(code || 1);
        }
    });
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());