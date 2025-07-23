import { Actor, log, LogLevel } from "apify";
import { handleInput } from "./input";
import { runQuery } from "./engine";
import { runStandby } from "./standby";
import { ApifyApiError } from "apify-client";

async function runNormal() {
    const input = await handleInput();
    if (!input) {
        log.error("Input is invalid");
        await Actor.exit({ statusMessage: "Input is invalid" });
        return;
    }
    if (input.debug) log.setLevel(LogLevel.DEBUG);
    try {
        await runQuery(input);
    } catch (error) {
        if (
            error instanceof ApifyApiError &&
            error.message.includes("not found")
        ) {
            log.error("Dataset not found", { datasetId: input.dataset });
            await Actor.exit({ statusMessage: "Dataset not found" });
            return;
        }
        throw error; // Re-throw unexpected errors
    }

    await Actor.exit();
}

async function main() {
    await Actor.init();
    if (process.env.APIFY_META_ORIGIN === "STANDBY") {
        log.info("Running in standby mode");
        runStandby();
        return;
    }
    await runNormal();
}

await main();
