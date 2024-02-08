import { Event as NostrEvent } from "nostr-tools";
import { Invoice } from "utils";

export function setNIP105SuccessAction(
  invoice: Invoice,
  serverUrl: string,
  service: string,
  message?: string
): Invoice {
  return {
    ...invoice,
    paymentRequest: {
      ...invoice.paymentRequest,
      successAction: {
        tag: "url",
        message: message ?? "Paying for service",
        url: `${serverUrl}/${service}/${invoice.paymentHash}/get_result`,
      },
    },
  };
}

export enum OfferingStatus {
  up = 'UP',
  down = 'DOWN',
  closed = 'CLOSED'
}

export enum CostUnits {
  mins = 'MINS',
  secs = 'SECS',
  tokens = 'TOKENS',
}

export enum InvoiceProvider {
  ln_address = 'LN_ADDRESS',
  lnd = 'LND',
  cln = 'CLN'
}

export interface OfferingContent {
  /** The POST endpoint you call to pay/fetch */
  endpoint: string,
  /** UP/DOWN/CLOSED */         
  status: OfferingStatus,   
  /** The fixed per call cost in mSats (b in y = mx + b) */ 
  fixedCost: number,
  /** The variable cost based on request's units (i.e. 2000msats per min) */
  variableCost: number,
  /** The units that denominate the variable cost */
  costUnits: number,
  /** Recommended - JSON schema for the POST body of the endpoint */
  schema?: Object,
  /** Recommended - JSON schema for the response of the call */
  outputSchema?: Object,
  /** Optional - Description for the end user */
  description?: string
}

export function createUnsignedServiceEvent(
    content: OfferingContent,
    service: string
): NostrEvent{
    return {
        kind: 31402,
        content: JSON.stringify(content),
        created_at: Math.round(Date.now() / 1000),
        tags: [
            ['s', service],
            ['d', content.endpoint]
        ],
        pubkey: '',
        id: '',
        sig: ''
    } ;
}

export function getTagValue(note: NostrEvent<31402>, tagName: string): string | null {

  const tagArray = note.tags.find(tag => tag[0] === tagName);
  if(!tagArray) return null;
  return tagArray[1];
}

export function getOffering(note: NostrEvent<31402>): OfferingContent | null {
  try {
    const content = JSON.parse(note.content) as OfferingContent;

    if (!content || !content.endpoint) {
      return null;
    }

    if (
      content.endpoint.includes("127.0.0.1") ||
      content.endpoint.includes("localhost")
    ) {
      return null;
    }

    return content;
  } catch (e) {
    console.log(e);
    return null;
  }
}


//TODO Remove in favor of new service type
export enum ServiceType {
  chatGPT = "GPT",
  stableDiffusion = "SD",
  storage = "Storage",
}

export function getServiceType(offering: OfferingContent): ServiceType {
  const split = offering.endpoint.split("/")
  return split[split.length - 1] as ServiceType;
}
