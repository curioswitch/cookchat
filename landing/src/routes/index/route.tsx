import { createFileRoute, useLocation } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FaInstagram, FaXTwitter } from "react-icons/fa6";
import type { Picture as ImageToolsPicture } from "vite-imagetools";

import picAboutCook from "../../assets/coopii/about-01.png?w=320;480;640;960;1280&format=avif;webp;jpg&as=picture";
import picAboutPhone from "../../assets/coopii/about-02.png?w=320;480;640;960;1280&format=avif;webp;jpg&as=picture";
import picAboutFamily from "../../assets/coopii/about-03.webp?w=320;480;640;960;1280&format=avif;webp;jpg&as=picture";
import imgCoopiiLogo from "../../assets/coopii/coopii-logo.png";
import imgCurioSwitchLogo from "../../assets/coopii/curioswitch-logo.png";
import picGalleryCooktop from "../../assets/coopii/gallery-01.jpg?w=320;480;640;960;1280&format=avif;webp;jpg&as=picture";
import picGalleryCutting from "../../assets/coopii/gallery-02.jpg?w=320;480;640;960;1280&format=avif;webp;jpg&as=picture";
import picGalleryJar from "../../assets/coopii/gallery-03.webp?w=320;480;640;960;1280&format=avif;webp;jpg&as=picture";
import picGalleryPrep from "../../assets/coopii/gallery-04.jpg?w=320;480;640;960;1280&format=avif;webp;jpg&as=picture";
import picGalleryPhone from "../../assets/coopii/gallery-05.png?w=320;480;640;960;1280&format=avif;webp;jpg&as=picture";
import picHeroKitchen from "../../assets/coopii/hero-kitchen.jpg?w=640;960;1440;2160&format=avif;webp;jpg&as=picture";
import { Picture, type PictureSizePreset } from "../../components/Picture";
import { m } from "../../paraglide/messages";
import { getLocale, getUrlOrigin, localizeUrl } from "../../paraglide/runtime";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: m.home_meta_title() },
      {
        name: "description",
        content: m.site_description(),
      },
    ],
  }),
});

type NavItem = {
  href: string;
  getLabel: () => string;
  external?: boolean;
};

const desktopNavItems: readonly NavItem[] = [
  { href: "#concept", getLabel: () => m.home_nav_concept() },
  { href: "#photo", getLabel: () => m.home_nav_photo() },
  { href: "#aboutcopii", getLabel: () => m.home_nav_about() },
  { href: "#company", getLabel: () => m.home_nav_company() },
] as const;

const footerNavItems = [
  { href: "#concept", getLabel: () => m.home_nav_concept() },
  { href: "#photo", getLabel: () => m.home_nav_photo() },
  { href: "#aboutcopii", getLabel: () => m.home_nav_footer_coopii() },
  { href: "#company", getLabel: () => m.home_nav_company() },
] as const;

const featureItems = [
  {
    getLabel: () => m.home_feature_handsfree_label(),
    getTitle: () => m.home_feature_handsfree_title(),
    getBody: () => m.home_feature_handsfree_body(),
  },
  {
    getLabel: () => m.home_feature_multidish_label(),
    getTitle: () => m.home_feature_multidish_title(),
    getBody: () => m.home_feature_multidish_body(),
  },
  {
    getLabel: () => m.home_feature_mealplan_label(),
    getTitle: () => m.home_feature_mealplan_title(),
    getBody: () => m.home_feature_mealplan_body(),
  },
] as const;

const localeItems = [
  { getLabel: () => m.common_locale_en_label(), locale: "en" },
  { getLabel: () => m.common_locale_ja_label(), locale: "ja" },
] as const;

function toRelativeHref(url: URL) {
  return `${url.pathname}${url.search}${url.hash}`;
}

function LanguageSwitcher({
  className,
  currentClassName,
  linkClassName,
  onNavigate,
}: {
  className: string;
  currentClassName: string;
  linkClassName: string;
  onNavigate?: () => void;
}) {
  const href = useLocation({ select: (location) => location.href });
  const currentLocale = getLocale();
  const currentUrl = new URL(href, getUrlOrigin());

  return (
    <nav className={className} aria-label={m.common_language_switcher_label()}>
      {localeItems.map((item, index) => {
        const isCurrent = item.locale === currentLocale;
        const label = item.getLabel();
        const targetHref = isCurrent
          ? undefined
          : toRelativeHref(localizeUrl(currentUrl, { locale: item.locale }));

        return (
          <span key={item.locale} className="contents">
            {isCurrent ? (
              <span className={currentClassName} aria-current="true">
                {label}
              </span>
            ) : (
              <a
                href={targetHref}
                lang={item.locale}
                hrefLang={item.locale}
                className={linkClassName}
                onClick={onNavigate}
              >
                {label}
              </a>
            )}
            {index < localeItems.length - 1 ? (
              <span aria-hidden="true" className="opacity-50">
                /
              </span>
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}

function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  return (
    <main
      id="top"
      className="coopii-page relative overflow-x-hidden bg-white text-[#090c22]"
      style={{ fontFamily: "var(--font-coopii-jp)" }}
    >
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40">
        <div className="mx-auto flex max-w-[120rem] items-start justify-between px-5 pt-5 sm:px-8 md:px-10 md:pt-8">
          <a
            href="#top"
            className="pointer-events-auto inline-flex w-[4.75rem] sm:w-[6rem] lg:w-[10.5rem]"
            aria-label={m.home_header_logo_aria()}
          >
            <img
              src={imgCoopiiLogo}
              alt={m.common_brand_coopii()}
              className="h-auto w-full"
            />
          </a>

          <div className="pointer-events-auto hidden lg:flex">
            <nav
              aria-label={m.home_nav_desktop_label()}
              className="flex flex-col items-end gap-3"
            >
              <ul className="flex flex-col items-end gap-1.5">
                {desktopNavItems.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noreferrer" : undefined}
                      className="inline-flex bg-white px-2 py-1 text-[1.05rem] font-extrabold tracking-[0.12em] text-[#090c22] transition-transform duration-200 hover:translate-x-1"
                      style={{ fontFamily: "var(--font-coopii-display)" }}
                    >
                      {item.getLabel()}
                    </a>
                  </li>
                ))}
              </ul>
              <LanguageSwitcher
                className="flex items-center gap-2 bg-white px-2 py-1 text-xs font-extrabold tracking-[0.18em] text-[#090c22]"
                currentClassName="underline decoration-2 underline-offset-4"
                linkClassName="transition-opacity hover:opacity-65"
              />
            </nav>
          </div>

          <button
            type="button"
            className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center bg-[#090c22] text-white lg:hidden"
            aria-expanded={isMenuOpen}
            aria-controls="coopii-mobile-menu"
            aria-label={
              isMenuOpen
                ? m.common_menu_close_label()
                : m.common_menu_open_label()
            }
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </header>

      <div
        id="coopii-mobile-menu"
        className={`fixed inset-0 z-30 bg-white px-6 py-24 transition-opacity duration-200 lg:hidden ${
          isMenuOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      >
        <nav
          aria-label={m.home_mobile_nav_label()}
          className="flex h-full flex-col justify-center gap-8"
        >
          <ul className="flex flex-col gap-5">
            {desktopNavItems.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noreferrer" : undefined}
                  className="text-4xl font-extrabold tracking-[0.1em] text-[#090c22]"
                  style={{ fontFamily: "var(--font-coopii-display)" }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.getLabel()}
                </a>
              </li>
            ))}
          </ul>
          <LanguageSwitcher
            className="flex items-center gap-2 text-sm font-extrabold tracking-[0.18em] text-[#090c22]"
            currentClassName="underline decoration-2 underline-offset-4"
            linkClassName="transition-opacity hover:opacity-65"
            onNavigate={() => setIsMenuOpen(false)}
          />
        </nav>
      </div>

      <section className="relative mx-auto grid max-w-[120rem] grid-cols-1 bg-white lg:min-h-screen lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div
          className="pointer-events-none absolute left-0 top-0 hidden h-[8.5rem] w-[18rem] lg:block xl:h-[9.25rem] xl:w-[19.5rem]"
          style={{
            background:
              "linear-gradient(135deg, var(--coopii-orange) 0%, var(--coopii-yellow) 100%)",
            clipPath: "polygon(0 0, 100% 0, 0 100%)",
          }}
        />

        <div className="relative z-10 flex flex-col px-6 pb-12 pt-28 sm:px-8 sm:pt-32 md:px-10 lg:min-h-screen lg:px-12 lg:pt-[6.1rem] xl:px-16 xl:pt-[6.5rem]">
          <div className="lg:mt-8">
            <div className="max-w-[18.5rem] space-y-3 sm:max-w-[21rem] sm:space-y-4 lg:max-w-[24rem]">
              <h1
                className="text-[2.45rem] leading-[1.4] tracking-[0.08em] text-[#090c22] sm:text-[2.95rem] lg:text-[3.15rem]"
                style={{ fontFamily: "var(--font-coopii-jp)" }}
              >
                <span className="block">
                  <span className="inline-block bg-white px-2 py-1.5 lg:px-3 lg:py-2">
                    {m.home_hero_title_line1()}
                  </span>
                </span>
                <span className="mt-1 block lg:mt-2">
                  <span className="inline-block bg-white px-2 py-1.5 lg:px-3 lg:py-2">
                    {m.home_hero_title_line2()}
                  </span>
                </span>
              </h1>
              <p className="text-sm leading-[2.1] tracking-[0.05em] text-[#090c22]/85 sm:text-base lg:text-[1.12rem]">
                <span className="block">
                  <span className="inline-block bg-white px-2 py-1 lg:px-3">
                    {m.home_hero_subtitle_line1()}
                  </span>
                </span>
                <span className="mt-1 block">
                  <span className="inline-block bg-white px-2 py-1 lg:px-3">
                    {m.home_hero_subtitle_line2()}
                  </span>
                </span>
              </p>
            </div>

            <div className="mt-12 w-fit border-b border-[#090c22] pb-3 lg:mt-[6rem]">
              <img
                src={imgCoopiiLogo}
                alt={m.common_brand_coopii()}
                className="h-auto w-[8rem] sm:w-[10rem] lg:w-[12.5rem]"
              />
            </div>

            <a
              href="#concept"
              className="group mt-8 flex w-fit items-end gap-4 lg:mt-11"
            >
              <span
                className="text-base font-bold tracking-[0.16em] text-[#090c22]"
                style={{
                  fontFamily: "var(--font-coopii-display)",
                  writingMode: "vertical-rl",
                }}
              >
                {m.home_scroll_label()}
              </span>
              <span className="flex flex-col items-center gap-3 text-[#090c22] transition-transform duration-200 group-hover:translate-y-1">
                <span className="h-16 w-px bg-[#090c22] sm:h-20" />
                <ArrowDown size={20} strokeWidth={1.8} />
              </span>
            </a>
          </div>
        </div>

        <div className="min-h-[26rem] lg:min-h-screen">
          <Picture
            picture={picHeroKitchen}
            alt={m.home_hero_alt()}
            className="block h-full w-full object-cover object-center"
            priority
            sizePreset="heroMedia"
          />
        </div>
      </section>

      <section
        id="concept"
        className="scroll-mt-20 bg-white px-6 py-16 sm:px-8 md:px-10 lg:px-12 lg:py-24"
      >
        <div className="mx-auto max-w-[66rem]">
          <div className="relative isolate overflow-hidden bg-white">
            <div
              className="absolute inset-y-0 right-0 hidden w-[62%] lg:block"
              style={{
                background:
                  "linear-gradient(135deg, var(--coopii-blue) 0%, var(--coopii-green) 45%, var(--coopii-yellow) 100%)",
                clipPath: "polygon(72% 0, 100% 0, 100% 100%, 0 100%)",
              }}
            />

            <div className="relative grid gap-14 lg:min-h-[50rem] lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:gap-10">
              <div className="max-w-[28rem] py-6 lg:py-14">
                <div>
                  <p
                    className="text-xs font-extrabold tracking-[0.34em] text-[#090c22] sm:text-sm"
                    style={{ fontFamily: "var(--font-coopii-display)" }}
                  >
                    {m.home_nav_concept()}
                  </p>
                  <h2
                    className="mt-6 text-[2.2rem] leading-[1.45] tracking-[0.14em] text-[var(--coopii-mist)] sm:text-[2.75rem] lg:text-[3.35rem] lg:whitespace-nowrap"
                    style={{ fontFamily: "var(--font-coopii-jp)" }}
                  >
                    {m.home_concept_heading()}
                  </h2>
                </div>

                <p className="mt-14 max-w-[18.5rem] whitespace-pre-line text-[0.95rem] leading-[2.2] tracking-[0.01em] text-[#090c22]/85 sm:text-[0.98rem]">
                  {m.home_concept_body()}
                </p>

                <div className="mt-10 max-w-[13.5rem]">
                  <CtaLink
                    href="https://alpha.coopii.app"
                    label={m.home_cta_try()}
                  />
                </div>
              </div>

              <div className="min-h-[6rem] py-8 lg:min-h-[50rem]" />
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-white px-6 pb-20 pt-4 sm:px-8 md:px-10 lg:px-12 lg:pb-28 lg:pt-0">
        <div id="photo" className="absolute top-[14rem] lg:top-[18rem]" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "var(--coopii-yellow)",
            clipPath:
              "polygon(48% 0, 100% 0, 100% 72%, 82% 100%, 0 100%, 0 54%)",
          }}
        />

        <div className="relative mx-auto max-w-[80rem] lg:min-h-[58rem]">
          <div className="flex justify-end pt-8 lg:pr-[2.5rem] lg:pt-12">
            <div className="text-right">
              <p
                className="text-[2.8rem] font-extrabold leading-none tracking-[0.12em] text-[#090c22] sm:text-[3.7rem]"
                style={{ fontFamily: "var(--font-coopii-display)" }}
              >
                {m.home_photo_heading()}
              </p>
              <p className="mt-3 text-sm tracking-[0.08em] text-[#090c22] sm:text-base">
                {m.home_photo_subtitle()}
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:grid-rows-[14rem_15rem_15rem]">
            <PhotoCard
              picture={picGalleryCooktop}
              alt={m.home_gallery_alt_cooktop()}
              className="sm:col-span-1 lg:col-span-3 lg:col-start-1 lg:row-start-1 lg:mt-8"
              aspectClassName="aspect-[4/5]"
              sizePreset="photoCardNarrow"
            />
            <PhotoCard
              picture={picGalleryCutting}
              alt={m.home_gallery_alt_cutting()}
              className="sm:col-span-1 lg:col-span-4 lg:col-start-4 lg:row-span-2 lg:mt-10"
              aspectClassName="aspect-[3/4]"
            />
            <PhotoCard
              picture={picGalleryJar}
              alt={m.home_gallery_alt_jar()}
              className="hidden sm:col-span-1 lg:col-span-2 lg:col-start-10 lg:row-start-1 lg:mt-32 lg:block"
              aspectClassName="aspect-[4/5]"
              sizePreset="photoCardNarrow"
            />
            <PhotoCard
              picture={picGalleryPrep}
              alt={m.home_gallery_alt_prep()}
              className="sm:col-span-1 lg:col-span-3 lg:col-start-9 lg:row-start-2 lg:mt-4"
              aspectClassName="aspect-[2/3]"
              sizePreset="photoCardNarrow"
            />
            <PhotoCard
              picture={picGalleryPhone}
              alt={m.home_gallery_alt_phone()}
              className="sm:col-span-2 lg:col-span-4 lg:col-start-2 lg:row-start-3 lg:-mt-2"
              aspectClassName="aspect-[3/2]"
              sizePreset="photoCardWide"
            />
          </div>
        </div>
      </section>

      <section
        id="aboutcopii"
        className="scroll-mt-20 relative overflow-hidden bg-white px-6 py-16 sm:px-8 md:px-10 lg:px-12 lg:py-24"
      >
        <div
          className="pointer-events-none absolute left-0 top-0 hidden h-[20rem] w-[24rem] lg:block"
          style={{
            background:
              "linear-gradient(180deg, var(--coopii-yellow) 0%, color-mix(in srgb, var(--coopii-yellow) 88%, white 12%) 100%)",
            clipPath: "polygon(0 0, 100% 0, 0 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute bottom-0 right-0 hidden h-[12rem] w-[12rem] lg:block"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--coopii-yellow) 88%, white 12%) 0%, var(--coopii-yellow) 100%)",
            clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
          }}
        />

        <div className="relative mx-auto max-w-[62rem]">
          <div className="mb-12 flex justify-end lg:mb-14">
            <div className="text-right">
              <p
                className="text-[2.45rem] font-bold leading-none tracking-[0.04em] text-[var(--coopii-mist)] sm:text-[3.2rem] lg:text-[3.6rem]"
                style={{ fontFamily: "var(--font-coopii-display)" }}
              >
                {m.home_about_heading()}
              </p>
            </div>
          </div>

          <div className="space-y-10 lg:ml-[6.5rem] lg:max-w-[34rem] lg:space-y-12">
            {featureItems.map((item) => (
              <div
                key={item.getTitle()}
                className="grid gap-6 md:grid-cols-[7.75rem_minmax(0,1fr)] md:items-start md:gap-7 lg:grid-cols-[8.25rem_minmax(0,22.5rem)]"
              >
                <div className="flex justify-center md:justify-start">
                  <div
                    className="rounded-full p-px"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--coopii-blue) 0%, var(--coopii-yellow) 100%)",
                    }}
                  >
                    <div className="flex aspect-square w-28 items-center justify-center rounded-full bg-white px-4 text-center lg:w-32">
                      <span
                        className="whitespace-pre-line text-[0.95rem] font-extrabold leading-[1.3] tracking-[0.16em] text-[#090c22] lg:text-[1.05rem]"
                        style={{ fontFamily: "var(--font-coopii-display)" }}
                      >
                        {item.getLabel()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <h3 className="text-[1.02rem] font-medium leading-[1.7] tracking-[0.04em] text-[#090c22] sm:text-[1.1rem]">
                    {item.getTitle()}
                  </h3>
                  <p className="max-w-[22.5rem] text-[0.9rem] leading-[2.05] tracking-[0.01em] text-[#090c22]/85 sm:text-[0.95rem]">
                    {item.getBody()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative mt-16 overflow-hidden py-8 lg:mt-20 lg:py-14">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, var(--coopii-blue) 0%, var(--coopii-yellow) 100%)",
                clipPath:
                  "polygon(0 26%, 26% 0, 100% 0, 100% 74%, 74% 100%, 0 100%)",
              }}
            />

            <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
              <PhotoCard
                picture={picAboutCook}
                alt={m.home_about_alt_cook()}
                className="sm:col-span-1 lg:col-span-3 lg:col-start-2 lg:mt-[4.5rem]"
                aspectClassName="aspect-[2/3]"
                sizePreset="photoCardNarrow"
              />
              <PhotoCard
                picture={picAboutPhone}
                alt={m.home_about_alt_phone()}
                className="sm:col-span-1 lg:col-span-4 lg:col-start-5 lg:mt-3"
                aspectClassName="aspect-[4/5]"
              />
              <PhotoCard
                picture={picAboutFamily}
                alt={m.home_about_alt_family()}
                className="sm:col-span-2 lg:col-span-3 lg:col-start-9 lg:mt-24"
                aspectClassName="aspect-[4/5]"
                sizePreset="photoCardNarrow"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        id="company"
        className="scroll-mt-24 bg-white px-6 pt-6 sm:px-8 md:px-10 lg:px-12 lg:pt-10"
      >
        <div className="mx-auto max-w-[80rem]">
          <div className="relative isolate overflow-hidden px-6 py-16 sm:px-10 lg:px-16 lg:py-20">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, var(--coopii-blue) 0%, var(--coopii-yellow) 100%)",
                clipPath: "polygon(0 0, 100% 0, 100% 68%, 68% 100%, 0 100%)",
              }}
            />

            <div className="relative mx-auto max-w-3xl text-center">
              <p
                className="text-[2.8rem] font-extrabold leading-none tracking-[0.12em] text-[#090c22] sm:text-[4rem]"
                style={{ fontFamily: "var(--font-coopii-display)" }}
              >
                {m.home_company_heading()}
              </p>
              <p className="mt-3 text-sm tracking-[0.08em] text-[#090c22] sm:text-base">
                {m.home_company_subtitle()}
              </p>

              <a
                href="https://curioswitch.org/"
                target="_blank"
                rel="noreferrer"
                className="mx-auto mt-10 inline-flex w-[11rem] sm:w-[12.5rem]"
              >
                <img
                  src={imgCurioSwitchLogo}
                  alt={m.common_brand_curioswitch()}
                  className="h-auto w-full"
                />
              </a>

              <p className="mx-auto mt-8 max-w-[32rem] text-[0.95rem] leading-[2.1] tracking-[0.02em] text-[#090c22]/85 sm:text-base">
                {m.home_company_body()}
              </p>

              <div className="mt-10">
                <CtaLink
                  href="https://alpha.coopii.app"
                  label={m.home_cta_try()}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-white px-6 py-16 sm:px-8 md:px-10 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-[80rem]">
          <div className="flex flex-col gap-12 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-8">
              <a href="#top" className="inline-flex w-[8rem] sm:w-[10rem]">
                <img
                  src={imgCoopiiLogo}
                  alt={m.common_brand_coopii()}
                  className="h-auto w-full"
                />
              </a>

              <nav aria-label={m.home_footer_nav_label()}>
                <ul className="grid gap-5">
                  {footerNavItems.map((item) => (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        className="text-sm font-medium tracking-[0.08em] text-[#090c22]/85 transition-transform duration-200 hover:translate-x-1"
                      >
                        {item.getLabel()}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            <div className="flex flex-col gap-6 lg:items-end">
              <p className="whitespace-pre-line text-sm leading-[1.8] tracking-[0.02em] text-[#090c22]/85 lg:text-right">
                {m.home_footer_follow()}
              </p>

              <div className="flex items-center gap-5 text-[#090c22]">
                <a
                  href="https://www.instagram.com/coopiichan/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label={m.common_social_instagram_label()}
                  className="text-[2rem] transition-transform duration-200 hover:-translate-y-1"
                >
                  <FaInstagram />
                </a>
                <a
                  href="https://x.com/coopiichan"
                  target="_blank"
                  rel="noreferrer"
                  aria-label={m.common_social_x_label()}
                  className="text-[1.95rem] transition-transform duration-200 hover:-translate-y-1"
                >
                  <FaXTwitter />
                </a>
              </div>

              <p className="text-xs tracking-[0.02em] text-[#090c22]/75">
                {m.common_copyright()}
              </p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function CtaLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group inline-flex w-full max-w-[22rem] items-center justify-center border-y border-[#090c22] px-3 py-4 text-center sm:px-6"
    >
      <span
        className="flex items-center gap-5 text-lg font-extrabold text-[#090c22] transition-transform duration-200 group-hover:translate-x-1"
        style={{ fontFamily: "var(--font-coopii-display)" }}
      >
        <span>{label}</span>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#090c22] text-white">
          <ArrowRight size={18} strokeWidth={2} />
        </span>
      </span>
    </a>
  );
}

function PhotoCard({
  picture,
  alt,
  className,
  aspectClassName,
  sizePreset = "photoCard",
}: {
  picture: ImageToolsPicture;
  alt: string;
  className: string;
  aspectClassName: string;
  sizePreset?: PictureSizePreset;
}) {
  return (
    <div
      className={`overflow-hidden shadow-[0_18px_40px_rgba(9,12,34,0.08)] ${className}`}
    >
      <div className={aspectClassName}>
        <Picture
          picture={picture}
          alt={alt}
          className="block h-full w-full object-cover"
          sizePreset={sizePreset}
        />
      </div>
    </div>
  );
}
