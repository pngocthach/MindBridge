import { readFile, writeFile } from "node:fs/promises";

const generatedFiles = [
  "baml_client/async_request.ts",
  "baml_client/sync_request.ts",
];

const incorrectImport =
  'import { toBamlError, HTTPRequest, ClientRegistry } from "@boundaryml/baml"';
const correctedImport = `import { toBamlError, ClientRegistry } from "@boundaryml/baml"
import type { HTTPRequest } from "@boundaryml/baml"`;

for (const file of generatedFiles) {
  const content = await readFile(file, "utf8");

  if (!content.includes(incorrectImport)) {
    continue;
  }

  await writeFile(file, content.replace(incorrectImport, correctedImport));
}
