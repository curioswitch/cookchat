import siteHeroSocialImage from "../assets/site-hero.png?w=1200&h=630&fit=cover&format=png&as=metadata";
import { site_description } from "../paraglide/messages";

const SITE_TITLE = "CurioSwitch";
const SITE_NAME = "CurioSwitch";
const TWITTER_CARD = "summary_large_image";

export type SocialImageMetadata = {
  format?: string;
  height: number;
  src: string;
  width: number;
};

type HeadMeta =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string };

function getSiteOrigin() {
  return new URL(import.meta.env.VITE_SITE_URL);
}

function getSocialImageMimeType(image: SocialImageMetadata) {
  if (!image.format) {
    return undefined;
  }

  return `image/${image.format === "jpg" ? "jpeg" : image.format}`;
}

function toAbsoluteUrl(path: string) {
  return new URL(path, getSiteOrigin()).toString();
}

function createSocialImageMeta(
  image: SocialImageMetadata,
  alt: string,
  propertyPrefix: "og" | "twitter",
): HeadMeta[] {
  const imageUrl = toAbsoluteUrl(image.src);
  if (propertyPrefix === "og") {
    const meta: HeadMeta[] = [
      { property: "og:image", content: imageUrl },
      { property: "og:image:alt", content: alt },
      { property: "og:image:width", content: String(image.width) },
      { property: "og:image:height", content: String(image.height) },
    ];

    const mimeType = getSocialImageMimeType(image);
    if (mimeType) {
      meta.push({ property: "og:image:type", content: mimeType });
    }

    return meta;
  }

  return [
    { name: "twitter:image", content: imageUrl },
    { name: "twitter:image:alt", content: alt },
  ];
}

export function createBaseMetadata({ pathname }: { pathname: string }) {
  const title = SITE_TITLE;
  const description = site_description();
  const url = toAbsoluteUrl(pathname);

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      ...createSocialImageMeta(siteHeroSocialImage, SITE_NAME, "og"),
      { name: "twitter:card", content: TWITTER_CARD },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      ...createSocialImageMeta(siteHeroSocialImage, SITE_NAME, "twitter"),
    ] satisfies HeadMeta[],
  };
}

export function createContentMetadata({
  description,
  image,
  title,
}: {
  description: string;
  image: SocialImageMetadata;
  title: string;
}) {
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      ...createSocialImageMeta(image, title, "og"),
      { name: "twitter:card", content: TWITTER_CARD },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      ...createSocialImageMeta(image, title, "twitter"),
    ] satisfies HeadMeta[],
  };
}
