-- ==============================================
-- QUICK TEST: Run this in pgAdmin to see the clean structure
-- ==============================================

-- 1. Check current table structure
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'customers', 'service_providers', 'services', 'bookings', 'payments')
ORDER BY table_name, ordinal_position;

-- 2. Insert test data
INSERT INTO users (id, email, password, "firstName", "lastName", role, "walletBalance") VALUES
('test_user1', 'customer@test.com', 'pass', 'John', 'Customer', 'customer', 100),
('test_user2', 'provider@test.com', 'pass', 'Jane', 'Provider', 'service_provider', 200);

INSERT INTO customers (id, "userId", "totalBookings") VALUES
('test_cust1', 'test_user1', 3);

INSERT INTO service_providers (id, "userId", skills, rating) VALUES
('test_prov1', 'test_user2', ARRAY['Plumbing', 'Electrical'], 4.5);

-- 3. Test the clean queries
-- Get only customer data (no provider fields)
SELECT u.email, u."firstName", c."totalBookings" 
FROM users u 
JOIN customers c ON u.id = c."userId";

-- Get only provider data (no customer fields)  
SELECT u.email, u."firstName", sp.skills, sp.rating
FROM users u
JOIN service_providers sp ON u.id = sp."userId";

-- 4. Clean up
DELETE FROM customers WHERE id = 'test_cust1';
DELETE FROM service_providers WHERE id = 'test_prov1';
DELETE FROM users WHERE id IN ('test_user1', 'test_user2');
