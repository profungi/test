import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match only internationalized pathnames
  // Skip static files, _next, api routes, and files with extensions
  matcher: [
    '/((?!api|_next|_vercel|.*\\..*).*)'
  ]
};
