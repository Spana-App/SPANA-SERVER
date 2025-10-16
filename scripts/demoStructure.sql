-- ==============================================
-- DEMO: Clean Database Structure
-- ==============================================
-- This script demonstrates how the new separated table structure works
-- Run this in pgAdmin to see the clean separation of concerns

-- ==============================================
-- STEP 1: Insert Sample Data
-- ==============================================

-- Create a customer
INSERT INTO users (id, email, password, "firstName", "lastName", phone, role, "isEmailVerified", "isPhoneVerified", "walletBalance", status)
VALUES ('user1', 'customer@example.com', 'hashedpass', 'John', 'Customer', '+1234567890', 'customer', true, true, 100.50, 'active');

INSERT INTO customers (id, "userId", "favouriteProviders", "totalBookings", "ratingGivenAvg")
VALUES ('cust1', 'user1', ARRAY['prov1'], 5, 4.2);

-- Create a service provider
INSERT INTO users (id, email, password, "firstName", "lastName", phone, role, "isEmailVerified", "isPhoneVerified", "walletBalance", status)
VALUES ('user2', 'provider@example.com', 'hashedpass', 'Jane', 'Provider', '+1234567891', 'service_provider', true, true, 250.75, 'active');

INSERT INTO service_providers (id, "userId", skills, "experienceYears", rating, "totalReviews", "isVerified", "isProfileComplete")
VALUES ('prov1', 'user2', ARRAY['Plumbing', 'Electrical'], 8, 4.8, 127, true, true);

-- Create a service
INSERT INTO services (id, title, description, category, price, duration, "providerId", status)
VALUES ('serv1', 'Emergency Plumbing', '24/7 plumbing services', 'Plumbing', 150.00, 120, 'prov1', 'active');

-- ==============================================
-- STEP 2: Demonstrate Clean Queries
-- ==============================================

-- Query 1: Get customer info (no provider fields cluttering the result)
SELECT 
    u.email,
    u."firstName",
    u."lastName",
    u."walletBalance",
    c."favouriteProviders",
    c."totalBookings"
FROM users u
JOIN customers c ON u.id = c."userId"
WHERE u.role = 'customer';

-- Query 2: Get provider info (no customer fields cluttering the result)
SELECT 
    u.email,
    u."firstName", 
    u."lastName",
    u."walletBalance",
    sp.skills,
    sp."experienceYears",
    sp.rating,
    sp."isVerified"
FROM users u
JOIN service_providers sp ON u.id = sp."userId"
WHERE u.role = 'service_provider';

-- Query 3: Get services with provider details
SELECT 
    s.title,
    s.price,
    u."firstName" as provider_name,
    sp.skills,
    sp.rating
FROM services s
JOIN service_providers sp ON s."providerId" = sp.id
JOIN users u ON sp."userId" = u.id;

-- ==============================================
-- STEP 3: Show the Benefits
-- ==============================================

-- Count records in each table
SELECT 'users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 'customers', COUNT(*) FROM customers
UNION ALL
SELECT 'service_providers', COUNT(*) FROM service_providers
UNION ALL
SELECT 'services', COUNT(*) FROM services;

-- Show table structure benefits
SELECT 
    'Clean separation: Customers and providers have their own tables' as benefit
UNION ALL
SELECT 'No null fields: No empty provider fields in customer records'
UNION ALL
SELECT 'Better performance: Smaller, focused tables'
UNION ALL
SELECT 'Clear relationships: Proper foreign key relationships'
UNION ALL
SELECT 'Easier queries: Join only what you need';
