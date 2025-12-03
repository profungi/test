// Next.js Instrumentation for debugging
// This file runs before any other code in the app

export async function register() {
  // Only run in Node.js runtime, skip Edge runtime entirely
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('=== Instrumentation Register (Node.js Runtime) ===');
    console.log('Environment:', {
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_RUNTIME: process.env.NEXT_RUNTIME,
    });
  }
  // Edge runtime: do nothing, avoid any Node.js specific code
}
