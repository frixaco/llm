import fs from "fs/promises";
import { streamText, tool, type CoreMessage } from "ai";
import { z } from "zod";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createInterface } from "node:readline/promises";
import os from "os";
import chalk from "chalk";

// TODO: FORCE USE TOOLS VIA @EDIT/UPDATE FILE instead of this
const getSystemPrompt =
  () => `You are extremely smart coding assistant with extensive knowledge in many programming languages, frameworks, design patterns and best practices.

1. Always reply in two phases:
  • Phase 1 – Plan: start with the heading ## Plan and lay out a concise (≤ 5 bullets, ≤ 50 words total) action plan for solving the user's request.
  • Phase 2 – Execution: carry out the plan.
2. When a file must be created or modified, call either editFile or writeFile tool instead of sending text.
  • The tool call's path must be correct and relative as the user expects.
  • Include only the minimal diff necessary; do not echo unchanged lines for editFile tool
3. Whitespace discipline is absolute:
  • Preserve every space, tab, newline, and blank line exactly as shown in the user's code or your output.
  • Never collapse multiple spaces, never auto-format, never add trailing spaces.
  • Enclose all code blocks in triple backticks with the correct language tag.
4. When no tool call is required, answer normally in Phase 2.
5. If any instruction here conflicts with a future user message, ask for clarification—do not guess.
6. To get contents of a file given the file name, use readFile tool

You have following tools at your disposal:
1. "editFile" - Applies a single edit to a file.
2. "writeFile" - Replaces or creates a file with given content.
3. "readFile" - Reads the full file and returns its content.
`;

const readFile = tool({
  description: "Return full text of a file",
  parameters: z.object({
    path: z.string().describe("Path of the file relative to current directory"),
  }),
  execute: async ({ path }) => {
    const fileContent = await fs.readFile(path, "utf8");
    return {
      status: "success",
      message: fileContent,
    };
  },
});

const writeFile = tool({
  description: "Create or replace file content",
  parameters: z.object({
    path: z.string().describe("Path of the file relative to current directory"),
    newContent: z.string().describe("Full updated content of the file"),
  }),
  execute: async ({ path, newContent }) => {
    await fs.writeFile(path, newContent, "utf8");
    return {
      status: "success",
      message: "Successfully replaced file with updated content",
    };
  },
});

const editFile = tool({
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

    const original = await fs.readFile(path, "utf8"); //  ← change #1

    const matches = [
      ...original.matchAll(new RegExp(escapeRegExp(searchContent), "g")),
    ];
    if (matches.length === 0) {
      throw new Error(`editFile: \`searchContent\` not found in “${path}”.`);
    }
    if (matches.length > 1) {
      throw new Error(
        `editFile: \`searchContent\` occurs ${matches.length} times in “${path}” – it must be unique.`,
      );
    }

    const updated = original.replace(searchContent, replaceContent);
    await fs.writeFile(path, updated, "utf8");

    return {
      status: "success",
      message: "Successfully applied the edit",
    };
  },
});

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

async function runAgent(messages: CoreMessage[]): Promise<CoreMessage[]> {
  const result = streamText({
    toolCallStreaming: true,
    maxSteps: 25,
    temperature: 0,
    model: openrouter.chat("qwen/qwen3-235b-a22b"),
    // model: openrouter.chat("google/gemini-2.5-flash-preview"),
    // model: openrouter.chat("openai/gpt-4o-2024-11-20"),
    // model: openrouter.chat("openai/gpt-4.1-mini"),
    // model: openrouter.chat("google/gemini-2.5-pro-preview-03-25"),
    // model: openrouter.chat("anthropic/claude-3.7-sonnet"),
    toolChoice: "auto",
    messages,
    tools: {
      readFile,
      writeFile,
      editFile,
    },
    onChunk: ({ chunk }) => {
      switch (chunk.type) {
        case "text-delta":
          process.stdout.write(chalk.green(chunk.textDelta));
          break;

        case "tool-call":
          break;

        case "tool-call-streaming-start":
          console.log(`\n- Calling ${chunk.toolName} tool...`);
          break;

        case "tool-call-delta":
          process.stdout.moveCursor(0, -1);
          process.stdout.clearLine(1);
          process.stdout.cursorTo(0);
          process.stdout.write(
            chalk.greenBright(`- ${chunk.toolName} tool is running...\n`),
          );
          break;

        case "tool-result":
          let message = `- ${chunk.toolName} tool finished running\n`;
          if (chunk.result.status !== "success") {
            message = `- ${chunk.toolName} tool failed to complete\n`;
          }

          process.stdout.moveCursor(0, -1);
          process.stdout.clearLine(1);
          process.stdout.cursorTo(0);
          process.stdout.write(chalk.greenBright(message));

          break;
      }
    },
    onError: ({ error }) => {
      console.log(error);
    },
    onFinish: async ({ response }) => {
      const resultMessages = response.messages;
      messages.push(...resultMessages);
      console.log();
    },
  });

  await result.consumeStream();

  return messages;
}

const lineReader = createInterface({
  input: process.stdin,
  output: process.stdout,
});

process.stdin.setRawMode(true);

lineReader.on("SIGINT", () => {
  console.log(chalk.yellow("\nAlways ready to eat your tokens!"));
  lineReader.close();
  process.exit(0);
});

async function main() {
  const username = os.userInfo().username;
  console.log(chalk.green.bold(`Ready to help, ${username}!`));

  let messages: CoreMessage[] = [
    { role: "system", content: getSystemPrompt() },
  ];

  while (true) {
    const prompt = (await lineReader.question(chalk.blue("> "))).trim();
    if (
      ["quit", "exit", "end", "/quit", "/exit"].includes(prompt.toLowerCase())
    ) {
      break;
    }

    if (!prompt) {
      continue;
    }

    process.stdin.pause();

    try {
      messages.push({
        role: "user",
        content: prompt,
      });

      messages = await runAgent(messages);
    } catch (error) {
      console.log(chalk.red(error));

      messages = [{ role: "system", content: getSystemPrompt() }];

      console.log("Resetting conversation");
    } finally {
      process.stdin.resume();
    }
  }

  lineReader.close();
  process.exit(0);
}

await main();
