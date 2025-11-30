# Chat System Documentation

## Overview
The SPANA chat system enables secure, token-based communication between customers and service providers during bookings. Chat rooms are created automatically when specific conditions are met and terminated when jobs are completed.

## Chat Flow

### 1. Customer Requests Service
- Customer creates a booking request
- Status: `pending_payment`
- No chat tokens generated yet

### 2. Customer Pays
- Payment is confirmed
- **Customer chat token is generated** (`customerChatToken`)
- Status: `paid_to_escrow`
- Customer receives token via socket event: `chat-token-received`

### 3. Provider Accepts
- Provider accepts the booking request
- **Provider chat token is generated** (`providerChatToken`)
- Status: `confirmed`
- Provider receives token via socket event: `booking-accepted-provider`
- If customer already paid, chat is activated immediately

### 4. Chat Activation
- Chat becomes active when **both tokens exist**
- `chatActive: true`
- Both parties can join the booking room using their tokens
- Socket event: `chatroom-ready`

### 5. Chat Communication
- Both parties join room: `join-booking` event with `chatToken`
- Messages sent via: `booking-chat` event with `chatToken`
- All messages require valid token
- Admin can see all chats (no token needed)

### 6. Job Completion
- When booking status changes to `completed`
- Chat is terminated: `chatActive: false`, `chatTerminatedAt: <timestamp>`
- Socket event: `chat-terminated`
- No more messages can be sent

## Token System

### Token Generation
- Tokens are generated using `generateChatToken(bookingId, userId, role)`
- Format: `{bookingId}_{role}_{hash}`
- Secure hash based on booking ID, user ID, role, and timestamp

### Token Verification
- Tokens are verified before joining chat rooms
- Must match booking ID, user ID, and role
- Invalid tokens are rejected

## Socket Events

### Client → Server

#### Join Booking Room
```javascript
socket.emit('join-booking', {
  bookingId: 'booking_id',
  chatToken: 'customer_token_or_provider_token'
});
```

#### Send Message
```javascript
socket.emit('booking-chat', {
  bookingId: 'booking_id',
  message: 'Hello!',
  chatToken: 'customer_token_or_provider_token'
});
```

### Server → Client

#### Booking Accepted (Customer)
```javascript
{
  bookingId: 'booking_id',
  message: 'Provider has accepted your booking request',
  providerChatToken: 'provider_token'
}
```

#### Booking Accepted (Provider)
```javascript
{
  bookingId: 'booking_id',
  message: 'You have accepted the booking request',
  chatToken: 'provider_token',
  waitingForPayment: true/false
}
```

#### Chat Token Received (Customer - after payment)
```javascript
{
  bookingId: 'booking_id',
  chatToken: 'customer_token',
  chatActive: true/false
}
```

#### Chatroom Ready
```javascript
{
  bookingId: 'booking_id',
  chatActive: true
}
```

#### Chat Terminated
```javascript
{
  bookingId: 'booking_id',
  message: 'Chat has been terminated as the job is completed'
}
```

#### Chat Error
```javascript
{
  message: 'Error description'
}
```

## API Endpoints

### Get Chat Token
- **GET** `/chat/booking/:bookingId/token`
- Returns the chat token for the current user (if available)
- Requires authentication

### Get Booking Chat History
- **GET** `/chat/booking/:bookingId`
- Returns all messages in the booking chat
- Requires authentication and valid token

## Permissions

### Customer
- Can chat with service provider (bidirectional)
- Cannot chat with admin directly
- Must have valid `customerChatToken` to join booking room

### Service Provider
- Can chat with customer (bidirectional)
- Can chat with admin (provider-initiated only)
- Must have valid `providerChatToken` to join booking room

### Admin
- Can see all chats (no token required)
- Can join any booking room
- Receives all chat messages automatically

## Database Schema

### Booking Model
```prisma
model Booking {
  providerChatToken      String?  // Generated when provider accepts
  customerChatToken      String?  // Generated when payment is confirmed
  chatActive             Boolean  @default(false) // True when both tokens exist
  chatTerminatedAt       DateTime? // When chat is closed (job completed)
}
```

### Message Model
```prisma
model Message {
  id        String   @id @default(cuid())
  content   String
  senderId  String
  receiverId String? // Null for booking chat
  bookingId String?  // For booking-related chat
  chatType  String   @default("direct") // 'booking', 'direct', 'admin'
  isRead    Boolean  @default(false)
  metadata  Json?    // For attachments, call info, etc.
  createdAt DateTime @default(now())
}
```

## Security

1. **Token-Based Access**: All chat access requires valid tokens
2. **Role Verification**: Tokens are tied to specific roles (customer/provider)
3. **Booking Verification**: Tokens are tied to specific bookings
4. **Chat Termination**: Chat automatically closes when job is completed
5. **Admin Oversight**: Admins can monitor all chats for safety

## Error Handling

- Invalid token → `chat-error` event
- Chat terminated → `chat-error` event with termination message
- Booking not found → `chat-error` event
- Unauthorized access → `chat-error` event

## Example Flow

1. Customer requests service → Booking created
2. Customer pays → `customerChatToken` generated, customer notified
3. Provider accepts → `providerChatToken` generated, provider notified
4. Both tokens exist → Chat activated, both parties notified
5. Customer joins room with `customerChatToken`
6. Provider joins room with `providerChatToken`
7. Both can send messages
8. Job completed → Chat terminated, no more messages allowed

