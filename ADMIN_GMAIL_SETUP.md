# Using Gmail for Admin Access

Since `spana.co.za` domain is unreachable, you can now use Gmail addresses for admin access.

## Quick Setup

### 1. Create Admin User with Gmail

You can now register or manually create an admin user with a Gmail address:

```bash
# Example: Create admin with Gmail
email: "yourname@gmail.com"
role: "admin"
```

### 2. Login with Gmail Admin

The system will now:
- Accept Gmail addresses as admin emails
- Send OTP to Gmail address
- Allow admin login with Gmail

### 3. Configure Domains (Optional)

In `.env` file:
```env
ADMIN_EMAIL_DOMAINS=@spana.co.za,@gmail.com
```

Or use only Gmail:
```env
ADMIN_EMAIL_DOMAINS=@gmail.com
```

## How It Works

1. **Registration**: Gmail addresses ending with `@gmail.com` are automatically treated as admin
2. **Login**: Admin login with Gmail works the same as `@spana.co.za`
3. **OTP**: OTP emails are sent to Gmail address via Gmail SMTP
4. **Verification**: All admin endpoints accept Gmail addresses

## Example: Create Gmail Admin

1. Register with Gmail address (auto-detected as admin)
2. Or manually set role to 'admin' in database
3. Login with Gmail + password
4. Receive OTP via email
5. Verify OTP and access admin panel

## Security Notes

- Gmail addresses are now accepted for admin access
- OTP still required for admin login
- Can restrict to specific Gmail addresses if needed
- Consider reverting to `@spana.co.za` only when domain is restored

## Reverting to Spana Domain Only

When `spana.co.za` is restored, update `.env`:
```env
ADMIN_EMAIL_DOMAINS=@spana.co.za
```

Then restart backend server.
