import { allLegals, allNews, allWorks } from "content-collections";

export type LegalEntry = (typeof allLegals)[number];
export type NewsEntry = (typeof allNews)[number];
export type WorkEntry = (typeof allWorks)[number];

function compareNewsByDate(a: NewsEntry, b: NewsEntry) {
  return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
}

function compareWorksByOrder(a: WorkEntry, b: WorkEntry) {
  return (
    (a.order ?? Number.MAX_SAFE_INTEGER) -
      (b.order ?? Number.MAX_SAFE_INTEGER) || a.slug.localeCompare(b.slug)
  );
}

export function getLocalizedNews(locale: string) {
  return allNews
    .filter((article) => article.locale === locale)
    .sort(compareNewsByDate);
}

export function getLocalizedLegal(locale: string) {
  return allLegals
    .filter((page) => page.locale === locale)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function getLocalizedWorks(locale: string) {
  return allWorks
    .filter((work) => work.locale === locale)
    .sort(compareWorksByOrder);
}

export function findLocalizedLegal(locale: string, slug: string) {
  return allLegals.find((page) => page.locale === locale && page.slug === slug);
}

export function findLocalizedNews(locale: string, slug: string) {
  return allNews.find(
    (article) => article.locale === locale && article.slug === slug,
  );
}

export function findLocalizedWork(locale: string, slug: string) {
  return allWorks.find((work) => work.locale === locale && work.slug === slug);
}
