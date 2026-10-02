// Supabase Auth "Send SMS" hook: delivers sign-in codes over WhatsApp through
// Meta's Cloud API instead of Twilio. With the hook enabled, Supabase calls
// this for every phone OTP (any channel) and expects an empty JSON 200 back.
// Docs: https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook

import { Webhook } from "npm:standardwebhooks@1.0.0";

type SendSmsPayload = {
  user: { phone: string };
  sms: { otp: string };
};

const env = (name: string, fallback?: string) => {
  const value = Deno.env.get(name) ?? fallback;
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
};

// Shape Supabase Auth expects when the hook fails; the message reaches the app
const hookError = (status: number, message: string) =>
  Response.json({ error: { http_code: status, message } }, { status });

Deno.serve(async (req) => {
  if (req.method !== "POST") return hookError(405, "Method not allowed");

  let payload: SendSmsPayload;
  try {
    // Supabase signs hook requests; the secret is stored as "v1,whsec_<base64>"
    const secret = env("SEND_SMS_HOOK_SECRET").replace("v1,whsec_", "");
    const body = await req.text();
    payload = new Webhook(secret).verify(
      body,
      Object.fromEntries(req.headers),
    ) as SendSmsPayload;
  } catch {
    return hookError(401, "Invalid hook signature");
  }

  const { otp } = payload.sms;
  // Supabase stores phones without "+"; Meta accepts both
  const to = payload.user.phone.replace(/^\+/, "");

  // Authentication template: fixed body "<code> est votre code de vérification"
  // and a copy-code button, both filled with the same code
  const message = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: env("WHATSAPP_TEMPLATE_NAME"),
      language: { code: env("WHATSAPP_TEMPLATE_LANGUAGE", "fr") },
      components: [
        { type: "body", parameters: [{ type: "text", text: otp }] },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: otp }],
        },
      ],
    },
  };

  const apiBase = env("WHATSAPP_API_BASE", "https://graph.facebook.com/v23.0");
  const url = `${apiBase}/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("WHATSAPP_ACCESS_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      // Meta's error body names the cause (bad template, number not on
      // WhatsApp, rate limit...); keep it in the function logs only
      console.error("WhatsApp send failed", res.status, await res.text());
      return hookError(502, "Could not send the WhatsApp code");
    }
  } catch (error) {
    console.error("WhatsApp request error", error);
    return hookError(502, "Could not send the WhatsApp code");
  }

  // Supabase Auth rejects a hook response without a JSON Content-Type
  return Response.json({});
});
