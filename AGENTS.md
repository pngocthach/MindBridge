# AI Response Guidelines

- The project is being built for a 48-hour hackathon: prioritize speed, practicality, and working results.

- Keep responses very concise and limited to what the user asks.
- Give direct, clear answers; avoid unnecessary introductions, repetition, and lengthy explanations.
- Add details, examples, or explanations only when needed to answer completely.
- If the request is ambiguous, ask one brief clarifying question.
- For coding tasks, state the result, changed files, and checks run (if any).


# MindBridge Project Guide

## Architecture

```text
apps/
├── web/                 TanStack Start UI
│   └── src/
│       ├── routes/      File-based pages; do not edit routeTree.gen.ts
│       ├── components/  Web-only components
│       └── utils/orpc.ts oRPC client
└── server/              Node + Hono HTTP server
    └── src/index.ts     CORS, Better Auth, oRPC and OpenAPI mounts

packages/
├── api/                 oRPC context, procedures and router
├── auth/                Better Auth configuration
├── db/                  Drizzle client and schema
├── env/                 Typed server/browser environment variables
├── ui/                  Shared shadcn/Tailwind UI components and styles
└── config/              Shared TypeScript configuration
```

`apps/server` is the HTTP boundary. Add business endpoints to `packages/api`, not directly to the Hono entrypoint. Web pages call typed oRPC procedures through `apps/web/src/utils/orpc.ts`; they do not call the database or server with ad-hoc `fetch` requests.

## Add a Backend Feature

Follow this order:

1. Add or change the domain table in `packages/db/src/schema/`. Export it from `packages/db/src/schema/index.ts`.
2. Apply the local schema with `pnpm db:push`, or generate/review a migration with `pnpm db:generate` then `pnpm db:migrate`.
3. Add a typed procedure to a domain router in `packages/api/src/routers/`. Use `publicProcedure` for public data and `protectedProcedure` for user-scoped data.
4. Compose the domain router into `appRouter` in `packages/api/src/routers/index.ts`. The existing Hono server automatically exposes it under `/rpc`.
5. Consume its generated query/mutation options from `orpc` in the web app.

Keep validation at the procedure boundary. Derive authorization from the oRPC context/session, never from a client-provided user ID. Add an environment variable to `packages/env/src/server.ts` or `packages/env/src/web.ts` before reading it at runtime.

## Add UI

- Add a route in `apps/web/src/routes/`; TanStack Start generates `routeTree.gen.ts`, so never edit that file.
- Put a page-specific component in `apps/web/src/components/`.
- Put a reusable, application-agnostic component in `packages/ui/src/components/`, then import it as `@MindBridge/ui/components/<name>`.
- Add global tokens/styles only in `packages/ui/src/styles/globals.css`; `apps/web/src/index.css` imports this file.
- Keep data access in the route/component through the oRPC client. Show loading, empty and error states for any asynchronous view.

## Commands

```bash
pnpm dev                 # Run web and Hono through Turborepo
pnpm dev:web             # Run only TanStack Start
pnpm dev:server          # Run only Hono
pnpm build               # Build all task packages through Turborepo
pnpm check-types         # Type-check task packages through Turborepo
pnpm check               # Run Ultracite lint/format checks
pnpm fix                 # Apply Ultracite safe fixes
pnpm db:push             # Push Drizzle schema to the configured database
pnpm db:generate         # Generate a migration
pnpm db:migrate          # Apply migrations
```

Do not commit `.env` files or generated build output.

## GitHub Project Workflow

The active backlog is GitHub Project **MindBridge** (`#5`) in `pngocthach/MindBridge` (https://github.com/users/pngocthach/projects/5). Every feature and technical task must have an issue, an estimate, hackathon priority, area, and technical labels.

```bash
# List the whole backlog: status, estimate, title
gh project item-list 5 --owner pngocthach --limit 100 --format json \
  --jq '.items[] | [.status, .estimate, .title] | @tsv'

# List only work in progress
gh project item-list 5 --owner pngocthach --limit 100 --format json \
  --jq '.items[] | select(.status == "Doing") | [.estimate, .title] | @tsv'

# Read the requirements and acceptance criteria for one task
gh issue view <issue-number> --repo pngocthach/MindBridge
```

Work tasks in this order:

1. Read `Doing` first, then choose the highest-priority unblocked `Todo`.
2. Read its issue and implement every acceptance criterion.
3. Verify the changed behavior using the task-appropriate test or smoke flow.
4. Open a pull request, merge it after verification, then move the Project item to `Done`; `Closes #<issue-number>` in the PR body closes the issue on merge.

Use GitHub CLI to move a task between Project statuses:

```bash
ITEM_ID=$(gh project item-list 5 --owner pngocthach --limit 100 --format json \
  --jq '.items[] | select(.content.number == <issue-number>) | .id')

# Replace <status-option-id> with: Todo=f75ad846, Doing=47fc9ee4, Done=98236657
gh project item-edit --id "$ITEM_ID" \
  --project-id PVT_kwHOBXB6ss4Bdlyp \
  --field-id PVTSSF_lAHOBXB6ss4BdlypzhYGRC4 \
  --single-select-option-id <status-option-id>
```

Do not mark a task `Done` or close its issue before its acceptance criteria and verification are complete.

### Git Branches, Commits, and Pull Requests

Use one branch and one pull request per issue. Start every task from the latest `main`:

```bash
git switch main
git pull --ff-only origin main
git switch -c <type>/<issue-number>-<short-slug>
```

- Never commit, push, or merge before the user has reviewed the changes and explicitly approved it in this conversation.

- Name branches `feat/`, `fix/`, or `chore/`; for example, `feat/11-auth-rbac`.
- Keep each branch limited to its issue; do not mix unrelated refactors or tasks.
- Use focused Conventional Commits in English, for example: `feat(auth): add role-based sign-in (#11)`.
- Run `pnpm fix`, `pnpm check`, and `pnpm check-types` before pushing.
- Create each PR against `main` and include `Closes #<issue-number>` in its body. GitHub automatically closes that issue when the PR merges into the default branch.
- Do not move a Project item to `Done` until its PR is merged.

```bash
git push -u origin feat/11-auth-rbac
gh pr create \
  --base main \
  --title "feat(auth): add role-based sign-in" \
  --body $'## Summary\n- Add role-based sign-in.\n\nCloses #11'
```

# Linting and Pre-commit Checks

This project uses Ultracite with a lightweight project-level Biome configuration: formatting, import organization and Biome's recommended correctness rules. Static prototypes in `docs/mock-ui/` and TanStack's generated `routeTree.gen.ts` are excluded because they are reference/generated artifacts, not maintained application code.

Before every commit, run these commands in order:

```bash
pnpm fix
pnpm check
pnpm check-types
```

`pnpm fix` applies safe formatting and import fixes. `pnpm check` and `pnpm check-types` must pass before committing.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Research and Documentation

- When a tool or MCP such as Context7 cannot provide the needed documentation, use web search before proceeding.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**
- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**
- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**
- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `pnpm fix`, then make `pnpm check` and `pnpm check-types` pass before committing.
