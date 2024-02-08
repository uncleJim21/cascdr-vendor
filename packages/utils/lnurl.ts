import bolt11 from "bolt11";
import fs from 'fs';
import { spawn } from 'child_process' 

import {
  getInvoiceMacaroon
} from "utils";


export const LUD16_DOMAIN_REPLACE = "DOMAIN";
export const LUD16_USER_REPLACE = "USER";
export const LUD16_URL = `https://${LUD16_DOMAIN_REPLACE}/.well-known/lnurlp/${LUD16_USER_REPLACE}`;

export type PrePayRequestMetadataPair = [string, string];

export interface PrePayRequest {
  status: "OK" | "ERROR";
  reason: string | null; // Reason for error
  tag: string; // 'payRequest'
  commentAllowed: number; // 255
  callback: string; // "https://getalby.com/lnurlp/coachchuckff/callback",
  metadata: PrePayRequestMetadataPair[];
  minSendable: number; // 1000 msats
  maxSendable: number; // 100000000 msats
  payerData: {
    name: {
      mandatory: boolean;
    };
    email: {
      mandatory: boolean;
    };
    pubkey: {
      mandatory: boolean;
    };
  };
  nostrPubkey: string;
  allowsNostr: boolean;
}

export interface PaymentRequestSuccessAction {
  tag: "message" | "url";
  message: string;
  url: string | null;
}
export interface PaymentRequest {
  status: "OK" | "ERROR";
  reason: string | null; // Reason for error
  successAction: PaymentRequestSuccessAction;
  verify: string;
  routes: string[];
  pr: string;
}

export interface VerifyPaymentRequest {
  status: "OK";
  reason: string | null; // Reason for error
  settled: boolean;
  preimage: string | null;
  pr: string;
}

export interface Invoice {
  prePayRequest: PrePayRequest | null;
  paymentRequest: PaymentRequest;
  paymentHash: string;
}


export async function run_cmd <T> (                                                                                                                                                                                                                                                                                          
  cmdpath : string,                                                                                                                                                                                                                                                                                                          
  params  : string[]                                                                                                                                                                                                                                                                                                         
) : Promise<T> {                                                                                                                                                                                                                                                                                                             
  return new Promise((resolve, reject) => {                                                                                                                                                                                                                                                                                  
    const proc = spawn(cmdpath, params)                                                                                                                                                                                                                                                                                      
    let blob = ''                                                                                                                                                                                                                                                                                                            
    proc.stdout.on('data', data => {                                                                                                                                                                                                                                                                                         
      blob += String(data.toString())                                                                                                                                                                                                                                                                                        
    })                                                                                                                                                                                                                                                                                                                       
    proc.stderr.on('data', data => {                                                                                                                                                                                                                                                                                         
      reject(new Error(data.toString()))                                                                                                                                                                                                                                                                                     
    })                                                                                                                                                                                                                                                                                                                       
    proc.on('error', err => reject(err))                                                                                                                                                                                                                                                                                     
    proc.on('close', code => {                                                                                                                                                                                                                                                                                               
      if (code !== 0) {                                                                                                                                                                                                                                                                                                      
        reject(new Error(`exit code: ${String(code)}`))                                                                                                                                                                                                                                                                      
      } else {                                                                                                                                                                                                                                                                                                               
        resolve(handle_data(blob) as T)                                                                                                                                                                                                                                                                                      
      }                                                                                                                                                                                                                                                                                                                      
    })                                                                                                                                                                                                                                                                                                                       
  })                                                                                                                                                                                                                                                                                                                         
}      

function getInvoiceMacaroon(): string | null {
  const macaroonPath = '/mnt/lnd/invoices.macaroon';

  try {
    const macaroonBinary = fs.readFileSync(macaroonPath);
    const macaroonHex = macaroonBinary.toString('hex');
    return macaroonHex;
  } catch (error) {
    console.error('Error reading macaroon file:', error);
    return null;
  }
}
                                                                                                                                                                                                                                                                                                                             
function handle_data (blob : string) {                                                                                                                                                                                                                                                                                       
  try {                                                                                                                                                                                                                                                                                                                      
    return JSON.parse(blob)                                                                                                                                                                                                                                                                                                  
  } catch {                                                                                                                                                                                                                                                                                                                  
     return blob.replace('\n', '')                                                                                                                                                                                                                                                                                           
  }                                                                                                                                                                                                                                                                                                                          
}   


export function isValidLud16(lud16: string) {
  // Regular expression to validate common email structures
  const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  return regex.test(lud16);
}

export function getLud16Url(lud16: string) {
  const isValid = isValidLud16(lud16);
  if (!isValid) {
    throw new Error(`Invalid lud16: ${lud16}`);
  }

  const parts = lud16.split("@");
  const username = parts[0];
  const domain = parts[1];
  return LUD16_URL.replace(LUD16_DOMAIN_REPLACE, domain).replace(
    LUD16_USER_REPLACE,
    username
  );
}

export async function getPaymentHash(pr: string): Promise<string> {
  const decodedPR = await bolt11.decode(pr);

  if (!decodedPR) throw new Error("Could not bolt11 parse PR");

  const paymentHashTag = decodedPR.tags.find(
    (tag) => tag.tagName === "payment_hash"
  );

  if (!paymentHashTag || !paymentHashTag.data) {
    throw new Error("Payment hash tag not found or invalid");
  }

  return paymentHashTag.data as string;
}

export async function getInvoice_ln_address(
  lud16: string,
  msats: number,
  expiration: Date = new Date(Date.now() + 1000 * 60 * 60 * 3), // 3 hours 
): Promise<Invoice> {
  const lud16Url = getLud16Url(lud16);

  const prePayRequestRequest = await fetch(lud16Url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  const prePayRequest = (await prePayRequestRequest.json()) as PrePayRequest;

  if (prePayRequest.status !== "OK") {
    throw new Error(`Error getting pre pay request: ${prePayRequest.reason}`);
  }

  if (msats > prePayRequest.maxSendable || msats < prePayRequest.minSendable) {
    throw new Error(
      `${msats} msats not in sendable range of ${prePayRequest.minSendable} - ${prePayRequest.maxSendable}`
    );
  }

  if(!prePayRequest.callback) {
    throw new Error(`No callback provided in pre pay request`);
  }

  const expirationTime = Math.floor(expiration.getTime() / 1000);
  const paymentRequestUrl = `${prePayRequest.callback}?amount=${msats}&expiry=${expirationTime}`;
  const paymentRequestResponse = await fetch(paymentRequestUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  
  const paymentRequest = await paymentRequestResponse.json() as PaymentRequest;

  if (paymentRequest.status !== "OK") {
    throw new Error(`Error getting payment request: ${paymentRequest.reason}`);
  }

  const paymentHash = await getPaymentHash(paymentRequest.pr);

  const result = {
    prePayRequest,
    paymentRequest,
    paymentHash,
  };
  

  return {
    prePayRequest,
    paymentRequest,
    paymentHash,
  };
}



function parseLNDInvoiceRequest(jsonResponse: any): PaymentRequest {
  // Neutral default value for successAction
  const defaultSuccessAction: PaymentRequestSuccessAction = {
    tag: "message", // Default tag as "message"
    message: "Enjoy the results of your L402", // Default message
    url: null // Default URL as null
  };

  const paymentRequest: PaymentRequest = {
    pr: jsonResponse.payment_request,
    verify: 'lnd', 
    routes: [], 
    successAction: defaultSuccessAction, // Neutral default value
    status: jsonResponse.payment_request ? "OK" : "ERROR",
    reason: jsonResponse.payment_request ? null : "Error occurred" // or more specific reason if available
  };

  return paymentRequest;
}


function convertBase64ToHex(base64String:String) : String | null{

  const buffer = Buffer.from(base64String, 'base64');

    // Convert the Buffer to a hexadecimal string
  const hexString = buffer.toString('hex');  
  
  return hexString;
}

//Use REST Interface to get an invoice
export async function getInvoice_lnd(msats) : Promise<Invoice> {                                                                                                                                                                                                                                                                      
     
  const invoiceMacaroon = getInvoiceMacaroon();
  const lndUrl = "https://lnd.embassy:8080/v1/invoices";                                                                                                                                                                                                                                                                     
  const satoshis = Math.floor(msats / 1000);                                                                                                                                                                                                                                                                                 
  const body = JSON.stringify({ value: satoshis.toString() });                                                                                                                                                                                                                                                               
                                                                                                                                                                                                                                                                                             
  const curlCommand = [                                                                                                                                                                                                                                                                                                        
    '-k', '-X', 'POST',                                                                                                                                                                                                                                                                                                        
    lndUrl,                                                                                                                                                                                                                                                                                                                    
    '-H', `Grpc-Metadata-macaroon: ${invoiceMacaroon}`,                                                                                                                                                                                                                                                                        
    '-H', 'Content-Type: application/json',                                                                                                                                                                                                                                                                                    
    '-d', body, '-s'                                                                                                                                                                                                                                                                                                           
  ];                                                                                                                                                                                                                                                                                                                           
  try {              
    const prePayRequest : PrePayRequest = {
      status: "OK",
      reason: null,
      tag: "payRequest",
      commentAllowed: 255,
      callback: "",
      metadata: [], 
      minSendable: 1000, // 1000 msats
      maxSendable: 100000000, // 100000000 msats
      payerData: {
        name: { mandatory: false },
        email: { mandatory: false },
        pubkey: { mandatory: false },
      },
      nostrPubkey: "",
      allowsNostr: false,
    };
                                                                                                                                                                                                                                                                                                           
    const lndResponse = await run_cmd("curl",curlCommand) as any;
    const paymentRequest = parseLNDInvoiceRequest(lndResponse);
    
    const paymentHash = convertBase64ToHex(lndResponse.r_hash) as string;
                                                                                                                                                                                                                                                                                                                             
    const result = {                                                                                                                                                                                                                                                                                                         
      prePayRequest,                                                                                                                                                                                                                                                                                                          
      paymentRequest,                                                                                                                                                                                                                                                                                                        
      paymentHash                                                                                                                                                                                                                                                                                                          
    };                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        
                                                                                                                                                                                                                                                                                                                             
    return {                                                                                                                                                                                                                                                                                                         
      prePayRequest,                                                                                                                                                                                                                                                                                                          
      paymentRequest,                                                                                                                                                                                                                                                                                                        
      paymentHash                                                                                                                                                                                                                                                                                                          
    };                                                                                                                                                                                                                                                                                                                
  } catch (error) {                                                                                                                                                                                                                                                                                                          
    console.log(`error:${error}`);                                                                                                                                                                                                                                                                                       
    console.error('Error executing curl command:', error);                                                                                                                                                                                                                                                                       
    throw error;                                                                                                                                                                                                                                                                                                             
  }                                                                                                                                                                                                                                                                                                                          
}       

export async function checkPaid(
  paymentRequest: PaymentRequest,
  paymentHash: String | null
): Promise<VerifyPaymentRequest> {
  switch(paymentRequest.verify){
    case "lnd":
      console.log("verifying with lnd...")
      const invoiceMacaroon = getInvoiceMacaroon();
      const lndUrl = `https://lnd.embassy:8080/v1/invoice/${paymentHash}`;

      const curlCommand = [
        '-k', '-X', 'GET',
        lndUrl,
        '-H', `Grpc-Metadata-macaroon: ${invoiceMacaroon}`,
        '-H', 'Content-Type: application/json', '-s'
      ];

      try{
        const lndResponse = await run_cmd("curl",curlCommand) as any;
        const preImage = convertBase64ToHex(lndResponse.r_preimage) as string;
        const paymentRequest = lndResponse.payment_request;
        const lndVerifyRequest : VerifyPaymentRequest = {
          status: "OK",
          reason: null,
          settled: lndResponse.settled as boolean,
          preimage: preImage,
          pr: paymentRequest
        }

        return lndVerifyRequest;
      }
      catch (error) {                                                                                                                                                                                                                                                                                                          
        console.log(`error:${error}`);                                                                                                                                                                                                                                                                                       
        console.error('Error executing curl command:', error);                                                                                                                                                                                                                                                                       
        throw error;                                                                                                                                                                                                                                                                                                             
      }   
    break
    default://using external source to verify
      const verifyRequest = await fetch(paymentRequest.verify);
      return (await verifyRequest.json()) as VerifyPaymentRequest;
    break
  }
  
}


