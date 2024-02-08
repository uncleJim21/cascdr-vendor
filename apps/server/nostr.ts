import { SimplePool, Event as NostrEvent, generatePrivateKey, finishEvent } from "nostr-tools";



export async function getPrivateKey(privateKeyPath: string): Promise<string>{
    const privateKeyFile = Bun.file(privateKeyPath); 
    if(await privateKeyFile.exists() && await privateKeyFile.text()){
        return await privateKeyFile.text();
    }

    const privateKey = generatePrivateKey();
    await Bun.write(privateKeyPath, privateKey);

    return privateKey;
}

export async function postServices(pool: SimplePool, privateKey: string, relays: string[], events: NostrEvent[], debug: boolean = false): Promise<void> {

    for(const event of events){
        console.log(event);
        // If debug is true, add the `debug` tag to sort out
        event.tags = [
            ...event.tags,
            (debug ? ['t', 'DEBUG'] : []),
        ];

        const signedEvent = finishEvent(event, privateKey);
        await pool.publish(relays, signedEvent);
    }
}