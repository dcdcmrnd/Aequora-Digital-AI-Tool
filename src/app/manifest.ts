import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aequora Digital",
    short_name: "Aequora",
    description: "Project management workspace for Aequora Digital",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0A2540",
    theme_color: "#0F7B8A",
    categories: ["productivity", "business"],
    icons: [
      {
        src: "/api/pwa-icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/pwa-icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [],
  };
}
