## TODO

- [ ] `/diff` command that launches side-by-side diff of the latest prompt response

- [ ] `llm models` lists `claude 3.5 sonnet`, `gpt-4o`, `llama3-8b-8192` (by Groq) and allows picking default model
- [ ] `llm keys <openai, anthropic, groq> <key>` updates API key if `<key>` provided, otherwise print out its value
- [ ] `llm "<prompt>"` runs `<prompt>` and return the response
- [ ] `llm -s <system prompt> "<prompt>"` sets system prompt - `<system prompt>`, then runs the `<prompt>`
- [ ] `llm commit -p <prompt>` uses `<prompt>` as instruction to how to formulate commit message, then runs `git commit` with the commit message generated
