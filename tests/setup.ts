/**
 * Vitest setup file
 * Sets up environment variables and global test configuration
 */

// Set required environment variables for testing
process.env.JWT_SECRET = "test-secret-key-minimum-32-characters-long";
process.env.APP_URL = "http://localhost:3000";
process.env.DATABASE_URL = ":memory:"; // Use in-memory DB for tests
process.env.NODE_ENV = "test";

// SMTP variables (not required for unit tests, but set to avoid errors)
process.env.SMTP_HOST = "smtp.test.com";
process.env.SMTP_PORT = "587";
process.env.SMTP_USER = "test@test.com";
process.env.SMTP_PASS = "test-password";
process.env.SMTP_FROM = "test@test.com";
