import {
  Action,
  Invoice,
  Status,
  checkPaid,
  getInvoice_ln_address,
  getInvoice_lnd,
  serverLog,
} from "utils";
import {
  NIP105Service,
  getPriceForService,
  getTriesForService,
  processService,
  validateService,
} from "./services";
import { InvoiceProvider, setNIP105SuccessAction } from "nip105";
import {
  JobState,
  TempFileData,
  createJobEntry,
  getJobEntry,
  markComplete,
  markError,
  markPaid,
  setResponse,
} from "./database";
import Database from "bun:sqlite";

export async function getServiceInvoice(
  request,
  response,
  servicesMap: Map<string, NIP105Service>,
  database: Database,
  table: string,
  lud16: string,
  serverUrl: string,
  invoiceProvider: InvoiceProvider,
) {
  try {
    serverLog(Action.GET_INVOICE, Status.INFO, "Fetching request for invoice");

    const service = request.params.service;
    const requestBody = request.body;
    const tempFileRaw = request?.files?.file as TempFileData | undefined;
    let tempFile: TempFileData | undefined = tempFileRaw;

    if(tempFileRaw){
      tempFile = {
        name: tempFileRaw?.name,
        size: tempFileRaw?.size,
        encoding: tempFileRaw?.encoding,
        tempFilePath: tempFileRaw?.tempFilePath,
        truncated: tempFileRaw?.truncated,
        mimetype: tempFileRaw?.mimetype,
        md5: tempFileRaw?.md5,
      }
    }
    await validateService(servicesMap, service, requestBody);
    const cost = await getPriceForService(servicesMap, service, requestBody);
    const tries = await getTriesForService(servicesMap, service, requestBody);
    var rawInvoice = null;
    switch(invoiceProvider){
      case InvoiceProvider.ln_address:
        rawInvoice = await getInvoice_ln_address(lud16,cost);
        break;
      case InvoiceProvider.lnd:
        console.log("cost for lnd invoice:", cost);
        rawInvoice = await getInvoice_lnd(cost);
        break;
      case InvoiceProvider.cln:
        rawInvoice = null; //TODO add CLN implementation
        break;
    }
    const invoice = setNIP105SuccessAction(
      rawInvoice,
      serverUrl,
      service,
      "Paying for service"
    );
    createJobEntry(database, table, service, cost, tries, invoice, requestBody, tempFile);
    response.status(402).send(invoice);
  } catch (error) {
    serverLog(
      Action.GET_INVOICE,
      Status.ERROR,
      `Error requesting invoice: ${error}`
    );
    response
      .status(500)
      .send({ message: `Error requesting invoice: ${error}` });
  }
}

export async function getServiceResult(
  request,
  response,
  servicesMap: Map<string, NIP105Service>,
  database: Database,
  table: string
) {
  try {
    serverLog(Action.GET_RESULT, Status.INFO, "Fetching results");

    const jobEntry = getJobEntry(database, table, request.params.payment_hash);

    switch (jobEntry.state) {
      case JobState.ERROR:
        if (jobEntry.tries) break;
        response.status(500).send({ message: jobEntry.message });
        return;
      case JobState.COMPLETED:
        response.status(200).send(JSON.parse(jobEntry.responseJSON));
        return;
      case JobState.UNPAID:
        const paymentRequest = (JSON.parse(jobEntry.invoiceJSON) as Invoice)
          .paymentRequest;
        const paymentHash = (JSON.parse(jobEntry.invoiceJSON) as Invoice)
        .paymentHash;
        const verifyPaymentRequest = await checkPaid(paymentRequest,paymentHash);
        const isPaid = verifyPaymentRequest.settled;
        if (!isPaid) {
          response.status(402).send({ message: "Payment not received" });
          return;
        } else {
          markPaid(database, table, request.params.payment_hash);
        }
        break;
      case JobState.FETCHING:
        break;
    }

    const [status, data] = await processService(
      servicesMap,
      jobEntry.service,
      {
        requestBody: JSON.parse(jobEntry.requestJSON),
        previousResponse: jobEntry.responseJSON ? JSON.parse(jobEntry.responseJSON) : null,
        tempFile: jobEntry.tempFileJSON ? JSON.parse(jobEntry.tempFileJSON) : null,
      }
    );

    switch (status) {
      case 200:
        markComplete(
          database,
          table,
          request.params.payment_hash,
          data
        );
        break;
      case 500:getServiceInvoice
        markError(
          database,
          table,
          request.params.payment_hash,
          data
        );
        break;
      case 202:
        setResponse(
          database,
          table,
          request.params.payment_hash,
          data
        );
        break; // Still working
    }

    response.status(status).send(data);
  } catch (error) {
    response.status(500).send({ message: `Error checking result: ${error}` });
  }
}

export async function checkServicePayment(
  request,
  response,
  database: Database,
  table: string
) {
  try {
    serverLog(Action.CHECK_PAYMENT, Status.INFO, "Checking if Paid");

    const jobEntry = getJobEntry(database, table, request.params.payment_hash);

    if (jobEntry.paid) {
      response.status(200).send({ settled: true });
      return;
    }

    const invoice = JSON.parse(jobEntry.invoiceJSON) as Invoice;
    const verifyPaymentRequest = await checkPaid(invoice.paymentRequest,invoice.paymentHash);
    const isPaid = verifyPaymentRequest.settled;

    if (isPaid) {
      markPaid(database, table, request.params.payment_hash);
    }

    response.status(200).send({ settled: isPaid });
  } catch (error) {
    response.status(500).send({ message: `Error checking payment: ${error}` });
  }
}
