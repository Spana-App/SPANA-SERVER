# Stripe Webhook Setup Guide for Render

## Overview
Your webhook endpoint is: `POST /payments/webhook`
Full URL on Render: `https://spana-server-5bhu.onrender.com/payments/webhook`

## Step 1: Configure Webhook in Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/webhooks) (or production dashboard)
2. Click **"Add endpoint"** or edit existing endpoint
3. Set the endpoint URL to:
   ```
   https://spana-server-5bhu.onrender.com/payments/webhook
   ```
4. Select events to listen for:
   - ✅ `payment_intent.succeeded` (required)
   - Optionally: `payment_intent.payment_failed`, `charge.succeeded`, etc.
5. Click **"Add endpoint"**

## Step 2: Get the Webhook Signing Secret

After creating the webhook endpoint:

1. Click on the webhook endpoint you just created
2. In the **"Signing secret"** section, click **"Reveal"** or **"Click to reveal"**
3. Copy the secret (starts with `whsec_...`)
   - Example: `whsec_cANlacyNnl0OyYqYghqIsE0NC2XDau6l`

## Step 3: Set Environment Variable on Render

1. Go to your Render dashboard: https://dashboard.render.com
2. Navigate to your service: `spana-server-5bhu`
3. Go to **Environment** tab
4. Click **"Add Environment Variable"**
5. Add:
   - **Key**: `STRIPE_WEBHOOK_SECRET`
   - **Value**: Paste the webhook secret from Step 2 (the `whsec_...` value)
6. Click **"Save Changes"**
7. **Redeploy** your service (Render will auto-redeploy when you save env vars)

## Step 4: Verify Webhook is Working

### Test the Webhook

1. In Stripe Dashboard, go to your webhook endpoint
2. Click **"Send test webhook"**
3. Select event: `payment_intent.succeeded`
4. Click **"Send test webhook"**
5. Check the **"Recent deliveries"** section for status:
   - ✅ **200** = Success
   - ❌ **400/500** = Error (check logs)

### Check Logs on Render

1. Go to Render dashboard → Your service → **Logs** tab
2. Look for webhook-related logs:
   - ✅ `Stripe webhook: Payment already processed` = Working correctly
   - ❌ `Stripe webhook signature verification failed` = Wrong secret
   - ❌ `Stripe webhook: payment record not found` = Payment not created first

## Important Notes

### Test vs Production

- **Test Mode**: Use test webhook secret (starts with `whsec_`)
- **Production Mode**: Use production webhook secret (also starts with `whsec_` but different value)
- Make sure `STRIPE_SECRET_KEY` matches the mode (test = `sk_test_...`, production = `sk_live_...`)

### Current Configuration

Your `.env` file has:
```
STRIPE_SECRET_KEY=sk_test_... (test mode)
STRIPE_WEBHOOK_SECRET=whsec_cANlacyNnl0OyYqYghqIsE0NC2XDau6l
```

**Important**: The webhook secret in your `.env` is for **local development** or **test mode**. 
For production on Render, you need to:
1. Create a **production webhook endpoint** in Stripe Dashboard (not test mode)
2. Get the **production webhook secret**
3. Set it in Render's environment variables

### Webhook Security

The webhook handler verifies signatures using the secret:
- ✅ **With secret**: Verifies Stripe signature (secure)
- ⚠️ **Without secret**: Falls back to re-fetching PaymentIntent (less secure, but works)

## Troubleshooting

### Webhook returns 400
- Check that `STRIPE_WEBHOOK_SECRET` is set correctly on Render
- Verify the secret matches the webhook endpoint in Stripe Dashboard
- Make sure you're using the correct secret for test vs production

### Webhook returns 200 but booking not updated
- Check Render logs for errors
- Verify payment record exists in database
- Check that `payment_intent.succeeded` event is being sent

### Webhook not receiving events
- Verify webhook URL is correct: `https://spana-server-5bhu.onrender.com/payments/webhook`
- Check that Render service is running
- Verify webhook endpoint is enabled in Stripe Dashboard
- Check "Recent deliveries" in Stripe Dashboard for delivery status

## Quick Checklist

- [ ] Webhook endpoint created in Stripe Dashboard
- [ ] Webhook URL set to: `https://spana-server-5bhu.onrender.com/payments/webhook`
- [ ] Event `payment_intent.succeeded` selected
- [ ] Webhook secret copied from Stripe Dashboard
- [ ] `STRIPE_WEBHOOK_SECRET` environment variable set on Render
- [ ] Render service redeployed after setting env var
- [ ] Test webhook sent and received 200 response
- [ ] Checked Render logs for webhook activity
