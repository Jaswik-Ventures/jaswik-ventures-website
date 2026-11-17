# Jaswik Ventures — Supabase enquiry integration

## What's included
- `jaswik-ventures-supabase-ready.html`: updated website with Supabase submission and WhatsApp CTA.
- `supabase-schema.sql`: database table and locked-down RLS permissions.
- `supabase/functions/submit-enquiry/index.ts`: Edge Function to validate, save and email new enquiries.

## 1. Create Supabase project
Create a Supabase project, then open SQL Editor and run `supabase-schema.sql`.

## 2. Deploy Edge Function
Install/configure the Supabase CLI, log in, link your project, then deploy:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy submit-enquiry
```

Set function secrets (replace values locally; do not commit them):
```bash
supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxx \
  NOTIFICATION_TO=info@jaswikventures.in \
  EMAIL_FROM="Jaswik Ventures <enquiries@jaswikventures.in>" \
  ALLOWED_ORIGIN=https://jaswikventures.in
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available to the Edge Function in the Supabase environment. If your project setup does not expose them automatically, add them as secrets from the Supabase dashboard. Never expose the service-role key in the HTML.

## 3. Configure the HTML
Open `jaswik-ventures-supabase-ready.html` and find `ENQUIRY_CONFIG` near the top of the script:
```js
const ENQUIRY_CONFIG = {
  endpoint: "https://YOUR_PROJECT_REF.supabase.co/functions/v1/submit-enquiry",
  whatsappNumber: "91XXXXXXXXXX"
};
```
Use the full WhatsApp Business number with country code and digits only. Do not include `+`, spaces or punctuation.

## 4. Resend setup
- Create a Resend account.
- Verify `jaswikventures.in` by adding the DNS records Resend provides at your DNS host.
- Create an API key.
- Set `RESEND_API_KEY` as a Supabase Edge Function secret.
- Use a sender address on the verified domain, e.g. `enquiries@jaswikventures.in`.
- Keep `NOTIFICATION_TO=info@jaswikventures.in`.

## 5. Shared hosting deployment
Upload the configured HTML file as `public_html/index.html` (or the document root used by your host). Keep an original backup before replacing the live file. No Node runtime is required on shared hosting; the backend runs on Supabase.

## Important behaviour / security
- Public browser code calls only the Edge Function URL.
- Supabase service-role credentials stay server-side.
- The table has RLS enabled and no public table policies.
- The saved quotation is a customer-submitted snapshot for review; it is not independently recomputed server-side. Confirm the actual scope and commercial terms before accepting the order or issuing a binding quotation.
- The Edge Function saves the lead even if the Resend notification fails; check function logs and the Supabase table if email delivery is delayed.
- WhatsApp will remain unconfigured until the actual business number is supplied.
- Mobile number validation checks format only. OTP verification is not included in this phase.
