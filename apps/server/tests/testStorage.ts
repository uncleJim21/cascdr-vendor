import { sleep } from "bun";
import { Invoice } from "utils";

const serverUrl = (Bun.env.SERVER_URL as string);
const service = "Storage";

const path = (await prompt("Filepath: ")) as string;
if(!path) throw new Error("No question entered");

// Stay below 5kb
const file = Bun.file(path);
const formData = new FormData();
formData.append('file', file);

const request = await fetch(`${serverUrl}/${service}`, {
    method: 'POST',
    body: formData,
});

const invoice = await request.json() as Invoice;
console.log(`\n\n${invoice.paymentRequest.pr}\n`);

confirm("Did you pay the invoice?\n");

let done = false;
while(!done) {

    const result = await fetch(`${serverUrl}/${service}/${invoice.paymentHash}/get_result`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if(result.status === 500) {
        const resultResponse = await result.json();
        console.log(resultResponse);
        done = true;
    } else if(result.status === 200) {
        const resultResponse = (await result.json()) as any;
        console.log(resultResponse.files[0].fileUrl);
        done = true;
    } else {
        console.log("Response code: ", result.status);
        await sleep(2000);
    }
}
