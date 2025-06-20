import type { Config } from "vike/types";
import vikeReact from "vike-react/config";
import Layout from "./layouts/Layout";
import Wrapper from "./layouts/Wrapper";

export default {
  Layout,
  Wrapper,
  title: "Let's Cook!",
  prerender: {
    partial: true,
  },
  extends: vikeReact,
} satisfies Config;
