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
    // temperature: 0,
    model: openrouter.chat("google/gemini-2.5-flash-preview"),
    toolChoice: "none",
    // model: openrouter.chat("anthropic/claude-3.5-sonnet"),
    system: `You are a coding assistant.

**Protocol for requests that ask for code changes**

1. When updating a file only return the changed part of the file and the original part in following format:
  <SEARCH>
  {content from original file that needs to change}
  </SEARCH>
  <REPLACE>
  {updated content}
  </REPLACE>
`,
    prompt: `add console.log hello world at the end of the "index.ts":\n\n\`\`\`js\n${file}\n\`\`\``,
    tools: {
      updateFile: tool({
        description: "Apple changes to a file",
        parameters: z.object({
          path: z
            .string()
            .describe("Path of the file relative to current directory"),
          oldContent: z
            .string()
            .describe("Full original contents of the file before any changes"),
          newContent: z
            .string()
            .describe("Full updated contents of the file after the changes"),
        }),
        execute: async ({ path, oldContent, newContent }) => {
          await fs.writeFile(path, newContent, "utf8");
          return "Successfully replaced file with updated content";
        },
      }),
    },
    onChunk: ({ chunk }) => {
      switch (chunk.type) {
        case "tool-call-streaming-start":
          console.log("\n");
          spinner = ora(`Calling ${chunk.toolName}`).start();
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

