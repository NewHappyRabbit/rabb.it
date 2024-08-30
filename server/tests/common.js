import { vi } from "vitest";

export function setEnvVariables() {
    // Check if all required environment variables are defined
    let missingVariables = [];
    ['MONGO_TEST_USER', 'MONGO_TEST_PASSWORD'].forEach((env) => {
        if (!process.env[env]) missingVariables.push(env);
    });

    if (missingVariables.length) throw new Error(`Missing environment variables: ${missingVariables.join(',')}`);

    vi.stubEnv('ENV', 'test');
    vi.stubEnv('MONGO_USER', process.env.MONGO_TEST_USER);
    vi.stubEnv('MONGO_PASSWORD', process.env.MONGO_TEST_PASSWORD);
}