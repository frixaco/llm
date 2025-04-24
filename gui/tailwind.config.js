module.exports = {
  content: ["./src/**/*.{html,js,ts,jsx,tsx}"],
  plugins: [
    require("@tailwindcss/typography"),
    require("@catppuccin/tailwindcss")({
      // prefix every colour with ctp- to avoid clashes: text-mauve → text-ctp-mauve
      prefix: "ctp" /* optional */,
      defaultFlavour: "mocha" /* global default */,
    }),
  ],
};
