# Stripe 402/400 Error Fix

## Problem

Stripe logs show 402 and 400 errors when trying to confirm payment intents:
- `POST /v1/payment_intents/pi_.../confirm` → 402 ERR
- Payment intent status is `requires_payment_method`

## Root Cause

The errors occur when:
1. Payment intents are created successfully (status: `requires_payment_method`)
2. Something tries to confirm them before a payment method is attached
3. Stripe returns 402 (Payment Required) or 400 (Bad Request)

## Analysis

### What's Happening:
- Payment intents are created with `automatic_payment_methods: { enabled: true }`
- Status starts as `requires_payment_method` (needs payment method attached)
- Frontend/mobile app should attach payment method and confirm via Stripe SDK
- But something is trying to confirm before payment method is attached

### Current Backend Behavior:
- Backend `confirmPayment` endpoint only **retrieves** payment intent status
- It checks if `status === 'succeeded'` and returns error if not
- Backend does NOT call `paymentIntents.confirm()` API

### Where Errors Come From:
The 402/400 errors in Stripe logs are likely from:
1. **Frontend/Mobile App**: Calling Stripe SDK `confirmPayment()` before payment method attached
2. **Test Code**: Manual API calls trying to confirm payment intents
3. **Retry Logic**: Automatic retries that don't check status first

## Solution

### 1. Improved Error Handling ✅

Updated `confirmPayment` endpoint to:
- Provide specific error messages for each payment intent status
- Return appropriate HTTP status codes (402 for `requires_payment_method`)
- Include `clientSecret` in error response so frontend can retry
- Add `requiresAction` flag to indicate if user action is needed

### 2. Frontend Recommendations

**For Checkout Sessions:**
- Don't call confirm API until user completes Stripe Checkout
- Wait for `session.payment_status === 'paid'` before calling confirm endpoint
- Use webhook as primary confirmation method

**For Payment Intents:**
- Attach payment method first: `stripe.confirmCardPayment(clientSecret, { payment_method: {...} })`
- Only call backend confirm endpoint after Stripe SDK confirms successfully
- Handle `requires_action` status for 3D Secure

### 3. Status Flow

```
Payment Intent Created
  ↓
requires_payment_method (needs payment method)
  ↓
[Frontend attaches payment method]
  ↓
requires_confirmation (needs confirmation)
  ↓
[Frontend confirms via Stripe SDK]
  ↓
processing (being processed)
  ↓
succeeded ✅ (payment complete)
```

## Error Codes Reference

| Status | HTTP Code | Meaning | Action Required |
|--------|-----------|---------|----------------|
| `requires_payment_method` | 402 | No payment method attached | Attach payment method |
| `requires_confirmation` | 400 | Needs confirmation | Confirm via Stripe SDK |
| `requires_action` | 400 | Needs 3D Secure/auth | Complete authentication |
| `processing` | 400 | Being processed | Wait and retry |
| `requires_capture` | 400 | Needs capture | Should be automatic |
| `canceled` | 400 | Payment canceled | Create new payment |
| `succeeded` | 200 | Payment successful | ✅ Done |

## Testing

To test payment flow:
1. Create payment intent → Status should be `requires_payment_method`
2. Attach payment method via Stripe SDK → Status changes to `requires_confirmation`
3. Confirm via Stripe SDK → Status changes to `processing` then `succeeded`
4. Call backend confirm endpoint → Should return success

## Prevention

1. **Don't call confirm API prematurely**: Only call after payment method attached and confirmed
2. **Use webhooks**: Primary confirmation method (more reliable)
3. **Check status first**: Always check payment intent status before confirming
4. **Handle errors gracefully**: Show user-friendly messages for each status

## Related Files

- `controllers/paymentController.ts` - `confirmPayment` endpoint
- `mobile/components/payment-popup.tsx` - Frontend payment handling
- `mobile/screens/customer/CustomerBookings.tsx` - Payment confirmation logic
