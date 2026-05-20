declare module "*?as=picture" {
  import type { Picture } from "vite-imagetools";

  const picture: Picture;
  export default picture;
}

declare module "*&as=picture" {
  import type { Picture } from "vite-imagetools";

  const picture: Picture;
  export default picture;
}

declare module "*?as=metadata" {
  const metadata: {
    format?: string;
    height: number;
    src: string;
    width: number;
  };
  export default metadata;
}

declare module "*&as=metadata" {
  const metadata: {
    format?: string;
    height: number;
    src: string;
    width: number;
  };
  export default metadata;
}
