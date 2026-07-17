import { Button } from "@MindBridge/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/dashboard")({
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const { session } = Route.useRouteContext();
	const privateData = useQuery(orpc.privateData.queryOptions());
	const role = session.data?.user.role;

	const handleSignOut = async () => {
		await authClient.signOut();
		await navigate({ to: "/login" });
	};

	return (
		<div>
			<nav aria-label="Account navigation">
				<p>Signed in as {role}</p>
				<Button onClick={handleSignOut} type="button">
					Sign out
				</Button>
			</nav>
			<h1>Dashboard</h1>
			<p>Welcome {session.data?.user.name}</p>
			<p>API: {privateData.data?.message}</p>
		</div>
	);
}
