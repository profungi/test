import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
<<<<<<< HEAD
    messages: (await import(`../../messages/${locale}.json`)).default
=======
    messages: (await import(`../messages/${locale}.json`)).default
>>>>>>> d14cbfb80654aa8c38c10c7edfc6e082b7af78ee
  };
});
