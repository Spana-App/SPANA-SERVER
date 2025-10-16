-- SQL Script to test the new clean database structure
-- Run this in pgAdmin to see how the separated tables work

-- ==============================================
-- 1. CREATE SAMPLE DATA
-- ==============================================

-- Insert a base user (customer)
INSERT INTO users (id, email, password, "firstName", "lastName", phone, role, "isEmailVerified", "isPhoneVerified", "profileImage", "walletBalance", status, "createdAt", "updatedAt")
VALUES (
    'user_customer_1',
    'john.customer@example.com',
    '$2a$12$hashedpassword', -- This would be a real bcrypt hash
    'John',
    'Customer',
    '+1234567890',
    'customer',
    true,
    true,
    'https://example.com/john.jpg',
    100.50,
    'active',
    NOW(),
    NOW()
);

-- Insert customer-specific data
INSERT INTO customers (id, "userId", "favouriteProviders", "totalBookings", "ratingGivenAvg", "createdAt", "updatedAt")
VALUES (
    'customer_1',
    'user_customer_1',
    ARRAY['provider_1', 'provider_2'],
    5,
    4.2,
    NOW(),
    NOW()
);

-- Insert a base user (service provider)
INSERT INTO users (id, email, password, "firstName", "lastName", phone, role, "isEmailVerified", "isPhoneVerified", "profileImage", "walletBalance", status, "createdAt", "updatedAt")
VALUES (
    'user_provider_1',
    'jane.provider@example.com',
    '$2a$12$hashedpassword',
    'Jane',
    'Provider',
    '+1234567891',
    'service_provider',
    true,
    true,
    'https://example.com/jane.jpg',
    250.75,
    'active',
    NOW(),
    NOW()
);

-- Insert service provider-specific data
INSERT INTO service_providers (id, "userId", skills, "experienceYears", "isOnline", rating, "totalReviews", "isVerified", "isIdentityVerified", availability, "serviceAreaRadius", "serviceAreaCenter", "isProfileComplete", "createdAt", "updatedAt")
VALUES (
    'provider_1',
    'user_provider_1',
    ARRAY['Plumbing', 'Electrical', 'HVAC'],
    8,
    true,
    4.8,
    127,
    true,
    true,
    '{"days": ["monday", "tuesday", "wednesday", "thursday", "friday"], "hours": {"start": "08:00", "end": "18:00"}}',
    25.5,
    '{"type": "Point", "coordinates": [-74.006, 40.7128]}',
    true,
    NOW(),
    NOW()
);

-- Insert another service provider
INSERT INTO users (id, email, password, "firstName", "lastName", phone, role, "isEmailVerified", "isPhoneVerified", "profileImage", "walletBalance", status, "createdAt", "updatedAt")
VALUES (
    'user_provider_2',
    'bob.provider@example.com',
    '$2a$12$hashedpassword',
    'Bob',
    'Handyman',
    '+1234567892',
    'service_provider',
    true,
    false,
    'https://example.com/bob.jpg',
    75.25,
    'active',
    NOW(),
    NOW()
);

INSERT INTO service_providers (id, "userId", skills, "experienceYears", "isOnline", rating, "totalReviews", "isVerified", "isIdentityVerified", availability, "serviceAreaRadius", "serviceAreaCenter", "isProfileComplete", "createdAt", "updatedAt")
VALUES (
    'provider_2',
    'user_provider_2',
    ARRAY['Carpentry', 'Painting', 'General Repair'],
    3,
    false,
    4.5,
    45,
    false,
    false,
    '{"days": ["saturday", "sunday"], "hours": {"start": "09:00", "end": "17:00"}}',
    15.0,
    '{"type": "Point", "coordinates": [-73.9857, 40.7484]}',
    false,
    NOW(),
    NOW()
);

-- Insert services
INSERT INTO services (id, title, description, category, price, duration, "mediaUrl", status, "providerId", "createdAt", "updatedAt")
VALUES (
    'service_1',
    'Emergency Plumbing Repair',
    '24/7 emergency plumbing services for leaks, clogs, and repairs',
    'Plumbing',
    150.00,
    120,
    'https://example.com/plumbing.jpg',
    'active',
    'provider_1',
    NOW(),
    NOW()
);

INSERT INTO services (id, title, description, category, price, duration, "mediaUrl", status, "providerId", "createdAt", "updatedAt")
VALUES (
    'service_2',
    'Kitchen Cabinet Installation',
    'Professional kitchen cabinet installation and repair',
    'Carpentry',
    300.00,
    240,
    'https://example.com/cabinets.jpg',
    'active',
    'provider_2',
    NOW(),
    NOW()
);

-- Insert a booking
INSERT INTO bookings (id, date, time, location, notes, status, "estimatedDurationMinutes", "customerId", "serviceId", "createdAt", "updatedAt")
VALUES (
    'booking_1',
    '2024-01-15',
    '14:00',
    '{"type": "Point", "coordinates": [-74.006, 40.7128], "address": "123 Main St, New York, NY"}',
    'Kitchen sink is leaking under the cabinet',
    'confirmed',
    120,
    'customer_1',
    'service_1',
    NOW(),
    NOW()
);

-- Insert a payment
INSERT INTO payments (id, amount, currency, "paymentMethod", status, "transactionId", "customerId", "bookingId", "createdAt", "updatedAt")
VALUES (
    'payment_1',
    150.00,
    'USD',
    'card',
    'completed',
    'txn_123456789',
    'customer_1',
    'booking_1',
    NOW(),
    NOW()
);

-- ==============================================
-- 2. QUERY EXAMPLES - How the structure works
-- ==============================================

-- Query 1: Get all customers with their user info
SELECT 
    u.id as user_id,
    u.email,
    u."firstName",
    u."lastName",
    u.phone,
    u."walletBalance",
    c."favouriteProviders",
    c."totalBookings",
    c."ratingGivenAvg"
FROM users u
JOIN customers c ON u.id = c."userId"
WHERE u.role = 'customer';

-- Query 2: Get all service providers with their user info
SELECT 
    u.id as user_id,
    u.email,
    u."firstName",
    u."lastName",
    u.phone,
    u."walletBalance",
    sp.skills,
    sp."experienceYears",
    sp.rating,
    sp."totalReviews",
    sp."isVerified",
    sp."isProfileComplete"
FROM users u
JOIN service_providers sp ON u.id = sp."userId"
WHERE u.role = 'service_provider';

-- Query 3: Get a specific customer's bookings with service and provider details
SELECT 
    b.id as booking_id,
    b.date,
    b.time,
    b.status,
    b.notes,
    s.title as service_title,
    s.price as service_price,
    u_provider."firstName" as provider_first_name,
    u_provider."lastName" as provider_last_name,
    u_provider.phone as provider_phone,
    sp.rating as provider_rating
FROM bookings b
JOIN customers c ON b."customerId" = c.id
JOIN services s ON b."serviceId" = s.id
JOIN service_providers sp ON s."providerId" = sp.id
JOIN users u_provider ON sp."userId" = u_provider.id
WHERE c."userId" = 'user_customer_1';

-- Query 4: Get all services with provider information
SELECT 
    s.id as service_id,
    s.title,
    s.description,
    s.category,
    s.price,
    s.duration,
    u."firstName" as provider_first_name,
    u."lastName" as provider_last_name,
    sp.skills,
    sp.rating,
    sp."isVerified"
FROM services s
JOIN service_providers sp ON s."providerId" = sp.id
JOIN users u ON sp."userId" = u.id
WHERE s.status = 'active';

-- Query 5: Get customer payment history
SELECT 
    p.id as payment_id,
    p.amount,
    p.currency,
    p."paymentMethod",
    p.status,
    p."createdAt" as payment_date,
    b.date as booking_date,
    s.title as service_title
FROM payments p
JOIN customers c ON p."customerId" = c.id
JOIN bookings b ON p."bookingId" = b.id
JOIN services s ON b."serviceId" = s.id
WHERE c."userId" = 'user_customer_1';

-- Query 6: Get provider's service statistics
SELECT 
    u."firstName" || ' ' || u."lastName" as provider_name,
    u.email,
    COUNT(s.id) as total_services,
    AVG(s.price) as average_service_price,
    sp.rating,
    sp."totalReviews",
    sp."isVerified"
FROM service_providers sp
JOIN users u ON sp."userId" = u.id
LEFT JOIN services s ON sp.id = s."providerId"
GROUP BY u.id, u."firstName", u."lastName", u.email, sp.rating, sp."totalReviews", sp."isVerified";

-- ==============================================
-- 3. ADVANCED QUERIES - Complex relationships
-- ==============================================

-- Query 7: Find customers who have booked services from verified providers
SELECT DISTINCT
    u_customer."firstName" || ' ' || u_customer."lastName" as customer_name,
    u_customer.email as customer_email,
    COUNT(b.id) as total_bookings,
    AVG(sp.rating) as average_provider_rating
FROM customers c
JOIN users u_customer ON c."userId" = u_customer.id
JOIN bookings b ON c.id = b."customerId"
JOIN services s ON b."serviceId" = s.id
JOIN service_providers sp ON s."providerId" = sp.id
WHERE sp."isVerified" = true
GROUP BY u_customer.id, u_customer."firstName", u_customer."lastName", u_customer.email;

-- Query 8: Get provider availability and service area info
SELECT 
    u."firstName" || ' ' || u."lastName" as provider_name,
    sp.availability,
    sp."serviceAreaRadius",
    sp."serviceAreaCenter",
    sp."isOnline",
    COUNT(s.id) as active_services
FROM service_providers sp
JOIN users u ON sp."userId" = u.id
LEFT JOIN services s ON sp.id = s."providerId" AND s.status = 'active'
GROUP BY u.id, u."firstName", u."lastName", sp.availability, sp."serviceAreaRadius", sp."serviceAreaCenter", sp."isOnline";

-- ==============================================
-- 4. CLEANUP (Optional - uncomment to remove test data)
-- ==============================================

-- Uncomment these lines to clean up test data:
-- DELETE FROM payments WHERE id = 'payment_1';
-- DELETE FROM bookings WHERE id = 'booking_1';
-- DELETE FROM services WHERE id IN ('service_1', 'service_2');
-- DELETE FROM service_providers WHERE id IN ('provider_1', 'provider_2');
-- DELETE FROM customers WHERE id = 'customer_1';
-- DELETE FROM users WHERE id IN ('user_customer_1', 'user_provider_1', 'user_provider_2');
