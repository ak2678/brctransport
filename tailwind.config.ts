import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: { colors: { brc: { green: "#16a34a", navy: "#0e1b32", canvas: "#f4f6f8", line: "#e5e7eb" } } } },
  plugins: []
} satisfies Config;
