import { Toaster } from "@MindBridge/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";

import type { orpc } from "@/utils/orpc";

import appCss from "../index.css?url";
export interface RouterAppContext {
	orpc: typeof orpc;
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootDocument,
	head: () => ({
		links: [
			{
				href: appCss,
				rel: "stylesheet",
			},
		],
		meta: [
			{
				charSet: "utf-8",
			},
			{
				content: "width=device-width, initial-scale=1",
				name: "viewport",
			},
			{
				title: "MindBridge",
			},
		],
	}),
});

function RootDocument() {
	return (
		<html lang="vi">
			<head>
				<HeadContent />
			</head>
			<body>
				<main className="min-h-svh">
					<Outlet />
				</main>
				<Toaster richColors />
				<Scripts />
			</body>
		</html>
	);
}
