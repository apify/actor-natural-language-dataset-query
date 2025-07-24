import { Actor, log, LogLevel } from "apify";
import { handleInput, type Input } from "./input";
import { runQuery } from "./engine";
import { runStandby } from "./standby";
import { ApifyApiError } from "apify-client";
import { z } from "zod";

async function runNormal() {
    let input: Input | null = null;
    try {
        input = await handleInput();
    } catch (e) {
        if (e instanceof SyntaxError) {
            log.error("Input JSON parse error", { error: e });
        } else if (e instanceof z.ZodError) {
            log.error("Input validation failed", { error: e });
        } else {
            log.error("Input unknown error", { error: e });
        }
        await Actor.exit({ statusMessage: "Input is invalid, please check the logs" });
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
