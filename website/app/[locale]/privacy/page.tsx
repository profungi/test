<<<<<<< HEAD
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy' });

  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy' });

  const effectiveDate = 'December 4, 2025';
  const lastUpdated = 'December 4, 2025';

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md shadow-md border-b-2 border-[#F0D3B6]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href={`/${locale}`} className="flex items-center gap-4 hover:opacity-80 transition-opacity">
            <Image
              src="/grape-mascot.png"
              alt="Grape Mascot"
              width={60}
              height={60}
              className="object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-[#4A2C22]">
                {t('backToHome')}
              </h1>
            </div>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl border-2 border-[#F0D3B6] p-8 shadow-md">
          <h1 className="text-3xl font-bold text-[#4A2C22] mb-2">
            {t('title')}
          </h1>
          <p className="text-sm text-[#4A2C22]/60 mb-8">
            {t('effectiveDate', { date: effectiveDate })} · {t('lastUpdated', { date: lastUpdated })}
          </p>

          {/* Introduction */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section1.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-4">{t('section1.intro')}</p>
            <p className="text-[#4A2C22]/80">{t('section1.commitment')}</p>
          </section>

          {/* Information We Collect */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section2.title')}</h2>

            <h3 className="text-lg font-semibold text-[#4A2C22] mb-2">{t('section2.automatic.title')}</h3>
            <p className="text-[#4A2C22]/80 mb-2">{t('section2.automatic.intro')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section2.automatic.item1')}</li>
              <li>{t('section2.automatic.item2')}</li>
              <li>{t('section2.automatic.item3')}</li>
              <li>{t('section2.automatic.item4')}</li>
              <li>{t('section2.automatic.item5')}</li>
            </ul>

            <h3 className="text-lg font-semibold text-[#4A2C22] mb-2">{t('section2.provided.title')}</h3>
            <p className="text-[#4A2C22]/80 mb-2">{t('section2.provided.intro')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section2.provided.item1')}</li>
              <li>{t('section2.provided.item2')}</li>
              <li>{t('section2.provided.item3')}</li>
            </ul>
          </section>

          {/* How We Use Information */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section3.title')}</h2>

            <h3 className="text-lg font-semibold text-[#4A2C22] mb-2">{t('section3.analytics.title')}</h3>
            <p className="text-[#4A2C22]/80 mb-4">{t('section3.analytics.description')}</p>

            <h3 className="text-lg font-semibold text-[#4A2C22] mb-2">{t('section3.cookies.title')}</h3>
            <p className="text-[#4A2C22]/80 mb-2">{t('section3.cookies.intro')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li><strong>{t('section3.cookies.essential.label')}</strong> {t('section3.cookies.essential.description')}</li>
              <li><strong>{t('section3.cookies.analytics.label')}</strong> {t('section3.cookies.analytics.description')}</li>
            </ul>
            <p className="text-[#4A2C22]/80">{t('section3.cookies.consent')}</p>
          </section>

          {/* Feedback Data */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section4.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-2">{t('section4.intro')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section4.item1')}</li>
              <li>{t('section4.item2')}</li>
              <li>{t('section4.item3')}</li>
            </ul>
            <p className="text-[#4A2C22]/80">{t('section4.note')}</p>
          </section>

          {/* Data Retention */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section5.title')}</h2>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section5.item1')}</li>
              <li>{t('section5.item2')}</li>
            </ul>
            <p className="text-[#4A2C22]/80">{t('section5.note')}</p>
          </section>

          {/* Data Sharing */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section6.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-2">{t('section6.intro')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li><strong>{t('section6.vercel.label')}</strong> {t('section6.vercel.description')}</li>
              <li><strong>{t('section6.turso.label')}</strong> {t('section6.turso.description')}</li>
            </ul>
            <p className="text-[#4A2C22]/80">{t('section6.safeguards')}</p>
          </section>

          {/* International Transfers */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section7.title')}</h2>
            <p className="text-[#4A2C22]/80">{t('section7.description')}</p>
          </section>

          {/* Your Rights */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section8.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-2">{t('section8.intro')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section8.item1')}</li>
              <li>{t('section8.item2')}</li>
              <li>{t('section8.item3')}</li>
              <li>{t('section8.item4')}</li>
            </ul>
            <p className="text-[#4A2C22]/80">{t('section8.contact')}</p>
          </section>

          {/* California Residents */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section9.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-2">{t('section9.intro')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section9.item1')}</li>
              <li>{t('section9.item2')}</li>
              <li>{t('section9.item3')}</li>
              <li>{t('section9.item4')}</li>
            </ul>
            <p className="text-[#4A2C22]/80">{t('section9.note')}</p>
          </section>

          {/* Children's Privacy */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section10.title')}</h2>
            <p className="text-[#4A2C22]/80">{t('section10.description')}</p>
          </section>

          {/* Changes to Policy */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section11.title')}</h2>
            <p className="text-[#4A2C22]/80">{t('section11.description')}</p>
          </section>

          {/* Contact */}
          <section className="mb-4">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section12.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-2">{t('section12.intro')}</p>
            <div className="bg-[#FFF4E6] rounded-xl p-4 border border-[#F0D3B6]">
              <p className="text-[#4A2C22] font-medium">{t('section12.name')}</p>
              <p className="text-[#4A2C22]/80">{t('section12.email')}</p>
              <p className="text-[#4A2C22]/80">{t('section12.website')}</p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#4A2C22] border-t-4 border-[#B37DA2] mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-[#FFF4E6] text-sm font-medium">
              © 2025 Champagne Grape. All rights reserved.
            </p>
            <div className="mt-4">
              <Image
                src="/grape-mascot.png"
                alt="Grape Mascot"
                width={50}
                height={50}
                className="object-contain mx-auto"
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
||||||| 9b6f72b
=======
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy' });

  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy' });

  const effectiveDate = 'December 4, 2024';
  const lastUpdated = 'December 4, 2024';

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md shadow-md border-b-2 border-[#F0D3B6]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href={`/${locale}`} className="flex items-center gap-4 hover:opacity-80 transition-opacity">
            <Image
              src="/grape-mascot.png"
              alt="Grape Mascot"
              width={60}
              height={60}
              className="object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-[#4A2C22]">
                {t('backToHome')}
              </h1>
            </div>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl border-2 border-[#F0D3B6] p-8 shadow-md">
          <h1 className="text-3xl font-bold text-[#4A2C22] mb-2">
            {t('title')}
          </h1>
          <p className="text-sm text-[#4A2C22]/60 mb-8">
            {t('effectiveDate', { date: effectiveDate })} · {t('lastUpdated', { date: lastUpdated })}
          </p>

          {/* Introduction */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section1.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-4">{t('section1.intro')}</p>
            <p className="text-[#4A2C22]/80">{t('section1.commitment')}</p>
          </section>

          {/* Information We Collect */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section2.title')}</h2>

            <h3 className="text-lg font-semibold text-[#4A2C22] mb-2">{t('section2.automatic.title')}</h3>
            <p className="text-[#4A2C22]/80 mb-2">{t('section2.automatic.intro')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section2.automatic.item1')}</li>
              <li>{t('section2.automatic.item2')}</li>
              <li>{t('section2.automatic.item3')}</li>
              <li>{t('section2.automatic.item4')}</li>
              <li>{t('section2.automatic.item5')}</li>
            </ul>

            <h3 className="text-lg font-semibold text-[#4A2C22] mb-2">{t('section2.provided.title')}</h3>
            <p className="text-[#4A2C22]/80 mb-2">{t('section2.provided.intro')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section2.provided.item1')}</li>
              <li>{t('section2.provided.item2')}</li>
              <li>{t('section2.provided.item3')}</li>
            </ul>
          </section>

          {/* How We Use Information */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section3.title')}</h2>

            <h3 className="text-lg font-semibold text-[#4A2C22] mb-2">{t('section3.analytics.title')}</h3>
            <p className="text-[#4A2C22]/80 mb-4">{t('section3.analytics.description')}</p>

            <h3 className="text-lg font-semibold text-[#4A2C22] mb-2">{t('section3.cookies.title')}</h3>
            <p className="text-[#4A2C22]/80 mb-2">{t('section3.cookies.intro')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li><strong>{t('section3.cookies.essential.label')}</strong> {t('section3.cookies.essential.description')}</li>
              <li><strong>{t('section3.cookies.analytics.label')}</strong> {t('section3.cookies.analytics.description')}</li>
            </ul>
            <p className="text-[#4A2C22]/80">{t('section3.cookies.consent')}</p>
          </section>

          {/* Feedback Data */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section4.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-2">{t('section4.intro')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section4.item1')}</li>
              <li>{t('section4.item2')}</li>
              <li>{t('section4.item3')}</li>
            </ul>
            <p className="text-[#4A2C22]/80">{t('section4.note')}</p>
          </section>

          {/* Data Retention */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section5.title')}</h2>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section5.item1')}</li>
              <li>{t('section5.item2')}</li>
            </ul>
            <p className="text-[#4A2C22]/80">{t('section5.note')}</p>
          </section>

          {/* Data Sharing */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section6.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-2">{t('section6.intro')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li><strong>{t('section6.vercel.label')}</strong> {t('section6.vercel.description')}</li>
              <li><strong>{t('section6.turso.label')}</strong> {t('section6.turso.description')}</li>
            </ul>
            <p className="text-[#4A2C22]/80">{t('section6.safeguards')}</p>
          </section>

          {/* International Transfers */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section7.title')}</h2>
            <p className="text-[#4A2C22]/80">{t('section7.description')}</p>
          </section>

          {/* Your Rights */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section8.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-2">{t('section8.intro')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section8.item1')}</li>
              <li>{t('section8.item2')}</li>
              <li>{t('section8.item3')}</li>
              <li>{t('section8.item4')}</li>
            </ul>
            <p className="text-[#4A2C22]/80">{t('section8.contact')}</p>
          </section>

          {/* California Residents */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section9.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-2">{t('section9.intro')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section9.item1')}</li>
              <li>{t('section9.item2')}</li>
              <li>{t('section9.item3')}</li>
              <li>{t('section9.item4')}</li>
            </ul>
            <p className="text-[#4A2C22]/80">{t('section9.note')}</p>
          </section>

          {/* Children's Privacy */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section10.title')}</h2>
            <p className="text-[#4A2C22]/80">{t('section10.description')}</p>
          </section>

          {/* Changes to Policy */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section11.title')}</h2>
            <p className="text-[#4A2C22]/80">{t('section11.description')}</p>
          </section>

          {/* Contact */}
          <section className="mb-4">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section12.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-2">{t('section12.intro')}</p>
            <div className="bg-[#FFF4E6] rounded-xl p-4 border border-[#F0D3B6]">
              <p className="text-[#4A2C22] font-medium">{t('section12.name')}</p>
              <p className="text-[#4A2C22]/80">{t('section12.email')}</p>
              <p className="text-[#4A2C22]/80">{t('section12.website')}</p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#4A2C22] border-t-4 border-[#B37DA2] mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-[#FFF4E6] text-sm font-medium">
              © 2024 Champagne Grape. All rights reserved.
            </p>
            <div className="mt-4">
              <Image
                src="/grape-mascot.png"
                alt="Grape Mascot"
                width={50}
                height={50}
                className="object-contain mx-auto"
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
>>>>>>> refs/tags/sculptor-merge-source-2219207b29d85b2fa6cec2e7ccabf4ccfa584079
