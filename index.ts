import fs from "fs/promises";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { type GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { generateText, tool } from "ai";
import { z } from "zod";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const file = await fs.readFile(__filename, "utf8");

const res = await generateText({
  model: google("gemini-2.5-flash-preview-04-17"),
  providerOptions: {
    google: {
      thinkingConfig: {
        thinkingBudget: 0,
      },
    } satisfies GoogleGenerativeAIProviderOptions,
  },
  prompt: `add console.log hello world at the end of the \`index.ts\`:\n\`\`\`js\n${file}\`\`\``,
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
          .describe("Fully updated contents of the file after the changes"),
      }),
      execute: async ({ path, oldContent, newContent }) => {
        await fs.writeFile(path, newContent, "utf8");
      },
    }),
  },
});

console.log("Response:", JSON.stringify(res, null, 2));

console.log("hello world");

