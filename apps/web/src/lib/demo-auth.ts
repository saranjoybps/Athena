/** Local demo credentials (works with ATHENA_AUTH=dev). */
export const DEMO_EMAIL = "demo@athena.local";
export const DEMO_PASSWORD = "Demo@1234";
export const DEMO_USER_ID = "local-owner";
export const DEMO_TOKEN = `dev:${DEMO_USER_ID}`;

export function isDemoLogin(email: string, password: string) {
  return email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD;
}
