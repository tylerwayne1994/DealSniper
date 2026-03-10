/**
 * Cloudflare Email Worker for DealSniper
 *
 * Receives emails at @dealsniper.org via Cloudflare Email Routing,
 * and forwards the raw MIME to the backend webhook for instant processing.
 *
 * Setup:
 * 1. Enable Email Routing in Cloudflare for dealsniper.org
 * 2. Deploy this worker: `npx wrangler deploy`
 * 3. Set the webhook secret: `npx wrangler secret put WEBHOOK_SECRET`
 * 4. In Cloudflare Email Routing, add a catch-all rule → Send to Worker → dealsniper-email-worker
 */

export default {
  async email(message, env, ctx) {
    const from = message.from;
    const to = message.to;
    const subject = message.headers.get("subject") || "(no subject)";

    console.log(`[EmailWorker] Received email from=${from} to=${to} subject=${subject}`);

    try {
      // Read the raw MIME message
      const rawEmail = await new Response(message.raw).arrayBuffer();
      const rawBytes = new Uint8Array(rawEmail);

      console.log(`[EmailWorker] Raw MIME size: ${rawBytes.length} bytes`);

      // Forward to backend webhook
      const backendUrl = env.BACKEND_URL || "https://dealsniper-oh9v.onrender.com/api/email-underwrite/inbound-webhook";
      const webhookSecret = env.WEBHOOK_SECRET || "";

      const response = await fetch(backendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "message/rfc822",
          "X-Webhook-Secret": webhookSecret,
          "X-Original-From": from,
          "X-Original-To": to,
          "X-Original-Subject": subject,
        },
        body: rawBytes,
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[EmailWorker] Backend accepted: ${JSON.stringify(result)}`);
      } else {
        const errText = await response.text();
        console.error(`[EmailWorker] Backend error ${response.status}: ${errText}`);
        // Don't reject — Cloudflare would bounce the email to the sender
      }
    } catch (err) {
      console.error(`[EmailWorker] Failed to forward email: ${err.message}`);
      // Don't throw — would bounce the email
    }
  },

  // Also handle HTTP requests for health checks
  async fetch(request, env) {
    return new Response(JSON.stringify({
      status: "ok",
      service: "dealsniper-email-worker",
      backend: env.BACKEND_URL,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
