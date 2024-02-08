import express from "express";
import fileUpload from "express-fileupload";
import cors from "cors";
import bodyParser from "body-parser";
import Database from "bun:sqlite";
import { SimplePool } from "nostr-tools";
import React from "react";
import fs from 'fs';
import path from 'path';
import { renderToString } from "react-dom/server";
import yaml from 'js-yaml';


import {
  Action,
  Status,
  serverLog
} from "utils";
import {
  deleteJobTable,
  setupJobTable,
} from "./database";
import {
  NIP105Service,
  getAllServiceEvents,
} from "./services";
import { sleep } from "bun";
import { getPrivateKey, postServices } from "./nostr";
import { checkServicePayment, getServiceInvoice, getServiceResult } from "./server";
import { bech32 } from 'bech32';



// ------------------- SERVICE SETUP -------------------
import { chatGPT } from "./services/chatGPT";
import { stableDiffusion } from "./services/stableDiffusion";
import { byteScale } from "./services/byteScale";
import { InvoiceProvider } from "nip105";

const SERVICES: NIP105Service[] = [
  chatGPT,
  // stableDiffusion,
  // byteScale,
  // Enter Services Here
];

function getInvoiceProviderFromConfig() : InvoiceProvider {
  const configPath = '/root/start9/config.yaml';
  try {
      // Read the YAML file
      const fileContents = fs.readFileSync(configPath, 'utf8');
      
      // Parse the YAML file
      const config = yaml.load(fileContents);

      if (config && config.nodes && Array.isArray(config.nodes)) {
          // Assuming you need the type of the first node in the list
          const firstNode = config.nodes[0];

          if (firstNode && typeof firstNode.type === 'string') {
              switch(firstNode.type) {
                  case 'lnd':
                      // Handle LND logic
                      console.log('LND node found');
                      return InvoiceProvider.lnd;
                      break;
                  case 'cln':
                      // Handle C-Lightning logic
                      console.log('C-Lightning node found');
                      return InvoiceProvider.cln;
                      break;
                  case 'ln_address':
                      // Handle LN Address logic
                      console.log('LN Address found');
                      return InvoiceProvider.ln_address;
                      break;
                  default:
                      console.error('Unknown node type');
              }
          } else {
              console.error('No valid type found for the first node');
          }
      } else {
          console.error('Invalid or missing nodes configuration');
      }
  } catch (error) {
      console.error('Error reading or parsing config file:', error);
  }
  return InvoiceProvider.ln_address;
}


function getTorAddressFromConfig(): string | undefined {
  const configPath = '/root/start9/config.yaml';
  try {
      // Read the YAML file
      const fileContents = fs.readFileSync(configPath, 'utf8');
      
      // Parse the YAML file
      const config = yaml.load(fileContents) as Record<string, unknown>;

      // Extract the tor-address
      const torAddress = config['tor-address'];

      if (typeof torAddress === 'string') {
          return torAddress;
      } else {
          console.error('tor-address is not a string');
          return undefined;
      }
  } catch (error) {
      console.error('Error reading or parsing config file:', error);
      return undefined;
  }
}

function getNostrNsecFromConfig(): string | undefined {
  const configPath = '/root/start9/config.yaml';
  try {
      // Read the YAML file
      const fileContents = fs.readFileSync(configPath, 'utf8');
      
      // Parse the YAML file
      const config = yaml.load(fileContents) as Record<string, unknown>;

      // Extract the tor-address
      const nsec = config['nostr-nsec'];

      if (typeof nsec === 'string') {
          return nsec;
      } else {
          console.error('tor-address is not a string');
          return undefined;
      }
  } catch (error) {
      console.error('Error reading or parsing config file:', error);
      return undefined;
  }
}

function nsecToBinary(nsec: string): string {
  try {
      const { words } = bech32.decode(nsec);
      const bytes = bech32.fromWords(words);
      return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
  } catch (error) {
      console.error('Error converting bech32 to hex:', error);
      throw error;
  }
}




const SERVICE_MAP: Map<string, NIP105Service> = SERVICES.reduce((map, serviceProvider) => {
  map.set(serviceProvider.service, serviceProvider);
  return map;
}, new Map<string, NIP105Service>());

// ------------------- DATABASE SETUP ------------------

const debug = Boolean(Bun.env.DEBUG);
const dbFilename = debug ? Bun.env.DEV_DB_FILENAME : Bun.env.DB_FILENAME;

const DB = new Database(dbFilename, { create: true });
const JOB_TABLE = Bun.env.DB_JOB_TABLE as string;

if (debug) {
  serverLog(Action.SERVER, Status.ERROR, "Starting from a clean slate");
  deleteJobTable(DB, JOB_TABLE); //TODO take out, for debugging
}
setupJobTable(DB, JOB_TABLE);

// -------------------- SERVER SETUP --------------------

const APP = express();
const SERVER_PORT = Number(Bun.env.SERVER_PORT);
const SERVER_URL = getTorAddressFromConfig();
const SERVER_LUD16 = `${Bun.env.SERVER_LUD16 as string}`;

APP.use(express.static('./assets'));

APP.use(cors());
APP.use(bodyParser.json());
APP.use(fileUpload({
  safeFileNames: true,
  useTempFiles : true,
  tempFileDir : '/tmp/',
  // abortOnLimit: true,
  // limits: { fileSize: 50 * 1024 * 1024 },
}));

// --------------------- ENDPOINTS ---------------------

APP.post("/:service", async (request, response) => {
  const provider = getInvoiceProviderFromConfig();
  getServiceInvoice(request, response, SERVICE_MAP, DB, JOB_TABLE, SERVER_LUD16, SERVER_URL, provider);
});

APP.get("/:service/:payment_hash/get_result", async (request, response) => {
  getServiceResult(request, response, SERVICE_MAP, DB, JOB_TABLE);
});

APP.get("/:service/:payment_hash/check_payment", async (request, response) => {
  checkServicePayment(request, response, DB, JOB_TABLE);
});


// --------------------- SERVER LOOP --------------------------

APP.listen(SERVER_PORT, () => {
  serverLog(Action.SERVER, Status.INFO, "Welcome to NIP-105: Data Buffet!");
  serverLog(Action.SERVER, Status.INFO, `Listening on port ${SERVER_PORT}...`);
});

// --------------------- NOSTR SETUP --------------------------
//TODO UPDATE Periodically

const RELAYS = [
  'wss://dev.nostrplayground.com',
  'wss://nostr.kungfu-g.rip/',
  'wss://nostr.lnproxy.org',
  'wss://relay.wavlake.com'
];
const POOL = new SimplePool()

// --------------------- NOSTR LOOP --------------------------
async function updateServices() {
  while(true) {
    try {
      const allEvents = await getAllServiceEvents(SERVICES, SERVER_URL);
      const nsec = getNostrNsecFromConfig();
      const privateKey = nsecToBinary(nsec);

      await postServices(POOL, privateKey, RELAYS, allEvents);
      serverLog(Action.SERVER, Status.INFO, `Posted ${allEvents.length} services to ${RELAYS.length} Nostr relay(s)`);
      await sleep(1000 * 60 * 10); // Every 10 minutes
    } catch (error) {
      serverLog(Action.SERVER, Status.ERROR, `Error posting to Nostr: ${error}`);
    }

  }
}

updateServices()
console.log("setup done..")