import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1c1c16",
        paper: "#f5efe4",
        mist: "#e4dece",
        sage: "#8fa88b",
        pine: "#355246",
        clay: "#bc7c55",
        rose: "#cd9072",
        ocean: "#5b87a6",
      },
      boxShadow: {
        panel: "0 20px 40px rgba(28, 28, 22, 0.08)",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
