import { ApifyClient } from 'apify';
import type { ActorContext } from './types';

export async function getActorContext(actor: string): Promise<ActorContext> {
    const apifyClient = new ApifyClient({
        token: process.env.APIFY_TOKEN,
    });

    const actorObj = await apifyClient.actor(actor).get();
    if (!actorObj) {
        throw new Error(`Actor ${actor} not found`);
    }

    return {
        name: actorObj.title || actorObj.name,
        description: actorObj.description || '',
    };
}
