import { Event as NostrEvent} from 'nostr-tools';
import { NIP105ProcessInput, NIP105Service } from "../services";
import { OfferingStatus, createUnsignedServiceEvent } from 'nip105';

const API_KEY = (Bun.env.SD_API_KEY) as string;
const ENDPOINT = "https://stablediffusionapi.com/api/v4/dreambooth";
const SERVICE = "SD";

function createServiceEvent(serverEndpoint: string): NostrEvent {

    return createUnsignedServiceEvent(
        {
            endpoint: serverEndpoint + "/" + SERVICE,
            status: OfferingStatus.up,
            fixedCost: 10000,
            variableCost: 0,
            costUnits: 0
        },
        ENDPOINT
    )
}

function getPrice(requestBody: any): number {

    return 10000;
}

function validate(requestBody: any): void {

    return;
}

async function handleFirstResponse(input: NIP105ProcessInput): Promise<[number, any]> {
    const {requestBody} = input;

    const body = {
        ...requestBody,
        key: API_KEY,
    }

    const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        // redirect: 'follow'
    })

    const responseJSON = await response.json() as any;


    if(responseJSON.status !== "success") {
        return [202, responseJSON];
    }

    return [200, responseJSON];
}

async function handlePreviousResponse(input: NIP105ProcessInput): Promise<[number, any]> {
    const {previousResponse} = input;

    const body = {
        key: API_KEY,
    }

    const response = await fetch(previousResponse.fetch_result, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        // redirect: 'follow'
    })

    const responseJSON = await response.json() as any;

    if(responseJSON.status !== "success") {
        return [202, previousResponse];
    }

    return [200, responseJSON];
}

async function process(input: NIP105ProcessInput): Promise<[number, any]> {
    const {previousResponse} = input;

    if(previousResponse){
        return handlePreviousResponse(input)
    }

    return handleFirstResponse(input);
}

export const stableDiffusion: NIP105Service = {
    service: SERVICE,
    createServiceEvent,
    getPrice,
    validate,
    process,
}