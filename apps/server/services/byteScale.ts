import { Event as NostrEvent } from "nostr-tools";
import { NIP105ProcessInput, NIP105Service } from "../services";
import { OfferingStatus, createUnsignedServiceEvent } from "nip105";

const API_KEY = Bun.env.BYTE_SCALE_KEY as string;
const ENDPOINT = "https://api.bytescale.com/v2/accounts/12a1yhP/uploads/form_data";
const SERVICE = "Storage";

function createServiceEvent(serverEndpoint: string): NostrEvent {
  return createUnsignedServiceEvent(
    {
      endpoint: serverEndpoint + "/" + SERVICE,
      status: OfferingStatus.up,
      fixedCost: 10000,
      variableCost: 0,
      costUnits: 0,
    },
    ENDPOINT
  );
}

function getPrice(requestBody: any): number {
  return 10000;
}

function validate(requestBody: any): void {
  return;
}


async function process(input: NIP105ProcessInput): Promise<[number, any]> {
  const { tempFile } = input;

  if (!tempFile) throw new Error("No asset filepath provided");

  try {
    const formData = new FormData();
    const file = Bun.file(tempFile.tempFilePath, {
      type: tempFile.mimetype,
    });
  
    formData.append("file", file);
  
    const response = await fetch(ENDPOINT, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    });
  
    return [200, await response.json()];
  } catch (e) {
    console.log(e);
    return [500, {e}];
  }

}

export const byteScale: NIP105Service = {
  service: SERVICE,
  createServiceEvent,
  getPrice,
  validate,
  process,
};
