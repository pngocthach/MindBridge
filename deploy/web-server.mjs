import { serve } from "srvx";
import { serveStatic } from "srvx/static";
import app from "./dist/server/server.js";

const port = Number(process.env.PORT ?? 3001);

const server = serve({
	hostname: "0.0.0.0",
	middleware: [serveStatic({ dir: "./dist/client" })],
	port,
	fetch: app.fetch,
});

await server.ready();
console.log(`Web server listening at ${server.url}`);
