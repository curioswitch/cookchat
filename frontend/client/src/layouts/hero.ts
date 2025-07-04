import { heroui } from "@heroui/theme";

export default heroui({
  addCommonColors: true,
  themes: {
    light: {
      colors: {
        default: {
          "50": "#fafafa",
          "100": "#f2f2f3",
          "200": "#ebebec",
          "300": "#e3e3e6",
          "400": "#dcdcdf",
          "500": "#d4d4d8",
          "600": "#afafb2",
          "700": "#8a8a8c",
          "800": "#656567",
          "900": "#404041",
          foreground: "#000",
          DEFAULT: "#d4d4d8",
        },
        primary: {
          "50": "#feeee2",
          "100": "#fdd5b9",
          "200": "#fcbd90",
          "300": "#fba468",
          "400": "#fa8c3f",
          "500": "#f97316",
          "600": "#cd5f12",
          "700": "#a24b0e",
          "800": "#76370a",
          "900": "#4b2307",
          foreground: "#000",
          DEFAULT: "#f97316",
        },
        secondary: {
          "50": "#eee4f8",
          "100": "#d7bfef",
          "200": "#bf99e5",
          "300": "#a773db",
          "400": "#904ed2",
          "500": "#7828c8",
          "600": "#6321a5",
          "700": "#4e1a82",
          "800": "#39135f",
          "900": "#240c3c",
          foreground: "#fff",
          DEFAULT: "#7828c8",
        },
        success: {
          "50": "#e2f8ec",
          "100": "#b9efd1",
          "200": "#91e5b5",
          "300": "#68dc9a",
          "400": "#40d27f",
          "500": "#17c964",
          "600": "#13a653",
          "700": "#0f8341",
          "800": "#0b5f30",
          "900": "#073c1e",
          foreground: "#000",
          DEFAULT: "#17c964",
        },
        warning: {
          "50": "#fef4e3",
          "100": "#fde4bc",
          "200": "#fbd495",
          "300": "#fac46d",
          "400": "#f8b446",
          "500": "#f7a41f",
          "600": "#cc871a",
          "700": "#a16b14",
          "800": "#754e0f",
          "900": "#4a3109",
          foreground: "#000",
          DEFAULT: "#f7a41f",
        },
        danger: {
          "50": "#fee1eb",
          "100": "#fbb8cf",
          "200": "#f98eb3",
          "300": "#f76598",
          "400": "#f53b7c",
          "500": "#f31260",
          "600": "#c80f4f",
          "700": "#9e0c3e",
          "800": "#73092e",
          "900": "#49051d",
          foreground: "#000",
          DEFAULT: "#f31260",
        },
        background: "#ffffff",
        foreground: "#000000",
        content1: {
          DEFAULT: "#ffffff",
          foreground: "#000",
        },
        content2: {
          DEFAULT: "#f4f4f5",
          foreground: "#000",
        },
        content3: {
          DEFAULT: "#e4e4e7",
          foreground: "#000",
        },
        content4: {
          DEFAULT: "#d4d4d8",
          foreground: "#000",
        },
        focus: "#006FEE",
        overlay: "#000000",
      },
    },
    dark: {
      colors: {
        default: {
          "50": "#0d0d0e",
          "100": "#19191c",
          "200": "#26262a",
          "300": "#323238",
          "400": "#3f3f46",
          "500": "#65656b",
          "600": "#8c8c90",
          "700": "#b2b2b5",
          "800": "#d9d9da",
          "900": "#ffffff",
          foreground: "#fff",
          DEFAULT: "#3f3f46",
        },
        primary: {
          "50": "#4b2307",
          "100": "#76370a",
          "200": "#a24b0e",
          "300": "#cd5f12",
          "400": "#f97316",
          "500": "#fa8c3f",
          "600": "#fba468",
          "700": "#fcbd90",
          "800": "#fdd5b9",
          "900": "#feeee2",
          foreground: "#000",
          DEFAULT: "#f97316",
        },
        secondary: {
          "50": "#240c3c",
          "100": "#39135f",
          "200": "#4e1a82",
          "300": "#6321a5",
          "400": "#7828c8",
          "500": "#904ed2",
          "600": "#a773db",
          "700": "#bf99e5",
          "800": "#d7bfef",
          "900": "#eee4f8",
          foreground: "#fff",
          DEFAULT: "#7828c8",
        },
        success: {
          "50": "#073c1e",
          "100": "#0b5f30",
          "200": "#0f8341",
          "300": "#13a653",
          "400": "#17c964",
          "500": "#40d27f",
          "600": "#68dc9a",
          "700": "#91e5b5",
          "800": "#b9efd1",
          "900": "#e2f8ec",
          foreground: "#000",
          DEFAULT: "#17c964",
        },
        warning: {
          "50": "#4a3109",
          "100": "#754e0f",
          "200": "#a16b14",
          "300": "#cc871a",
          "400": "#f7a41f",
          "500": "#f8b446",
          "600": "#fac46d",
          "700": "#fbd495",
          "800": "#fde4bc",
          "900": "#fef4e3",
          foreground: "#000",
          DEFAULT: "#f7a41f",
        },
        danger: {
          "50": "#49051d",
          "100": "#73092e",
          "200": "#9e0c3e",
          "300": "#c80f4f",
          "400": "#f31260",
          "500": "#f53b7c",
          "600": "#f76598",
          "700": "#f98eb3",
          "800": "#fbb8cf",
          "900": "#fee1eb",
          foreground: "#000",
          DEFAULT: "#f31260",
        },
        background: "#000000",
        foreground: "#ffffff",
        content1: {
          DEFAULT: "#18181b",
          foreground: "#fff",
        },
        content2: {
          DEFAULT: "#27272a",
          foreground: "#fff",
        },
        content3: {
          DEFAULT: "#3f3f46",
          foreground: "#fff",
        },
        content4: {
          DEFAULT: "#52525b",
          foreground: "#fff",
        },
        focus: "#006FEE",
        overlay: "#ffffff",
      },
    },
  },
  layout: {
    disabledOpacity: "0.5",
  },
});
