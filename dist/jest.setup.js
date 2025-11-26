// Jest setup: cleanup after tests
// Note: Using Prisma now, not mongoose. Prisma handles connection pooling automatically.
afterAll(async () => {
    try {
        // Add any cleanup needed for Prisma/PostgreSQL if necessary
        // Prisma client handles connection pooling automatically
    }
    catch (e) {
        // ignore
    }
});
