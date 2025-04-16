import { createEffect, createSignal } from "solid-js";
import "./App.css";

import { readTextFile } from "@tauri-apps/plugin-fs";
import { CodeBlock } from "./components/codeblock";
import { exit } from '@tauri-apps/plugin-process';

const file = "D:/dev/llm/cli-go/cli.go"


function App() {
  const [code, setCode] = createSignal("");
  const [prompt, setPrompt] = createSignal("")

  const onClick = async () => {
    console.log("onClick")
    const content = await readTextFile(file)
    setCode(content)
  }

  createEffect(() => {
    const evl = async (e: KeyboardEvent) => {
      if (e.key === "Q" && e.shiftKey === true && e.target!.tagName === "BODY") {
        await exit(1)
      }
    }

    document.addEventListener("keypress", evl)

    return () => {
      document.removeEventListener("keypress", evl)
    }
  })

  return (
    <main class="container">
      <button onClick={onClick}>READ FILE</button>
      <CodeBlock code={code()} />

      <input onInput={(e) => setPrompt(e.currentTarget.value)} />


      <p>{prompt()}</p>
    </main>
  );
}

export default App;
