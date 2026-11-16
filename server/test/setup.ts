// Point every test run at an isolated database before any app code loads.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:5432/stacks_test";
process.env.SESSION_SECRET ??= "test-secret-0123456789abcdef";
process.env.ALLOW_DEMO_LOGIN = "true";
process.env.GOOGLE_CLIENT_ID = "";
