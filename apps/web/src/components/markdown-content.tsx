import { cn } from "@MindBridge/ui/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownContentProps = {
	className?: string;
	content: string;
};

export default function MarkdownContent({
	className,
	content,
}: MarkdownContentProps) {
	return (
		<article className={cn("mx-auto max-w-3xl text-foreground", className)}>
			<ReactMarkdown
				components={{
					a: ({ children, href }) => (
						<a
							className="font-medium text-primary underline underline-offset-4"
							href={href}
							rel="noopener noreferrer"
							target="_blank"
						>
							{children}
						</a>
					),
					blockquote: ({ children }) => (
						<blockquote className="my-5 border-primary border-l-4 bg-primary/5 px-5 py-3 text-muted-foreground italic">
							{children}
						</blockquote>
					),
					code: ({ children }) => (
						<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
							{children}
						</code>
					),
					h1: ({ children }) => (
						<h1 className="mt-8 mb-4 font-bold text-3xl tracking-tight">
							{children}
						</h1>
					),
					h2: ({ children }) => (
						<h2 className="mt-8 mb-3 border-b pb-2 font-semibold text-2xl tracking-tight">
							{children}
						</h2>
					),
					h3: ({ children }) => (
						<h3 className="mt-6 mb-2 font-semibold text-xl">{children}</h3>
					),
					hr: () => <hr className="my-8 border-border" />,
					li: ({ children }) => <li className="pl-1">{children}</li>,
					ol: ({ children }) => (
						<ol className="my-4 list-decimal space-y-2 pl-6 leading-7">
							{children}
						</ol>
					),
					p: ({ children }) => (
						<p className="my-4 text-[15px] leading-8">{children}</p>
					),
					pre: ({ children }) => (
						<pre className="my-5 overflow-x-auto rounded-lg bg-slate-950 p-4 text-slate-50 text-sm">
							{children}
						</pre>
					),
					table: ({ children }) => (
						<div className="my-5 overflow-x-auto">
							<table className="w-full border-collapse text-sm">
								{children}
							</table>
						</div>
					),
					td: ({ children }) => (
						<td className="border px-3 py-2 align-top">{children}</td>
					),
					th: ({ children }) => (
						<th className="border bg-muted px-3 py-2 text-left font-semibold">
							{children}
						</th>
					),
					ul: ({ children }) => (
						<ul className="my-4 list-disc space-y-2 pl-6 leading-7">
							{children}
						</ul>
					),
				}}
				remarkPlugins={[remarkGfm]}
			>
				{content}
			</ReactMarkdown>
		</article>
	);
}
