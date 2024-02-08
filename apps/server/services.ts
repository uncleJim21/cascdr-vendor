import { Event as NostrEvent } from "nostr-tools";
import { TempFileData } from "./database";

// -------------- DEFINES --------------

/** Defines the interface for a service.
 * Each service should be it's own file in the `services/` directory
 * */
export interface NIP105Service {
  /** The service being provided */
  service: string;
  /** Creates the service note to be posted */
  createServiceEvent: (serverEndpoint: string) => Promise<NostrEvent> | NostrEvent;
  /** Optional: Defines the retries for the service */
  getTries?: (requestBody: any) => Promise<number> | number;
  /** Returns the price of the service given the request body */
  getPrice: (requestBody: any) => Promise<number> | number;
  /** Validates the request, should throw a detailed error on failure */
  validate: (requestBody: any) => Promise<void> | void;
  /** Processes the specific request, should return a status 500 | 202 | 200 */
  process: (input: NIP105ProcessInput) => Promise<[number, any]> | [number, any]; //status, response
}

export interface NIP105ProcessInput {
  requestBody?: any;
  previousResponse?: any;
  tempFile?: TempFileData;
}

// -------------- FUNCTIONS --------------

export async function getAllServiceEvents(
  services: NIP105Service[],
  serverEndpoint: string,
): Promise<NostrEvent[]> {
  return await Promise.all(
    services.map((service) => service.createServiceEvent(serverEndpoint))
  );
}

// This function will simply throw an error if the service is not valid.
export async function validateService(
  servicesMap: Map<string, NIP105Service>,
  service: string,
  requestBody: any
): Promise<void> {
  const serviceProvider = servicesMap.get(service);

  if (!serviceProvider) {
    throw new Error("Invalid service");
  }

  return await serviceProvider.validate(requestBody);
}

export async function getTriesForService(
  servicesMap: Map<string, NIP105Service>,
  service: string,
  requestBody: any,
  defaultTries: number = 3
): Promise<number> {
  const serviceProvider = servicesMap.get(service);

  if (!serviceProvider) {
    throw new Error("Invalid service");
  }

  if (!serviceProvider.getTries) {
    return defaultTries;
  }

  return await serviceProvider.getTries(requestBody);
}

export async function getPriceForService(
  servicesMap: Map<string, NIP105Service>,
  service: string,
  requestBody: any
): Promise<number> {
  const serviceProvider = servicesMap.get(service);

  if (!serviceProvider) {
    throw new Error("Invalid service");
  }

  return await serviceProvider.getPrice(requestBody);
}

export async function processService(
  servicesMap: Map<string, NIP105Service>,
  service: string,
  input: NIP105ProcessInput,
): Promise<[number, any]> {
  const serviceProvider = servicesMap.get(service);

  if (!serviceProvider) {
    throw new Error("Invalid service");
  }

  try {
    return await serviceProvider.process(input);
  } catch (error) {
    const message = `Error processing service: ${error}`;
    return [500, { message }];
  }
}
