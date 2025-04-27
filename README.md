## My personal AI assistant in my terminal

Basically, worse version of "Claude Code", "Codex", "OpenCode" but it is mine!

### TODO

- [ ] Implement basic "agentic loop" using Vercel AI SDK with file system tool
- [ ] Create reliable systems prompt, setup other important tools
- [ ] Interactivity CLI

### Demo

https://github.com/user-attachments/assets/2e495400-4b43-41ce-8af8-ef19aa2ce661

### Brainstorming

**Saving tokens**:

- Have "Plan" mode like Cline, where files have comments and blank lines stripped
  - Stripping comments and blank lines doesn't seem effective most of the time and saves only few tokens
- Reasons from putting whole file contents:
  - Edit diffs - IMPORTANT, REQUIRED
  - Follow style - What if I analyze codebase and generate bunch of rules instead,
    then I extract only relevant nodes from AST for the code that needs modifying and send those blocks to LLM
  - On the other hand, relying AST doesn't seem useful when LLM needs to add a new node unrelated to the relevant nodes (e.g. create a constant at the top of the file)
