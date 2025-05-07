import vikeReact from "vike-react/config";
import type { Config } from "vike/types";
import Layout from "./layouts/Layout";
import Wrapper from "./layouts/Wrapper";

export default {
  Layout,
  Wrapper,
  title: "Let's Cook!",
  extends: vikeReact,
} satisfies Config;
