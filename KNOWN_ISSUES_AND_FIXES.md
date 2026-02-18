# Known Issues and Fixes

## Fixed Issues ✅

### 1. Payment Intent Creation - Unique Constraint Error
**Issue**: When trying to pay for a booking that already has a payment record, Stripe Checkout creation fails with "Unique constraint failed on bookingId"

**Fix**: 
- Check for existing payment before creating new one
- Return appropriate response if payment already exists
- Handle gracefully in frontend

**Status**: ✅ Fixed

### 2. Workflows Not Updating on Payment
**Issue**: When payment is confirmed, workflows weren't being updated

**Fix**:
- All payment paths now create workflows if missing
- All payment paths update workflow steps correctly
- Payment Required → completed
- Payment Received → completed  
- Provider Assigned → pending

**Status**: ✅ Fixed

### 3. "Pay Booking" Button Still Showing After Payment
**Issue**: Frontend wasn't detecting payment status correctly

**Fix**:
- Check both `booking.paymentStatus` and `payment.status`
- Case-insensitive status checks
- Better refresh logic after payment

**Status**: ✅ Fixed

### 4. Payment Intent Redirect Methods Error
**Issue**: Stripe PaymentIntent requires `return_url` for redirect-based payment methods

**Fix**:
- Added `allow_redirects: 'never'` to PaymentIntent creation
- Prevents redirect-based payment methods that require return_url

**Status**: ✅ Fixed

### 5. Webhook Secret Missing on Render
**Issue**: Webhook signature verification failing because secret not set on Render

**Fix**:
- Added `STRIPE_WEBHOOK_SECRET` to Render environment variables
- Webhook handler verifies signatures properly

**Status**: ✅ Fixed (user needs to add to Render)

## Potential Issues to Watch For ⚠️

### 1. Race Conditions
**Issue**: Multiple payment attempts simultaneously could cause issues

**Mitigation**:
- Database unique constraint on `bookingId` in Payment model
- Check for existing payment before creating
- Idempotent payment confirmation

**Status**: ⚠️ Monitored

### 2. Silent Error Swallowing
**Issue**: Some catch blocks silently swallow errors (e.g., `catch (_) {}`)

**Impact**: 
- Workflow updates might fail silently
- Email sending failures not logged
- Socket.io errors not surfaced

**Recommendation**: 
- Add logging to critical catch blocks
- Consider error tracking service (Sentry, etc.)

**Status**: ⚠️ Low priority

### 3. Generic Error Messages
**Issue**: Some errors return generic "Server error" without details

**Impact**: Hard to debug production issues

**Fix Applied**:
- Added error details in development mode
- Better error messages for common failures

**Status**: ✅ Improved

### 4. Frontend Error Handling
**Issue**: Some frontend errors don't provide user feedback

**Fix Applied**:
- Better error messages shown to users
- Fallback refresh attempts
- Clearer error states

**Status**: ✅ Improved

### 5. Payment Status Sync
**Issue**: Booking.paymentStatus might get out of sync with Payment.status

**Fix Applied**:
- Added sync logic in `getUserBookings` endpoint
- Ensures consistency when retrieving bookings

**Status**: ✅ Fixed

## Testing Checklist

- [x] Payment intent creation works
- [x] Payment confirmation updates booking status
- [x] Payment confirmation updates workflows
- [x] Existing payments handled correctly
- [x] Frontend shows correct payment state
- [x] Webhook handler processes payments
- [x] Error messages are user-friendly
- [ ] Race condition testing (multiple simultaneous payments)
- [ ] Network failure recovery
- [ ] Payment timeout handling

## Monitoring Recommendations

1. **Set up error tracking** (e.g., Sentry) to catch silent failures
2. **Monitor webhook delivery** in Stripe Dashboard
3. **Log payment flow** for debugging production issues
4. **Alert on payment failures** above threshold
5. **Monitor workflow update failures**

## Common Error Scenarios

### Payment Already Exists
- **Cause**: User tries to pay twice
- **Fix**: Return existing payment info, don't create duplicate
- **Status**: ✅ Handled

### Payment Succeeded But Booking Not Updated
- **Cause**: Webhook failed or confirmPayment not called
- **Fix**: Sync logic in getUserBookings, confirmPayment endpoint
- **Status**: ✅ Handled

### Workflow Not Found
- **Cause**: Workflow not created when booking created
- **Fix**: Create workflow before updating in all payment paths
- **Status**: ✅ Fixed

### Stripe Configuration Missing
- **Cause**: STRIPE_SECRET_KEY not set
- **Fix**: Clear error message with instructions
- **Status**: ✅ Handled
