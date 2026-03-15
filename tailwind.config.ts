import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        mist: "#f7f7f2",
        accent: "#15616d",
        ember: "#ff7d00",
        sand: "#f4d58d"
      },
      boxShadow: {
        panel: "0 24px 60px -30px rgba(15, 23, 42, 0.45)"
      },
      backgroundImage: {
        halo: "radial-gradient(circle at top left, rgba(21, 97, 109, 0.22), transparent 42%), radial-gradient(circle at top right, rgba(255, 125, 0, 0.18), transparent 28%)"
      }
    }
  },
  plugins: []
};

export default config;
