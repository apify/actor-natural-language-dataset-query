import { Actor, log, LogLevel } from 'apify';
import { handleInput } from './input';
import { runQuery } from './engine';
import { runStandby } from './standby';


async function runNormal() {
    const input = await handleInput();
    if (!input) {
        log.error('Input is invalid');
        await Actor.exit({ statusMessage: 'Input is invalid' });
        return;
    }
    if (input.debug) log.setLevel(LogLevel.DEBUG);
    const response = await runQuery(input);

    if (!response) {
        await Actor.exit({ statusMessage: 'User query is not sane' });
        return;
    }

    await Actor.exit();

}

async function main() {
    await Actor.init();
    if (process.env.APIFY_META_ORIGIN === "STANDBY") {
        log.info('Running in standby mode');
        runStandby();
        return;
    }
    await runNormal();
}

await main();
