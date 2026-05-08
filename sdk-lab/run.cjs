/**
 * Huefy TypeScript SDK Lab
 * Core email contract verification with optional live sends.
 */

const { HuefyEmailClient } = require("../dist/huefy-client.js");

const PASS = "\x1b[32m[PASS]\x1b[0m";
const FAIL = "\x1b[31m[FAIL]\x1b[0m";
const LIVE_MODE = (process.env.HUEFY_SDK_LAB_MODE || "").trim().toLowerCase() === "live";
const VALID_PROVIDERS = new Set(["ses", "sendgrid", "mailgun", "mailchimp"]);

let passed = 0;
let failed = 0;

function check(label, ok, detail = "") {
  if (ok) {
    console.log(`${PASS} ${label}`);
    passed++;
    return;
  }

  console.log(`${FAIL} ${label}${detail ? ` — ${detail}` : ""}`);
  failed++;
}

function requireEnv(name) {
  const value = (process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required in live mode`);
  }
  return value;
}

function resolveProvider() {
  const provider = (process.env.HUEFY_SDK_LIVE_PROVIDER || "").trim().toLowerCase();
  if (!provider) {
    return undefined;
  }
  if (!VALID_PROVIDERS.has(provider)) {
    throw new Error(`HUEFY_SDK_LIVE_PROVIDER must be one of: ${Array.from(VALID_PROVIDERS).join(", ")}`);
  }
  return provider;
}

function getLiveConfig() {
  return {
    apiKey: requireEnv("HUEFY_SDK_LIVE_API_KEY"),
    baseUrl: requireEnv("HUEFY_SDK_LIVE_BASE_URL"),
    templateKey: requireEnv("HUEFY_SDK_LIVE_TEMPLATE_KEY"),
    recipient: requireEnv("HUEFY_SDK_LIVE_RECIPIENT"),
    provider: resolveProvider(),
  };
}

async function runContract() {
  let client;
  try {
    client = new HuefyEmailClient({ apiKey: "sdk_lab_test_key" });
    check("Initialization", true);
  } catch (error) {
    check("Initialization", false, String(error));
  }

  try {
    const emailClient = new HuefyEmailClient({ apiKey: "sdk_lab_test_key" });
    let capturedPath = "";
    let capturedOptions;
    emailClient.http = {
      request: async (path, options) => {
        capturedPath = path;
        capturedOptions = options;
        return {
          success: true,
          data: {
            emailId: "email_123",
            status: "queued",
            recipients: [{ email: "alice@example.com", status: "queued" }],
          },
          correlationId: "corr_send_123",
        };
      },
    };

    const response = await emailClient.sendEmail({
      templateKey: " welcome-email ",
      data: { firstName: "Alice" },
      recipient: { email: " alice@example.com ", type: "cc", data: { locale: "en" } },
      provider: "ses",
    });

    const body = capturedOptions.body;
    const recipient = body.recipient;
    const ok =
      capturedPath === "/emails/send" &&
      capturedOptions.method === "POST" &&
      body.templateKey === "welcome-email" &&
      recipient.email === "alice@example.com" &&
      recipient.type === "cc" &&
      body.providerType === "ses" &&
      response.data.emailId === "email_123";
    check("Single email contract", ok, ok ? "" : JSON.stringify({ capturedPath, capturedOptions, response }));
  } catch (error) {
    check("Single email contract", false, String(error));
  }

  try {
    const emailClient = new HuefyEmailClient({ apiKey: "sdk_lab_test_key" });
    let capturedPath = "";
    let capturedOptions;
    emailClient.http = {
      request: async (path, options) => {
        capturedPath = path;
        capturedOptions = options;
        return {
          success: true,
          data: {
            batchId: "batch_123",
            status: "processing",
            templateKey: "digest",
            templateVersion: 3,
            senderUsed: "alerts@huefy.dev",
            senderVerified: true,
            totalRecipients: 2,
            processedCount: 0,
            successCount: 0,
            failureCount: 0,
            suppressedCount: 0,
            startedAt: "2026-05-07T10:00:00Z",
            recipients: [
              { email: "alice@example.com", status: "queued" },
              { email: "bob@example.com", status: "queued" },
            ],
          },
          correlationId: "corr_bulk_123",
        };
      },
    };

    const response = await emailClient.sendBulkEmails({
      templateKey: " digest ",
      recipients: [
        { email: " alice@example.com ", type: "to", data: { locale: "en" } },
        { email: " bob@example.com ", type: "bcc" },
      ],
      provider: "mailgun",
    });

    const body = capturedOptions.body;
    const recipients = body.recipients;
    const ok =
      capturedPath === "/emails/send-bulk" &&
      capturedOptions.method === "POST" &&
      body.templateKey === "digest" &&
      body.providerType === "mailgun" &&
      recipients[0].email === "alice@example.com" &&
      recipients[0].type === "to" &&
      recipients[1].type === "bcc" &&
      response.data.batchId === "batch_123";
    check("Bulk email contract", ok, ok ? "" : JSON.stringify({ capturedPath, capturedOptions, response }));
  } catch (error) {
    check("Bulk email contract", false, String(error));
  }

  try {
    const emailClient = new HuefyEmailClient({ apiKey: "sdk_lab_test_key" });
    emailClient.http = { request: async () => ({}) };
    await emailClient.sendEmail({
      templateKey: "welcome",
      data: {},
      recipient: { email: "not-an-email" },
    });
    check("Validation rejects invalid single recipient", false, "expected validation error");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check("Validation rejects invalid single recipient", /invalid email/i.test(message), message);
  }

  try {
    const emailClient = new HuefyEmailClient({ apiKey: "sdk_lab_test_key" });
    emailClient.http = { request: async () => ({}) };
    await emailClient.sendBulkEmails({ templateKey: "digest", recipients: [] });
    check("Validation rejects invalid bulk request", false, "expected validation error");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check("Validation rejects invalid bulk request", /at least one (recipient|email)/i.test(message), message);
  }

  try {
    const healthClient = new HuefyEmailClient({ apiKey: "sdk_lab_test_key" });
    let capturedPath = "";
    let capturedMethod = "";
    healthClient.http = {
      request: async (path, options) => {
        capturedPath = path;
        capturedMethod = String((options && options.method) || "");
        return {
          success: true,
          data: {
            status: "healthy",
            timestamp: "2026-05-07T10:00:00Z",
            version: "1.0.0",
          },
          correlationId: "corr_health_123",
        };
      },
    };
    const response = await healthClient.healthCheck();
    const ok =
      capturedPath === "/health" &&
      capturedMethod === "GET" &&
      response.data.status === "healthy";
    check("Health check path", ok, ok ? "" : JSON.stringify({ capturedPath, capturedMethod, response }));
  } catch (error) {
    check("Health check path", false, String(error));
  }

  try {
    client && client.close();
    check("Cleanup", true);
  } catch (error) {
    check("Cleanup", false, String(error));
  }
}

async function runLive() {
  const live = getLiveConfig();
  let client;

  try {
    client = new HuefyEmailClient({
      apiKey: live.apiKey,
      baseUrl: live.baseUrl,
    });
    check("Initialization", true);
  } catch (error) {
    check("Initialization", false, String(error));
    return;
  }

  try {
    const response = await client.healthCheck();
    const ok = response.success === true && response.data.status === "healthy";
    check("Health check", ok, ok ? "" : JSON.stringify(response));
  } catch (error) {
    check("Health check", false, String(error));
  }

  try {
    const response = await client.sendEmail({
      templateKey: live.templateKey,
      data: { sdkLabMode: "live", sdk: "typescript", operation: "single" },
      recipient: live.recipient,
      ...(live.provider ? { provider: live.provider } : {}),
    });
    const ok =
      response.success === true &&
      typeof response.data.emailId === "string" &&
      response.data.emailId.length > 0;
    check("Single send", ok, ok ? "" : JSON.stringify(response));
  } catch (error) {
    check("Single send", false, String(error));
  }

  try {
    const response = await client.sendBulkEmails({
      templateKey: live.templateKey,
      recipients: [
        { email: live.recipient, type: "to", data: { sdkLabMode: "live", sdk: "typescript", operation: "bulk" } },
      ],
      ...(live.provider ? { provider: live.provider } : {}),
    });
    const ok =
      response.success === true &&
      typeof response.data.batchId === "string" &&
      response.data.batchId.length > 0 &&
      response.data.totalRecipients >= 1;
    check("Bulk send", ok, ok ? "" : JSON.stringify(response));
  } catch (error) {
    check("Bulk send", false, String(error));
  }

  try {
    await client.sendEmail({
      templateKey: live.templateKey,
      data: { sdkLabMode: "live", sdk: "typescript", operation: "invalid-single" },
      recipient: "not-an-email",
      ...(live.provider ? { provider: live.provider } : {}),
    });
    check("Invalid single rejection", false, "expected validation error");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check("Invalid single rejection", /invalid email/i.test(message), message);
  }

  try {
    await client.sendBulkEmails({
      templateKey: live.templateKey,
      recipients: [],
      ...(live.provider ? { provider: live.provider } : {}),
    });
    check("Invalid bulk rejection", false, "expected validation error");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check("Invalid bulk rejection", /at least one (recipient|email)/i.test(message), message);
  }

  try {
    client.close();
    check("Cleanup", true);
  } catch (error) {
    check("Cleanup", false, String(error));
  }
}

async function run() {
  console.log("=== Huefy TypeScript SDK Lab ===\n");
  console.log(`Mode: ${LIVE_MODE ? "live" : "contract"}\n`);

  if (LIVE_MODE) {
    await runLive();
  } else {
    await runContract();
  }

  console.log("\n========================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("========================================\n");

  if (failed === 0) {
    console.log("All verifications passed!");
    process.exit(0);
  }

  process.exit(1);
}

run().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
