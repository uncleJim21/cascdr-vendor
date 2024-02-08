import { Event as NostrEvent} from 'nostr-tools';
import { NIP105ProcessInput, NIP105Service } from "../services";
import { OfferingStatus, createUnsignedServiceEvent } from 'nip105';
import { getBitcoinPrice, getPrice_msats } from 'utils/bitcoin-price';
import fs from 'fs';
import yaml from 'js-yaml';

const GPT_USD_PRICE_MILLICENTS = (Bun.env.GPT_USD_PRICE_MILLICENTS) as number;
const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const SERVICE = "GPT";
var currentServicePrice = 10000;

function getAPIKey(): String | null{
    const configPath = '/root/start9/config.yaml';

  try {
      // Read the YAML file
      const fileContents = fs.readFileSync(configPath, 'utf8');
      // Parse the YAML file
      const config = yaml.load(fileContents);

      // Extract open_ai_api_key and password
      const apiKey = config.open_ai_api_key;

      return apiKey;
  } catch (e) {
      console.error(e);
      return null;
  }
}

function getGPTPriceUSD(): String | null{
    const configPath = '/root/start9/config.yaml';

  try {
      // Read the YAML file
      const fileContents = fs.readFileSync(configPath, 'utf8');
      // Parse the YAML file
      const config = yaml.load(fileContents);

      // Extract open_ai_api_key and password
      const price = config.chat_gpt_price_usd;

      return price;
  } catch (e) {
      console.error(e);
      return null;
  }
}

function getGPTPriceMilliCents(): number | null{
    const usdPrice = getGPTPriceUSD();
    if(usdPrice){
        const milliCentsPrice = Number(usdPrice) * 100000;
        console.log("got millicents:",milliCentsPrice);
        return milliCentsPrice
    }
    else{
        console.log("failed to get millicents")
        return null;
    }
    
}

async function createServiceEvent(serverEndpoint: string): NostrEvent {
    const btcPrice = await getBitcoinPrice();
    const milliCents = getGPTPriceMilliCents();
    const price = await getPrice_msats(milliCents,btcPrice);
    currentServicePrice = price;
    return createUnsignedServiceEvent(
        {
            endpoint: serverEndpoint + "/" + SERVICE,
            status: OfferingStatus.up,
            fixedCost: price,
            variableCost: 0,
            costUnits: 0
        },
        ENDPOINT
    )
}

function getPrice(requestBody: any): number {

    return currentServicePrice;
}

function validate(requestBody: any): void {

    return;
}

async function process(input: NIP105ProcessInput): Promise<[number, any]> {
    const {requestBody} = input;
    const apiKey = getAPIKey();
    console.log(`CALLING GPT WITH API KEY ${apiKey}`)
    if(apiKey){
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        })
    
        return [200, await response.json()];
    }
    else{
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(requestBody)
        })
    
        return [500, { error: "API Key not correctly configured" }];
    }
    
}

export const chatGPT: NIP105Service = {
    service: SERVICE,
    createServiceEvent,
    getPrice,
    validate,
    process,
}