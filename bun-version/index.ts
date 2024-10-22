// import OpenAI from "openai";
// const openai = new OpenAI({
//   apiKey:
//     process.env.OPENAI_API_KEY,

import Anthropic from "@anthropic-ai/sdk";

// });
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
const promptFile = Bun.file(
  "/home/frixaco/.githooks/commit-message-prompt.txt",
);
const prompt = await promptFile.text();

const diffFile = Bun.file(
  "/home/frixaco/personal/whatmedoin/apps/llm-commit/mydiff.txt",
);
const diff = await diffFile.text();

// const completion = await anthropic.completions.create({
//   model: "gpt-4o",
//   messages: [
//     { role: "system", content: prompt },
//     { role: "user", content: diff },
//   ],
// });
const response = await anthropic.messages.create({
  model: "claude-3-5-sonnet-20240620",
  max_tokens: 30,
  system: prompt,
  messages: [{ role: "user", content: diff }],
});

console.log(response.content[0]);
