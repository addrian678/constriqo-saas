/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#fff9ee",
        sky: "#b8e3ff",
        butter: "#ffe28a",
        peach: "#ffc8a2",
        mint: "#baf0d0",
        lilac: "#d8c8ff",
        ink: "#30415f",
      },
      fontFamily: {
        display: ["Trebuchet MS", "Verdana", "sans-serif"],
        body: ["Nunito", "Trebuchet MS", "Verdana", "sans-serif"],
      },
      boxShadow: {
        cloud: "0 18px 40px rgba(87, 102, 140, 0.12)",
      },
      backgroundImage: {
        sparkles:
          "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.85), transparent 22%), radial-gradient(circle at 78% 12%, rgba(255,240,182,0.65), transparent 18%), radial-gradient(circle at 80% 76%, rgba(216,200,255,0.45), transparent 24%), linear-gradient(180deg, rgba(255,249,238,1) 0%, rgba(243,250,255,1) 100%)",
      },
    },
  },
  plugins: [],
};
