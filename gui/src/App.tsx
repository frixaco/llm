import { createEffect, createSignal, For, onMount } from "solid-js";
import "./App.css";

import { readTextFile, readDir, BaseDirectory } from "@tauri-apps/plugin-fs";
import { CodeBlock } from "./components/codeblock";
import { exit } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";

// const file = "D:/dev/llm/cli-go/cli.go";

function App() {
  // const [projectDir, setProjectDir] = createSignal<string | null>(null);
  const [history, updateHistory] = createSignal<string[]>([]);
  const [code, setCode] = createSignal("");
  const [prompt, setPrompt] = createSignal("");
  const [generating, setGenerating] = createSignal(false);

  // const onClick = async () => {
  //   const cwd: string = await invoke("get_project_dir", {});
  //   console.log("projectDir", cwd);
  //   setProjectDir(cwd);
  //   const content = await readTextFile(cwd + "/cli-go/main.go");
  //   setCode(content);
  // };

  let promptInputRef!: HTMLTextAreaElement;

  onMount(() => {
    if (promptInputRef.hasAttribute("autofocus"))
      setTimeout(() => promptInputRef.focus());
  });

  createEffect(() => {
    const evl = async (e: KeyboardEvent) => {
      if (
        e.key === "c" &&
        e.ctrlKey &&
        // @ts-ignore
        e.target!.tagName === "BODY" &&
        !generating()
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
    <main class="flex flex-col h-full p-2">
      <div data-tauri-drag-region class="h-7 select-none fixed top-0 w-full" />

      <div class="h-6"></div>

      <div class="flex-1">
        <For each={history()} fallback={<div>No items...</div>}>
          {(item, index) => (
            <div data-index={index()} class="border border-surface-0">
              <p class="text-text">{item}</p>
              {/* <CodeBlock code={code()} /> */}
            </div>
          )}
        </For>
      </div>

      <textarea
        onKeyPress={async (e) => {
          if (e.key === "Enter" && e.metaKey && prompt().trim() !== "") {
            setGenerating(true);
            const response: string = await invoke("call_llm", {
              prompt: prompt(),
            });

            setPrompt("");
            updateHistory((p) => [...p, response]);
            setGenerating(false);
          }
        }}
        ref={promptInputRef}
        value={prompt()}
        class="resize-y min-h-[2.125rem] h-[2.125rem] max-h-24 w-full border border-surface-2 px-2 py-1 outline-none text-subtext-0"
        onInput={(e) => setPrompt(e.currentTarget.value)}
      />
    </main>
  );
}

export default App;
