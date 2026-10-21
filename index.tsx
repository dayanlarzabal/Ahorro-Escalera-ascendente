import { createFileRoute } from "@tanstack/react-router";
import { EscaleraApp } from "@/components/escalera-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <EscaleraApp />;
}
