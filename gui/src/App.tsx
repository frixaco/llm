import { createEffect, createSignal } from "solid-js";
import "./App.css";

import { readTextFile, readDir, BaseDirectory } from "@tauri-apps/plugin-fs";
import { CodeBlock } from "./components/codeblock";
import { exit } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";

// const file = "D:/dev/llm/cli-go/cli.go";

function App() {
  const [projectDir, setProjectDir] = createSignal<string | null>(null);
  const [code, setCode] = createSignal("");
  const [prompt, setPrompt] = createSignal("");

  const onClick = async () => {
    const cwd: string = await invoke("get_project_dir", {});
    console.log("projectDir", cwd);
    setProjectDir(cwd);
    const content = await readTextFile(cwd + "/cli-go/main.go");
    setCode(content);
  };

  createEffect(() => {
    const evl = async (e: KeyboardEvent) => {
      if (
        e.key === "Q" &&
        e.shiftKey === true &&
        e.target!.tagName === "BODY"
      ) {
        await exit(1);
      }
    };

    document.addEventListener("keypress", evl);

    return () => {
      document.removeEventListener("keypress", evl);
    };
  });

  return (
    <main class="container">
      <button onClick={onClick}>Get cwd and read a file</button>
      <CodeBlock code={code()} />

      <input onInput={(e) => setPrompt(e.currentTarget.value)} />

      <p>{prompt()}</p>
    </main>
  );
}

export default App;
