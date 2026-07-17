import type {
	CourseCatalogPort,
	CourseOption,
	CourseSearchInput,
} from "@MindBridge/api";
import { course, db } from "@MindBridge/db";
import { and, asc, eq, ilike } from "drizzle-orm";

const MAX_COURSE_RESULTS = 20;

export class CourseCatalogService implements CourseCatalogPort {
	async search({
		canReadAllCourses,
		query,
		requestedBy,
	}: CourseSearchInput): Promise<CourseOption[]> {
		const normalizedQuery = query.trim();
		return db
			.select({
				gradeLevel: course.gradeLevel,
				id: course.id,
				title: course.title,
			})
			.from(course)
			.where(
				and(
					canReadAllCourses ? undefined : eq(course.createdBy, requestedBy),
					normalizedQuery
						? ilike(course.title, `%${normalizedQuery}%`)
						: undefined,
				),
			)
			.orderBy(asc(course.title))
			.limit(MAX_COURSE_RESULTS);
	}
}
