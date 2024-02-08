import Database from "bun:sqlite";
import { Invoice, PaymentRequest, PrePayRequest } from "utils";

// ---------------- DEFINES ------------------
export enum JobState {
  UNPAID = "unpaid",
  FETCHING = "fetching",
  COMPLETED = "completed",
  ERROR = "error",
}

export interface JobEntry {
  paymentHash: string;
  service: string;
  price: number;
  user: string;
  invoiceJSON: string;
  requestJSON: string;
  responseJSON: string;
  tempFileJSON: string;
  paid: boolean;
  state: JobState;
  message: string;
  tries: number;
  createdTimestamp: number;
  paidTimestamp: number;
  lastUpdatedTimestamp: number;
}

export interface TempFileData {
  name: string;
  size: number;
  encoding: string;
  tempFilePath: string;
  truncated: boolean;
  mimetype: string;
  md5: string;
}

// ---------------- SECURITY ------------------
const JOB_TABLE = Bun.env.DB_JOB_TABLE as string;

function checkIfIsTableOk(table: string) {
  if (table !== JOB_TABLE) {
    throw new Error("Bad table");
  }
}

// ---------------- TABLE SETUP ------------------

export function setupJobTable(db: Database, table: string) {
  checkIfIsTableOk(table);

  const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${table} (
        paymentHash TEXT PRIMARY KEY,
        service TEXT,
        price INTEGER,
        user TEXT,
        invoiceJSON TEXT,
        requestJSON TEXT,
        responseJSON TEXT,
        tempFileJSON TEXT,
        paid INTEGER,
        state TEXT,
        message TEXT,
        tries INTEGER,
        createdTimestamp INTEGER,
        paidTimestamp INTEGER,
        lastUpdatedTimestamp INTEGER
      );
    `;
  db.query(createTableQuery).run();
}

export function deleteJobTable(db: Database, table: string) {
  checkIfIsTableOk(table); // Assuming this function checks for table name validity

  const deleteTableQuery = `
      DROP TABLE IF EXISTS ${table};
    `;
  db.query(deleteTableQuery).run();
}

export function getJobEntry(
  db: Database,
  table: string,
  paymentHash: string
): JobEntry {
  checkIfIsTableOk(table);

  const selectQuery = `
      SELECT * FROM ${table}
      WHERE paymentHash = ?;
    `;

  const jobEntry = db.query(selectQuery).all(paymentHash);

  if (jobEntry.length === 0) {
    throw new Error(`Job with paymentHash ${paymentHash} does not exist`);
  }

  return jobEntry[0] as JobEntry;
}

export function createJobEntry(
  db: Database,
  table: string,
  service: string,
  price: number,
  tries: number,
  invoice: Invoice,
  requestBody: any,
  tempFile: TempFileData | undefined,
) {

  return createJobEntryRaw(db, table, {
    paymentHash: invoice.paymentHash,
    service,
    price,
    user: invoice.prePayRequest?.nostrPubkey ?? "",
    invoiceJSON: JSON.stringify(invoice),
    requestJSON: JSON.stringify(requestBody),
    responseJSON: "",
    tempFileJSON: tempFile ? JSON.stringify(tempFile) : "",
    paid: false,
    state: JobState.UNPAID,
    message: "",
    tries,
    createdTimestamp: Date.now(),
    paidTimestamp: 0,
    lastUpdatedTimestamp: Date.now(),
  });
}

function createJobEntryRaw(db: Database, table: string, job: JobEntry) {
  checkIfIsTableOk(table);

  // Prepare the SQL query to insert a new job entry
  const insertQuery = `
    INSERT INTO ${table} (
      paymentHash,
      service,
      price,
      user,
      invoiceJSON,
      requestJSON,
      responseJSON,
      tempFileJSON,
      paid,
      state,
      message,
      tries,
      createdTimestamp,
      paidTimestamp,
      lastUpdatedTimestamp
    ) VALUES (
      $paymentHash,
      $service,
      $price,
      $user,
      $invoiceJSON,
      $requestJSON,
      $responseJSON,
      $tempFileJSON,
      $paid,
      $state,
      $message,
      $tries,
      $createdTimestamp,
      $paidTimestamp,
      $lastUpdatedTimestamp
    );
  `;

  // Execute the query with job entry parameters
  db.query(insertQuery).run({
    $paymentHash: job.paymentHash,
    $service: job.service,
    $price: job.price,
    $user: job.user,
    $invoiceJSON: job.invoiceJSON,
    $requestJSON: job.requestJSON,
    $responseJSON: job.responseJSON,
    $tempFileJSON: job.tempFileJSON,
    $paid: job.paid ? 1 : 0, // Convert boolean to integer
    $state: job.state,
    $message: job.message,
    $tries: job.tries,
    $createdTimestamp: job.createdTimestamp,
    $paidTimestamp: job.paidTimestamp,
    $lastUpdatedTimestamp: job.lastUpdatedTimestamp,
  });
}

export function markPaid(db: Database, table: string, paymentHash: string) {
  checkIfIsTableOk(table);

  const jobEntry = getJobEntry(db, table, paymentHash);
  if (jobEntry.paid) return;

  // Prepare the SQL query to update the paid status and state of the job entry
  
  const markPaidQuery = `
      UPDATE ${table}
      SET
        paid = 1,
        state = $state,
        paidTimestamp = $paidTimestamp,
        lastUpdatedTimestamp = $lastUpdatedTimestamp
      WHERE paymentHash = $paymentHash;
    `;

  const currentTimestamp = Date.now();

  // Execute the update query with the new values
  db.query(markPaidQuery).run({
    $state: JobState.FETCHING,
    $paidTimestamp: currentTimestamp,
    $lastUpdatedTimestamp: currentTimestamp,
    $paymentHash: paymentHash,
  });
}

export function setResponse(
  db: Database,
  table: string,
  paymentHash: string,
  responseBody: any
) {
  checkIfIsTableOk(table);

  const jobEntry = getJobEntry(db, table, paymentHash);
  if (jobEntry.state === JobState.COMPLETED) return;

  // Prepare the SQL query to update the job entry as completed
  const markCompleteQuery = `
      UPDATE ${table}
      SET
        responseJSON = $responseJSON,
        state = $state,
        lastUpdatedTimestamp = $lastUpdatedTimestamp
      WHERE paymentHash = $paymentHash;
    `;

  const currentTimestamp = Date.now();

  // Execute the update query with the new values
  db.query(markCompleteQuery).run({
    $responseJSON: JSON.stringify(responseBody),
    $state: JobState.FETCHING,
    $lastUpdatedTimestamp: currentTimestamp,
    $paymentHash: paymentHash,
  });
}

export function markComplete(
  db: Database,
  table: string,
  paymentHash: string,
  responseBody: any
) {
  checkIfIsTableOk(table);

  const jobEntry = getJobEntry(db, table, paymentHash);
  if (jobEntry.state === JobState.COMPLETED) return;

  // Prepare the SQL query to update the job entry as completed
  const markCompleteQuery = `
      UPDATE ${table}
      SET
        responseJSON = $responseJSON,
        state = $state,
        lastUpdatedTimestamp = $lastUpdatedTimestamp
      WHERE paymentHash = $paymentHash;
    `;

  const currentTimestamp = Date.now();

  // Execute the update query with the new values
  db.query(markCompleteQuery).run({
    $responseJSON: JSON.stringify(responseBody),
    $state: JobState.COMPLETED,
    $lastUpdatedTimestamp: currentTimestamp,
    $paymentHash: paymentHash,
  });
}

export function markError(
  db: Database,
  table: string,
  paymentHash: string,
  errorMessage: string
) {
  checkIfIsTableOk(table);

  const jobEntry = getJobEntry(db, table, paymentHash);
  if (jobEntry.tries <= 0) return;

  // Prepare the SQL query to update the job entry's state to ERROR and set the error message
  const markErrorQuery = `
      UPDATE ${table}
      SET
        message = $message,
        state = $state,
        tries = tries - 1,
        lastUpdatedTimestamp = $lastUpdatedTimestamp
      WHERE paymentHash = $paymentHash;
    `;

  const currentTimestamp = Date.now();

  // Execute the update query with the new values
  db.query(markErrorQuery).run({
    $message: errorMessage,
    $state: JobState.ERROR,
    $lastUpdatedTimestamp: currentTimestamp,
    $paymentHash: paymentHash,
  });
}
