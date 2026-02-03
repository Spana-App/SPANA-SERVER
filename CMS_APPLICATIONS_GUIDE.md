# CMS Applications Management Guide

## Overview

This guide explains how to manage service provider applications in the CMS.

## Database Table

**Table Name**: `service_provider_applications`

**Prisma Model**: `ServiceProviderApplication`

## API Endpoints

### 1. Get All Applications

**Endpoint**: `GET /admin/applications`

**Query Parameters**:
- `status` (optional): Filter by status (`pending`, `approved`, `rejected`, `invited`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
```

**Example Requests**:
```bash
# Get all applications
GET /admin/applications

# Get only pending applications
GET /admin/applications?status=pending

# Get approved applications (paginated)
GET /admin/applications?status=approved&page=1&limit=20
```

**Response**:
```json
{
  "applications": [
    {
      "id": "...",
      "email": "provider@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+27123456789",
      "status": "pending",
      "skills": ["Plumbing", "Electrical"],
      "experienceYears": 5,
      "motivation": "I want to join...",
      "location": "Johannesburg, Gauteng",
      "documents": [
        {
          "type": "id",
          "url": "/uploads/applications/app-123.pdf",
          "name": "id-document.pdf",
          "size": 12345,
          "mimetype": "application/pdf"
        }
      ],
      "reviewedBy": null,
      "reviewedAt": null,
      "rejectionReason": null,
      "createdAt": "2025-01-28T...",
      "updatedAt": "2025-01-28T...",
      "provider": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 3,
    "totalPages": 1
  }
}
```

---

### 2. Get Single Application

**Endpoint**: `GET /admin/applications/:applicationId`

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
```

**Response**: Single application object (same structure as above)

---

### 3. Verify Application and Create Provider Account

**Endpoint**: `POST /admin/applications/:applicationId/verify`

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
```

**Request Body**: Empty (no body required)

**What It Does**:
1. Creates `User` account (auto-populated from application)
2. Creates `ServiceProvider` record (auto-populated from application)
3. Links application to provider
4. Creates `Document` records from application documents
5. Sets verification flags:
   - `isIdentityVerified: true`
   - `isVerified: true`
   - `isEmailVerified: false` (will be true after credentials email)
   - `isPhoneVerified: null`
6. Generates password and stores in `temporaryPassword`
7. Sends registration link email to provider
8. Updates application status to `'approved'`

**Response**:
```json
{
  "message": "Application verified and provider account created successfully",
  "user": {
    "id": "...",
    "email": "provider@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "provider": {
    "id": "...",
    "isVerified": true,
    "isIdentityVerified": true
  },
  "application": {
    "id": "...",
    "status": "approved"
  }
}
```

---

### 4. Reject Application

**Endpoint**: `POST /admin/applications/:applicationId/reject`

**Headers**:
```
Authorization: Bearer <admin_jwt_token>
```

**Request Body**:
```json
{
  "rejectionReason": "Documents could not be verified"
}
```

**What It Does**:
1. Updates application status to `'rejected'`
2. Records rejection reason
3. Records who rejected and when

**Response**:
```json
{
  "message": "Application rejected successfully",
  "application": {
    "id": "...",
    "status": "rejected",
    "rejectionReason": "Documents could not be verified",
    "reviewedBy": "...",
    "reviewedAt": "2025-01-28T..."
  }
}
```

---

## Application Status Flow

```
pending → approved (via /verify)
       ↘ rejected (via /reject)
```

**Status Values**:
- `pending`: New application, awaiting review
- `approved`: Application approved, provider account created
- `rejected`: Application rejected by admin
- `invited`: (Future use) Application invited but not yet completed

---

## CMS Workflow

### Step 1: View Applications
1. Call `GET /admin/applications?status=pending`
2. Display applications in a table/list
3. Show key info: Name, Email, Skills, Experience, Status, Created Date

### Step 2: Review Application Details
1. Click on an application to view details
2. Call `GET /admin/applications/:applicationId`
3. Display:
   - Personal information (name, email, phone)
   - Professional information (skills, experience, motivation)
   - Documents (if uploaded)
   - Application history

### Step 3: Review Documents
1. Check if `documents` array has items
2. For each document, display:
   - Document type (ID, Certificate, License, etc.)
   - Document name
   - Download link (`/uploads/applications/filename.pdf`)
   - File size
3. Admin can download and review documents
4. Admin can use third-party verification service to validate documents

### Step 4: Make Decision

#### Option A: Approve Application
1. Verify documents are valid
2. Call `POST /admin/applications/:applicationId/verify`
3. System automatically:
   - Creates provider account
   - Links documents
   - Sends registration email
4. Application status changes to `approved`
5. Provider receives email with registration link

#### Option B: Reject Application
1. Provide rejection reason
2. Call `POST /admin/applications/:applicationId/reject`
3. Include `rejectionReason` in request body
4. Application status changes to `rejected`

---

## Document Access

Documents are stored in the `documents` JSON field of the application. Each document object contains:

```json
{
  "type": "id",
  "url": "/uploads/applications/app-123.pdf",
  "name": "id-document.pdf",
  "size": 12345,
  "mimetype": "application/pdf"
}
```

**To view/download documents**:
- Construct full URL: `https://your-backend-url.com/uploads/applications/app-123.pdf`
- Or use relative path: `/uploads/applications/app-123.pdf` (if CMS is on same domain)

**Note**: After approval, documents are also created in the `Document` table linked to the provider.

---

## Example CMS Implementation

### Applications List Component

```javascript
// Fetch applications
const fetchApplications = async (status = 'pending') => {
  const response = await fetch(
    `${API_BASE_URL}/admin/applications?status=${status}`,
    {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    }
  );
  const data = await response.json();
  return data.applications;
};

// Approve application
const approveApplication = async (applicationId) => {
  const response = await fetch(
    `${API_BASE_URL}/admin/applications/${applicationId}/verify`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    }
  );
  return response.json();
};

// Reject application
const rejectApplication = async (applicationId, reason) => {
  const response = await fetch(
    `${API_BASE_URL}/admin/applications/${applicationId}/reject`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rejectionReason: reason })
    }
  );
  return response.json();
};
```

---

## Next Steps for CMS

1. **Create Applications List Page**
   - Display all pending applications
   - Filter by status
   - Pagination support

2. **Create Application Detail Page**
   - Show full application details
   - Display uploaded documents
   - Show action buttons (Approve/Reject)

3. **Add Document Viewer**
   - Display document previews
   - Download functionality
   - Integration with third-party verification

4. **Add Approval/Rejection UI**
   - Approve button → Calls verify endpoint
   - Reject button → Opens modal for rejection reason
   - Success/error notifications

5. **Add Application History**
   - Track status changes
   - Show who reviewed and when
   - Show rejection reasons

---

## Testing

Use the test script to verify the flow:
```bash
npx ts-node scripts/testCompleteApplicationFlow.ts <admin_token>
```

This tests:
- Application submission
- Document upload
- Admin verification
- Profile completion
- Login
