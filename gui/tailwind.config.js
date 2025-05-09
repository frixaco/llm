import typography from "@tailwindcss/typography";
import catppuccin from "@catppuccin/tailwindcss";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [
    typography,
    catppuccin({
      // prefix every colour with ctp- to avoid clashes: text-mauve → text-ctp-mauve
      prefix: "ctp" /* optional */,
      defaultFlavour: "mocha" /* global default */,
    }),
  ],
};
