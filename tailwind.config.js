export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#111418", 2: "#4b5563", 3: "#6b7280" },
        line: "#d9dde3",
        panel: "#ffffff",
        chrome: "#15202B",
        accent: { DEFAULT: "#0b5fff", dark: "#0847c2" },
        st: { moving: "#15803d", idle: "#b45309", offline: "#6b7280", alert: "#c01f2f" },
      },
      fontFamily: { sans: ["Barlow", "system-ui", "sans-serif"], display: ["Barlow Condensed", "Barlow", "system-ui", "sans-serif"] },
    },
  },
};
