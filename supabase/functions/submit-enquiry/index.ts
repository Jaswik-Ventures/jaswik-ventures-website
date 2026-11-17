// Supabase Edge Function: submit-enquiry
// Deploy: supabase functions deploy submit-enquiry
// Required secrets:
//   SUPABASE_URL (usually provided automatically)
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY
//   NOTIFICATION_TO=info@jaswikventures.in
//   EMAIL_FROM=Jaswik Ventures <enquiries@jaswikventures.in>
//   ALLOWED_ORIGIN=https://jaswikventures.in

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "https://jaswikventures.in",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function cleanString(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function safeNumber(value: unknown, min = 0, max = 1_000_000) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();

    // Honeypot: pretend success without storing automated spam.
    if (cleanString(body.website, 200)) return json({ ok: true });

    const name = cleanString(body.customer_name, 80);
    const mobile = cleanString(body.mobile_number, 24);
    const digits = mobile.replace(/\D/g, "");
    const currency = cleanString(body.currency, 3).toUpperCase();
    const layer = cleanString(body.layer_count, 3);
    const parts = safeNumber(body.component_count, 10, 1000);
    const subtotal = safeNumber(body.design_subtotal, 0, 100_000_000);
    const gstRate = safeNumber(body.gst_rate, 0, 1);
    const gst = safeNumber(body.gst_amount, 0, 100_000_000);
    const total = safeNumber(body.quotation_total, 0, 100_000_000);
    const customParts = safeNumber(body.custom_parts ?? 0, 0, 100);

    if (name.length < 2) return json({ error: "Please enter a valid name." }, 400);
    if (digits.length < 8 || digits.length > 15) return json({ error: "Please enter a valid mobile number." }, 400);
    if (!["INR", "USD"].includes(currency)) return json({ error: "Invalid currency." }, 400);
    if (!["2", "4", "6+"].includes(layer)) return json({ error: "Invalid layer count." }, 400);
    if (parts === null || subtotal === null || gstRate === null || gst === null || total === null || customParts === null) {
      return json({ error: "Invalid quotation values." }, 400);
    }

    // Treat browser-calculated quote as a submitted snapshot, not a binding
    // final offer. Reconfirm scope and pricing before accepting work.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const enquiryRef = `JV-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
    const row = {
      enquiry_ref: enquiryRef,
      customer_name: name,
      mobile_number: mobile,
      currency,
      layer_count: layer,
      component_count: parts,
      starting_point: cleanString(body.starting_point, 160),
      technical_complexity: Array.isArray(body.technical_complexity) ? body.technical_complexity.slice(0,10) : [],
      addons: Array.isArray(body.addons) ? body.addons.slice(0,10) : [],
      custom_parts: customParts,
      turnaround: cleanString(body.turnaround, 60),
      design_subtotal: subtotal,
      gst_rate: gstRate,
      gst_amount: gst,
      quotation_total: total,
      delivery_days: cleanString(body.delivery_days, 40),
      quote_breakdown: Array.isArray(body.quote_breakdown) ? body.quote_breakdown.slice(0,30) : [],
      quote_text: cleanString(body.quote_text, 10000),
    };

    const { error: insertError } = await supabase.from("pcb_enquiries").insert(row);
    if (insertError) {
      console.error("Supabase insert failed", insertError);
      return json({ error: "We could not save your enquiry. Please try again shortly." }, 500);
    }

    // Email failure must not discard a successfully saved lead.
    let notificationSent = false;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const to = Deno.env.get("NOTIFICATION_TO") ?? "info@jaswikventures.in";
      const from = Deno.env.get("EMAIL_FROM") ?? "Jaswik Ventures <enquiries@jaswikventures.in>";
      const emailText = [
        `New PCB Design Enquiry: ${enquiryRef}`,
        "",
        `Customer: ${name}`,
        `Mobile: ${mobile}`,
        "",
        cleanString(body.quote_text, 10000),
        "",
        `Subtotal: ${currency} ${subtotal.toFixed(2)}`,
        `GST: ${currency} ${gst.toFixed(2)}`,
        `Total incl. GST: ${currency} ${total.toFixed(2)}`,
        "",
        "This is a customer-submitted quotation snapshot. Confirm scope before issuing/accepting a final commercial quote.",
      ].join("\n");

      try {
        const mail = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from, to: [to],
            subject: `New PCB Design Enquiry — ${enquiryRef}`,
            text: emailText,
          }),
        });
        notificationSent = mail.ok;
        if (!mail.ok) console.error("Resend notification failed", await mail.text());
      } catch (e) {
        console.error("Resend request error", e);
      }
    }

    return json({ ok: true, enquiry_id: enquiryRef, notification_sent: notificationSent }, 201);
  } catch (error) {
    console.error("Unhandled enquiry error", error);
    return json({ error: "Invalid request. Please check your details and try again." }, 400);
  }
});
