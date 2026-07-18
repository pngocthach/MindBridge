import { createFileRoute } from "@tanstack/react-router";

import ContentStudio from "@/components/content-studio";
import CourseCurriculumManager from "@/components/course-curriculum-manager";

export const Route = createFileRoute("/_auth/content-studio")({
	component: ContentStudioPage,
});

function ContentStudioPage() {
	const { session } = Route.useRouteContext();
	return (
		<div className="space-y-10">
			<ContentStudio />
			{session.data?.user.role === "admin" ? <CourseCurriculumManager /> : null}
		</div>
	);
}
