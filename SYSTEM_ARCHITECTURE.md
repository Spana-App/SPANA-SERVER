# SPANA System Architecture

## Three Systems Overview

The SPANA platform consists of **three distinct user systems**, each with its own registration and authentication flow:

---

## 1. Admin System (CMS)

**Who:** Platform administrators  
**Created by:** Other admins via CMS  
**Password:** Auto-generated (12 characters)  
**Email:** Credentials sent via email

### Flow:
1. **Existing admin** creates new admin via CMS
2. System **auto-generates password** (12 chars: letters, numbers, special chars)
3. System sends **credentials email** with:
   - Email address (username)
   - Auto-generated password
   - Instructions to change password after first login
4. New admin logs in with credentials
5. Admin can update profile/password via `/admin/profile`

### Endpoints:
- `POST /admin/admins/register` - Create new admin (admin only)
- `PUT /admin/profile` - Update admin profile/password

### Email:
- **Subject:** "Your SPANA Admin Account Credentials 🔐"
- **Contains:** Email + auto-generated password
- **Warning:** Change password after first login

---

## 2. Customer System (App)

**Who:** End users who book services  
**Created by:** Themselves (self-registration)  
**Password:** User sets their own password  
**Email:** Verification email sent

### Flow:
1. Customer **registers themselves** via app (`/auth/register`)
2. Customer **sets their own password** during registration
3. System sends **verification email**
4. Customer verifies email
5. Customer can log in with their chosen password

### Endpoints:
- `POST /auth/register` - Customer self-registration
- `POST /auth/login` - Customer login

### Email:
- **Subject:** "Verify your account"
- **Contains:** Email verification link
- **No password** (customer set it during registration)

---

## 3. Service Provider System (Admin-Created)

**Who:** Service providers who offer services  
**Created by:** Admins via CMS  
**Password:** Provider sets their own password (on profile completion form)  
**Email:** Welcome email with profile completion link

### Flow:
1. **Admin** creates service provider via CMS
2. System creates user with **placeholder password**
3. System sends **welcome email** with profile completion link
4. Provider clicks link and **completes profile form**
5. Provider **sets their own password** on the form
6. Provider profile is marked as complete
7. Provider can log in with their chosen password

### Endpoints:
- `POST /admin/providers/register` - Create service provider (admin only)
- `GET /complete-registration` - Profile completion form
- `POST /complete-registration` - Submit profile and set password

### Email:
- **Subject:** "Welcome to SPANA, [Name]! 🎉"
- **Contains:** Profile completion link
- **No password** (provider sets it on form)

---

## Summary Table

| System | Created By | Password Source | Email Contains |
|--------|-----------|----------------|----------------|
| **Admin** | Other admins (CMS) | Auto-generated | Email + Password |
| **Customer** | Themselves (App) | User sets | Verification link |
| **Service Provider** | Admins (CMS) | User sets (on form) | Profile completion link |

---

## Key Differences

### Auto-Generated Passwords
- **ONLY admins** get auto-generated passwords
- Customers and service providers set their own passwords

### Registration Location
- **Admins:** Created via CMS by other admins
- **Customers:** Self-register via app
- **Service Providers:** Created via CMS by admins, then complete profile

### Password Setting
- **Admins:** Password sent via email (auto-generated)
- **Customers:** Password set during registration
- **Service Providers:** Password set on profile completion form

---

## Security Notes

1. **Admin passwords** are auto-generated for security and control
2. **Customer passwords** are user-chosen (standard practice)
3. **Service provider passwords** are set during profile completion (ensures they complete profile)
4. All passwords are hashed with bcrypt (12 rounds)
5. Admin email domains are restricted via `ADMIN_EMAIL_DOMAINS` env var

---

## Email Service

All emails are sent via:
- **Primary:** Gmail SMTP (`noreply.spana@gmail.com`)
- **Fallback:** Resend API (if configured)

Email service runs on `http://localhost:3000` (development) or Vercel (production).
