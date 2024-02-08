import { sleep } from "bun";
import { Invoice } from "utils";

const serverUrl = (Bun.env.SERVER_URL as string);
const service = "GPT";

const question = (await prompt("Question: ")) as string;
if(!question) throw new Error("No question entered");

const requestBody = {
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "user",
        content: question
      },
    ],
  };

const request = await fetch(`${serverUrl}/${service}`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
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
        const resultResponse = await result.json();
        console.log(`\nQuestion: ${question}\n`)
        console.log(`\nAnswer: ${(resultResponse as any).choices[0].message.content}\n`);
        done = true;
    } else {
        console.log("Response code: ", result.status);
        await sleep(2000);
    }
}
