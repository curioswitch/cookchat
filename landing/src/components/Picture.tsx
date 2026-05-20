import type { Picture as ImageToolsPicture } from "vite-imagetools";

const TAILWIND_BREAKPOINTS = {
  sm: "40rem",
  md: "48rem",
  lg: "64rem",
  xl: "80rem",
  "2xl": "96rem",
} as const;

type TailwindBreakpoint = keyof typeof TAILWIND_BREAKPOINTS;

export type PictureSizes =
  | string
  | ({
      base: string;
    } & Partial<Record<TailwindBreakpoint, string>>);

export const PICTURE_SIZE_PRESETS = {
  fullWidth: {
    base: "100vw",
  },
  heroMedia: {
    base: "100vw",
    lg: "60vw",
  },
  photoCard: {
    base: "calc(100vw - 3rem)",
    sm: "calc(50vw - 2rem)",
    lg: "26rem",
  },
  photoCardNarrow: {
    base: "calc(100vw - 3rem)",
    sm: "calc(50vw - 2rem)",
    lg: "20rem",
  },
  photoCardWide: {
    base: "calc(100vw - 3rem)",
    sm: "calc(100vw - 3rem)",
    lg: "26rem",
  },
} satisfies Record<string, PictureSizes>;

export type PictureSizePreset = keyof typeof PICTURE_SIZE_PRESETS;

export function serializePictureSizes(
  sizes?: PictureSizes,
): string | undefined {
  if (!sizes) {
    return undefined;
  }

  if (typeof sizes === "string") {
    return sizes;
  }

  const responsiveSizes = [
    ...(Object.keys(TAILWIND_BREAKPOINTS) as TailwindBreakpoint[]),
  ]
    .reverse()
    .flatMap((breakpoint) => {
      const value = sizes[breakpoint];
      return value
        ? [`(min-width: ${TAILWIND_BREAKPOINTS[breakpoint]}) ${value}`]
        : [];
    });

  responsiveSizes.push(sizes.base);
  return responsiveSizes.join(", ");
}

export function Picture({
  picture,
  alt,
  className,
  loading,
  priority = false,
  sizes,
  sizePreset,
}: {
  picture: ImageToolsPicture;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  priority?: boolean;
  sizes?: PictureSizes;
  sizePreset?: PictureSizePreset;
}) {
  const resolvedSizes = serializePictureSizes(
    sizes ?? (sizePreset ? PICTURE_SIZE_PRESETS[sizePreset] : undefined),
  );
  const resolvedLoading = loading ?? (priority ? "eager" : "lazy");

  return (
    <picture className={className}>
      {Object.entries(picture.sources).map(([format, srcset]) => (
        <source
          key={`${srcset}-${format}`}
          srcSet={srcset}
          sizes={resolvedSizes}
          type={`image/${format}`}
        />
      ))}
      <img
        src={picture.img.src}
        alt={alt}
        width={picture.img.w}
        height={picture.img.h}
        className={className}
        loading={resolvedLoading}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
      />
    </picture>
  );
}
