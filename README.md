# Data Buffets

Hi welcome to Data Buffets!

1. Download Bun
```bash
curl -fsSL https://bun.sh/install | bash
```

2. Clone this repo
```bash
git clone https://github.com/Team-Pleb-TabConf-2023/Monorepo
cd Monorepo
```

3. Copy `.env.example` and fill out the required fields ( For now the Chat GPT API )
```bash
cp .env.example .env
```

3. Install Dependancies
```bash
bun install
```

4. Run Server
```bash
bun cascdr-vendor
```

5. Run ChatGPT script in a new terminal
```bash
bun cascdr-vendor-test
```

## Adding a Service
Create a new file in `apps/server/services` directory and implement and export a `NIP105Service`:

```typescript
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
  process: (requestBody: any) => Promise<[number, any]> | [number, any]; //status, response
}
```

Then in `apps/server/index.ts` import and add the service to the `SERVICES` array.

```typescript
// ------------------- SERVICE SETUP -------------------
import { chatGPT } from "./services/chatGPT";

const SERVICES: NIP105Service[] = [
  chatGPT,
  // Enter Services Here
];
```