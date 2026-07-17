import {
	createFileRoute,
	Outlet,
	redirect,
	useNavigate,
} from "@tanstack/react-router";

import AppShell from "@/components/app-shell";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data) {
			throw redirect({
				search: { mode: "sign-in" },
				to: "/login",
			});
		}
		return { session };
	},
	component: AuthLayout,
	ssr: false,
});

function AuthLayout() {
	const navigate = useNavigate();
	const { session } = Route.useRouteContext();
	const user = session.data?.user;

	if (!user) {
		return null;
	}

	const handleSignOut = async () => {
		await authClient.signOut();
		await navigate({
			search: { mode: "sign-in" },
			to: "/login",
		});
	};

	return (
		<AppShell name={user.name} onSignOut={handleSignOut} userRole={user.role}>
			<Outlet />
		</AppShell>
	);
}
