import { createFileRoute } from "@tanstack/react-router";

import ContentStudio from "@/components/content-studio";

export const Route = createFileRoute("/_auth/content-studio")({
	component: ContentStudio,
});
