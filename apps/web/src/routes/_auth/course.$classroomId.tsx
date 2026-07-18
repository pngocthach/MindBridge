import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { CoursePlayer } from "@/components/course-player";

type CourseSearch = {
	contentId?: string;
};

export const Route = createFileRoute("/_auth/course/$classroomId")({
	component: CourseDetailPage,
	validateSearch: (search: Record<string, unknown>): CourseSearch => ({
		contentId:
			typeof search.contentId === "string" ? search.contentId : undefined,
	}),
});

function CourseDetailPage() {
	const { classroomId } = Route.useParams();
	const { contentId } = Route.useSearch();

	return (
		<section className="space-y-4">
			<Link
				className="inline-flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
				to="/dashboard"
			>
				<ArrowLeft aria-hidden="true" className="size-4" />
				Về danh sách khóa học
			</Link>
			<CoursePlayer classroomId={classroomId} initialContentId={contentId} />
		</section>
	);
}
