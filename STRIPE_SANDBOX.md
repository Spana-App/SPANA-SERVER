# Stripe Sandbox Integration

Use **test mode** keys so no real charges are made.

## 1. Get test keys

1. Sign in at [Stripe Dashboard](https://dashboard.stripe.com).
2. Turn **Test mode** on (toggle in the sidebar).
3. Go to **Developers → API keys**.
4. Copy:
   - **Secret key** (starts with `sk_test_...`)
   - **Publishable key** (starts with `pk_test_...`)

## 2. Configure backend

In `.env`:

```env
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxx
```

Optional (needed for webhooks):

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx
```

## 3. Create a payment intent (Stripe)

**POST** `/payments/intent` with body:

```json
{
  "bookingId": "<booking-id>",
  "amount": 650,
  "currency": "ZAR",
  "tipAmount": 0,
  "gateway": "stripe"
}
```

Response includes:

- `clientSecret` – use with Stripe.js / Stripe Elements on the frontend to confirm the payment.
- `stripePublishableKey` – use to initialise Stripe.js (or use your own `pk_test_...` from the Dashboard).

Use **gateway: "payfast"** (or omit) to keep using PayFast.

## 4. Frontend (Stripe.js)

1. Load Stripe.js and initialise with the publishable key.
2. Use `clientSecret` from the create-intent response to confirm the payment (e.g. `stripe.confirmCardPayment(clientSecret, { payment_method: { card: cardElement } })`).
3. Do **not** send card details to your backend; Stripe.js talks to Stripe directly.

Example (conceptual):

```js
const stripe = await loadStripe(publishableKey);
const { error } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: { card: cardElement }
});
if (error) {
  // Show error
} else {
  // Payment will be confirmed; backend is updated via webhook
}
```

## 5. Webhooks (optional but recommended)

Stripe notifies your server when a payment succeeds. For local testing use the [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe listen --forward-to http://localhost:5003/payments/webhook
```

Use the printed `whsec_...` as `STRIPE_WEBHOOK_SECRET` in `.env`.

In production, add an endpoint in **Developers → Webhooks**:

- URL: `https://your-api.com/payments/webhook`
- Event: `payment_intent.succeeded`

Stripe will show a signing secret; set that as `STRIPE_WEBHOOK_SECRET`.

## 6. Test cards (Stripe test mode)

- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- Use any future expiry and any 3-digit CVC. See [Stripe test cards](https://stripe.com/docs/testing#cards).

## Summary

| Item              | Value                          |
|-------------------|---------------------------------|
| Create intent     | `POST /payments/intent` + `gateway: "stripe"` |
| Frontend confirm  | Stripe.js + `clientSecret`      |
| Webhook URL       | `POST /payments/webhook`        |
| Env vars          | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, optional `STRIPE_WEBHOOK_SECRET` |
