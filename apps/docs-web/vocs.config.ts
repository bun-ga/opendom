import { defineConfig } from "vocs";

export default defineConfig({
  title: "opendom Docs",
  sidebar: [
    {
      text: "Setup & Installation",
      link: "/getting-started",
    },
    {
      text: "Authentication",
      link: "/authentication",
    },
    {
      text: "First Commands",
      link: "/first-commands",
    },
    {
      text: "Safety & Reliability",
      link: "/safety",
    },
    {
      text: "Provider Matrix",
      link: "/providers-matrix",
    },
    {
      text: "Command Reference",
      link: "/reference",
    },
  ],
});
