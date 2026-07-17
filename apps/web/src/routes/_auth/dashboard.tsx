import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@MindBridge/ui/components/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@MindBridge/ui/components/empty";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import Loader from "@/components/loader";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/dashboard")({
	component: RouteComponent,
});

function RouteComponent() {
	const { session } = Route.useRouteContext();
	const privateData = useQuery(orpc.privateData.queryOptions());

	if (privateData.isPending) {
		return <Loader />;
	}

	if (privateData.isError) {
		return (
			<section
				className="rounded-lg border border-destructive/30 bg-destructive/10 p-6"
				role="alert"
			>
				<h1 className="font-semibold text-lg">Không thể tải tổng quan</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Hãy thử lại sau ít phút.
				</p>
			</section>
		);
	}

	if (!privateData.data) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyTitle>Chưa có dữ liệu tổng quan</EmptyTitle>
					<EmptyDescription>
						Dữ liệu học tập sẽ xuất hiện khi bạn bắt đầu sử dụng MindBridge.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Xin chào, {session.data?.user.name}</CardTitle>
				<CardDescription>
					Tổng quan cá nhân của bạn sẽ được cập nhật tại đây.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<p className="text-muted-foreground text-sm">
					{privateData.data.message}
				</p>
			</CardContent>
		</Card>
	);
}
