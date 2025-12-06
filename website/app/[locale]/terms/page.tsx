import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'terms' });

  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'terms' });

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
            {t('lastUpdated', { date: lastUpdated })}
          </p>

          <p className="text-[#4A2C22]/80 mb-8">{t('intro')}</p>

          {/* Section 1: Who we are */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section1.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-4">{t('section1.description')}</p>
            <p className="text-[#4A2C22]/80">{t('section1.disclaimer')}</p>
          </section>

          {/* Section 2: Use of the Site */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section2.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-2">{t('section2.intro')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section2.item1')}</li>
              <li>{t('section2.item2')}</li>
              <li>{t('section2.item3')}</li>
              <li>{t('section2.item4')}</li>
            </ul>
            <p className="text-[#4A2C22]/80">{t('section2.reserve')}</p>
          </section>

          {/* Section 3: Informational purpose only */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section3.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-2">{t('section3.intro')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section3.item1')}</li>
              <li>{t('section3.item2')}</li>
              <li>{t('section3.item3')}</li>
            </ul>
            <p className="text-[#4A2C22]/80 mb-4">{t('section3.changes')}</p>
            <p className="text-[#4A2C22]/80">{t('section3.risk')}</p>
          </section>

          {/* Section 4: Third-party content and links */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section4.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-2">{t('section4.intro')}</p>
            <p className="text-[#4A2C22]/80 mb-2">{t('section4.noControl')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section4.item1')}</li>
              <li>{t('section4.item2')}</li>
            </ul>
            <p className="text-[#4A2C22]/80 mb-4">{t('section4.mention')}</p>
            <p className="text-[#4A2C22]/80">{t('section4.ownRisk')}</p>
          </section>

          {/* Section 5: Intellectual property */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section5.title')}</h2>

            <h3 className="text-lg font-semibold text-[#4A2C22] mb-2">{t('section5.ourContent.title')}</h3>
            <p className="text-[#4A2C22]/80 mb-2">{t('section5.ourContent.description')}</p>
            <p className="text-[#4A2C22]/80 mb-2">{t('section5.ourContent.license')}</p>
            <p className="text-[#4A2C22]/80 mb-2">{t('section5.ourContent.restrictions')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section5.ourContent.item1')}</li>
              <li>{t('section5.ourContent.item2')}</li>
              <li>{t('section5.ourContent.item3')}</li>
            </ul>

            <h3 className="text-lg font-semibold text-[#4A2C22] mb-2">{t('section5.thirdParty.title')}</h3>
            <p className="text-[#4A2C22]/80 mb-2">{t('section5.thirdParty.description')}</p>
            <p className="text-[#4A2C22]/80 mb-2">{t('section5.thirdParty.ownership')}</p>
            <p className="text-[#4A2C22]/80 mb-2">{t('section5.thirdParty.noRights')}</p>
            <p className="text-[#4A2C22]/80">{t('section5.thirdParty.trademarks')}</p>
          </section>

          {/* Section 6: Disclaimer of warranties */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section6.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-2">{t('section6.intro')}</p>
            <p className="text-[#4A2C22]/80 mb-2">{t('section6.disclaim')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section6.item1')}</li>
              <li>{t('section6.item2')}</li>
              <li>{t('section6.item3')}</li>
              <li>{t('section6.item4')}</li>
            </ul>
            <p className="text-[#4A2C22]/80 mb-2">{t('section6.noWarrant')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section6.warrant1')}</li>
              <li>{t('section6.warrant2')}</li>
              <li>{t('section6.warrant3')}</li>
              <li>{t('section6.warrant4')}</li>
            </ul>
          </section>

          {/* Section 7: Limitation of liability */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section7.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-2">{t('section7.intro')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section7.item1')}</li>
              <li>{t('section7.item2')}</li>
              <li>{t('section7.item3')}</li>
            </ul>
            <p className="text-[#4A2C22]/80 mb-2">{t('section7.arising')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section7.arise1')}</li>
              <li>{t('section7.arise2')}</li>
              <li>{t('section7.arise3')}</li>
              <li>{t('section7.arise4')}</li>
            </ul>
            <p className="text-[#4A2C22]/80">{t('section7.jurisdictions')}</p>
          </section>

          {/* Section 8: Indemnification */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section8.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-2">{t('section8.intro')}</p>
            <ul className="list-disc list-inside text-[#4A2C22]/80 mb-4 space-y-1 ml-4">
              <li>{t('section8.item1')}</li>
              <li>{t('section8.item2')}</li>
              <li>{t('section8.item3')}</li>
            </ul>
          </section>

          {/* Section 9: Changes to the Site and these Terms */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section9.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-4">{t('section9.siteChanges')}</p>
            <p className="text-[#4A2C22]/80 mb-4">{t('section9.termsChanges')}</p>
            <p className="text-[#4A2C22]/80">{t('section9.continued')}</p>
          </section>

          {/* Section 10: Termination */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section10.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-4">{t('section10.description')}</p>
            <p className="text-[#4A2C22]/80">{t('section10.survival')}</p>
          </section>

          {/* Section 11: Governing law and jurisdiction */}
          <section className="mb-8">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section11.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-4">{t('section11.law')}</p>
            <p className="text-[#4A2C22]/80">{t('section11.jurisdiction')}</p>
          </section>

          {/* Section 12: Contact */}
          <section className="mb-4">
            <h2 className="text-xl font-bold text-[#4A2C22] mb-4">{t('section12.title')}</h2>
            <p className="text-[#4A2C22]/80 mb-2">{t('section12.intro')}</p>
            <div className="bg-[#FFF4E6] rounded-xl p-4 border border-[#F0D3B6]">
              <p className="text-[#4A2C22] font-medium">{t('section12.name')}</p>
              <p className="text-[#4A2C22]/80">{t('section12.email')}</p>
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
