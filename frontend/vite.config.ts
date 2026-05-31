import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, "../"), "");
  const isDevelopment = mode === "development";

  return {
    plugins: [react(), tailwindcss()],

    envDir: path.resolve(__dirname, "../"),

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    server: isDevelopment
      ? {
          host: true,
          port: 5173,
          allowedHosts: true,

          proxy: {
            "/api": {
              target: env.VITE_API_BASE_URL,
              changeOrigin: true,
              ws: true,
            },

            "/health": {
              target: env.VITE_API_BASE_URL,
              changeOrigin: true,
            },

            "/ready": {
              target: env.VITE_API_BASE_URL,
              changeOrigin: true,
            },
          },
        }
      : undefined,

    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom"],
          },
        },
      },
    },

    esbuild: {
      drop: mode === "production" ? ["console", "debugger"] : [],
    },
  };
});
