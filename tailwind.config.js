/** Tailwind build config for PayTogether. */
module.exports = {

  content: [
    "./templates/**/*.html",
    "./static/js/**/*.js",
  ],

  theme: {
    extend: {
      colors: {
        ink:    "#0F1E2E",
        ink2:   "#1B3049",
        canvas: "#EEF2F7",
        brand:  "#0E8A7D",
        brand2: "#0A6E63",
        gold:   "#E0A33C",
        owe:    "#D4495A",
        owed:   "#12855F",
      },
      fontFamily: {
        sans:    ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["Sora", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,30,46,.06), 0 8px 24px -12px rgba(15,30,46,.22)",
      },
    },
  },

  plugins: [],
};
