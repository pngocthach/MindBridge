import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import z from "zod";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export const loginSearchSchema = z.object({
	mode: z.enum(["sign-in", "sign-up"]).catch("sign-up"),
});

export const Route = createFileRoute("/login")({
	component: RouteComponent,
	validateSearch: loginSearchSchema,
});

function RouteComponent() {
	const { mode } = Route.useSearch();
	const [showSignIn, setShowSignIn] = useState(() => mode === "sign-in");

	return showSignIn ? (
		<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
	) : (
		<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
	);
}
