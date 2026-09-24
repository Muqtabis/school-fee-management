// =====================================================
// MESSAGING SERVICE
//
// Sends a document (the marksheet PDF) to a mobile
// number over WhatsApp, through a pluggable provider.
//
// Driver is chosen by env var MESSAGING_PROVIDER:
//   - "console" (default): logs the payload and marks
//     the send as successful. Lets the whole exam ->
//     publish -> "sent" flow be tested with NO real
//     credentials and nothing actually leaving the box.
//   - "msg91": real WhatsApp send via MSG91. Activated
//     only when MSG91 env vars are present.
//
// Every driver returns the same shape:
//   { success, provider, providerMessageId, error }
//
// so the caller (exam publish) records results uniformly.
// =====================================================

const fs = require("fs");
const path = require("path");


// =====================================================
// CONSOLE DRIVER (DEV DEFAULT)
// =====================================================

async function sendViaConsole({ phoneNumber, message, mediaPath }) {

    const exists = mediaPath ? fs.existsSync(mediaPath) : false;

    console.log("──────────────────────────────────────────");
    console.log("[messagingService] CONSOLE DRIVER — no real message sent");
    console.log("  to:        ", phoneNumber);
    console.log("  message:   ", message);
    console.log("  mediaPath: ", mediaPath || "(none)");
    console.log("  mediaFile: ", exists ? "present on disk ✓" : "MISSING ✗");
    console.log("──────────────────────────────────────────");

    // In dev we treat a present file as a successful "send".
    if (mediaPath && !exists) {
        return {
            success: false,
            provider: "console",
            providerMessageId: null,
            error: "Marksheet PDF not found on disk."
        };
    }

    return {
        success: true,
        provider: "console",
        providerMessageId: `console-${Date.now()}`,
        error: null
    };

}


// =====================================================
// MSG91 WHATSAPP DRIVER (REAL)
//
// Requires:
//   MSG91_AUTHKEY            - account auth key
//   MSG91_WHATSAPP_FROM      - approved WhatsApp sender number
//   MSG91_WHATSAPP_TEMPLATE  - approved template name
//   PUBLIC_MEDIA_BASE_URL    - public base URL where the
//                              marksheet PDF is reachable
//                              (WhatsApp fetches the doc by URL)
//
// The PDF must be reachable over a public HTTPS URL for
// WhatsApp to attach it; MSG91 does not accept raw file
// uploads for template documents.
// =====================================================

async function sendViaMsg91({ phoneNumber, message, mediaUrl, fileName }) {

    const authKey = process.env.MSG91_AUTHKEY;
    const from = process.env.MSG91_WHATSAPP_FROM;
    const template = process.env.MSG91_WHATSAPP_TEMPLATE;

    if (!authKey || !from || !template) {
        return {
            success: false,
            provider: "msg91",
            providerMessageId: null,
            error: "MSG91 WhatsApp env vars are not fully configured."
        };
    }

    if (!mediaUrl) {
        return {
            success: false,
            provider: "msg91",
            providerMessageId: null,
            error: "No public media URL available for the marksheet PDF."
        };
    }

    // MSG91 WhatsApp "bulk" endpoint. Payload shape follows
    // MSG91's documented template-message format. Kept minimal
    // and defensive; any non-2xx is reported as a failed send.
    const endpoint = "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/";

    const payload = {
        integrated_number: from,
        content_type: "template",
        payload: {
            to: phoneNumber,
            type: "template",
            template: {
                name: template,
                language: { code: "en", policy: "deterministic" },
                components: [
                    {
                        type: "header",
                        parameters: [
                            {
                                type: "document",
                                document: {
                                    link: mediaUrl,
                                    filename: fileName || "marksheet.pdf"
                                }
                            }
                        ]
                    },
                    {
                        type: "body",
                        parameters: [
                            { type: "text", text: message }
                        ]
                    }
                ]
            }
        }
    };

    try {
        const res = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                authkey: authKey
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            return {
                success: false,
                provider: "msg91",
                providerMessageId: null,
                error: `MSG91 responded ${res.status}: ${JSON.stringify(data)}`
            };
        }

        return {
            success: true,
            provider: "msg91",
            providerMessageId: data.request_id || data.messageId || null,
            error: null
        };

    } catch (err) {
        return {
            success: false,
            provider: "msg91",
            providerMessageId: null,
            error: err.message
        };
    }

}


// =====================================================
// PUBLIC API
//
// sendMarksheet({ phoneNumber, message, mediaPath,
//                 mediaUrl, fileName })
//
// - mediaPath: local path (used by console driver to
//   confirm the file exists).
// - mediaUrl:  public URL (used by msg91 driver).
// =====================================================

async function sendMarksheet(opts) {

    const provider = (process.env.MESSAGING_PROVIDER || "console").toLowerCase();

    if (provider === "msg91") {
        return sendViaMsg91(opts);
    }

    // Default / unknown -> safe console driver.
    return sendViaConsole(opts);

}


module.exports = {
    sendMarksheet,
    // exported for testing
    sendViaConsole,
    sendViaMsg91
};
