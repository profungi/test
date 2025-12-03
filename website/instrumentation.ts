// Next.js Instrumentation for debugging
// This file runs before any other code in the app

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('=== Instrumentation Register (Node.js Runtime) ===');
    console.log('Environment:', {
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_RUNTIME: process.env.NEXT_RUNTIME,
    });

    // Check if __dirname is available
    try {
      console.log('__dirname check:', typeof __dirname !== 'undefined' ? 'available' : 'not available');
    } catch (e) {
      console.error('__dirname error:', e);
    }
  }
}
