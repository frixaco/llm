import ora, { type Ora } from "ora";
import fs from "fs/promises";
import {
  createGoogleGenerativeAI,
  type GoogleGenerativeAIProviderOptions,
} from "@ai-sdk/google";
import { streamText, tool } from "ai";
import { z } from "zod";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

async function main() {
  let spinner: Ora | null = null;

  // const google = createGoogleGenerativeAI({
  //   apiKey: process.env.GEMINI_API_KEY,
  // });

  const file = await fs.readFile(__filename, "utf8");

  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const result = streamText({
    toolCallStreaming: true,
    temperature: 0,
    // model: openrouter.chat("google/gemini-2.5-flash-preview"),
    // model: openrouter.chat("openai/gpt-4o-2024-11-20"),
    // model: openrouter.chat("openai/gpt-4.1-mini"),
    // model: openrouter.chat("google/gemini-2.5-pro-preview-03-25"),
    model: openrouter.chat("anthropic/claude-3.7-sonnet"),
    toolChoice: "auto",
    system: `You are "Rigorous Dev Assistant." Follow every rule exactly in the order given.
1. Always reply in two phases:
  • Phase 1 – Plan: start with the heading ## Plan and lay out a concise (≤ 5 bullets, ≤ 50 words total) action plan for solving the user's request.
  • Phase 2 – Execution: carry out the plan.
2. When a file must be created or modified, call the updateFile tool instead of sending text.
  • The tool call's path must be correct and absolute/relative as the user expects.
  • Include only the minimal diff necessary; do not echo unchanged lines.
3. Whitespace discipline is absolute:
  • Preserve every space, tab, newline, and blank line exactly as shown in the user's code or your output.
  • Never collapse multiple spaces, never auto-format, never add trailing spaces.
  • Enclose all code blocks in triple backticks with the correct language tag.
4. When no tool call is required, answer normally in Phase 2.
5. If any instruction here conflicts with a future user message, ask for clarification—do not guess.
`,
    prompt: `log "hello world" at the end of the "index.ts":\n\n\`\`\`js\n${file}\`\`\``,
    tools: {
      replaceFile: tool({
        description: "Replace file content fully",
        parameters: z.object({
          path: z
            .string()
            .describe("Path of the file relative to current directory"),
          oldContent: z.string().describe("Full original content of the file"),
          newContent: z.string().describe("Full updated content of the file"),
        }),
        execute: async ({ path, newContent }) => {
          await fs.writeFile(path, newContent, "utf8");
          return "Successfully replaced file with updated content";
        },
      }),
      editFile: tool({
        description: "Apply edits to a file",
        parameters: z.object({
          path: z
            .string()
            .describe(
              "File path **relative to the current working directory** (e.g. './src/index.ts'). " +
                "Assumes the directory already exists.",
            ),

          searchContent: z
            .string()
            .describe(
              "The **shortest snippet that is guaranteed to be unique** inside the file. " +
                "If a line appears more than once, include a few context lines before/after so the full string occurs only once. Otherwise tool will fail.",
            ),

          replaceContent: z
            .string()
            .describe(
              "Text that will **replace the first (and only) occurrence** of `searchContent`.",
            ),
        }),
        execute: async ({ path, searchContent, replaceContent }) => {
          function escapeRegExp(str: string) {
            return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          }

          const original = file;
          const matches = [
            ...original.matchAll(new RegExp(escapeRegExp(searchContent), "g")),
          ];
          if (matches.length === 0) {
            throw new Error(
              `editFile: \`searchContent\` not found in “${path}”.`,
            );
          }
          if (matches.length > 1) {
            throw new Error(
              `editFile: \`searchContent\` occurs ${matches.length} times in “${path}” – it must be unique.`,
            );
          }

          const updated = original.replace(searchContent, replaceContent);
          await fs.writeFile(path, updated, "utf8");

          return "Successfully applied the edit";
        },
      }),
    },
    onChunk: ({ chunk }) => {
      switch (chunk.type) {
        case "tool-call":
          console.log("Tool params", JSON.stringify(chunk.args, null, 2));
          break;

        case "tool-call-streaming-start":
          spinner = ora(`\nCalling ${chunk.toolName}`).start();
          break;

        case "tool-call-delta":
          if (spinner) spinner.text = `Tool running: ${chunk.toolName}`;
          break;

        case "tool-result":
          if (spinner)
            spinner.succeed(
              `${chunk.toolName} result: ${JSON.stringify(chunk.result, null, 2)}`,
            );
          break;
      }
    },
    onError: ({ error }) => {
      console.log(error);
    },
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
}

await main();
