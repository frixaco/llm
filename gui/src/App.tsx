import { createEffect, createSignal, For, onMount, Show } from "solid-js";
import "./App.css";

import { exit } from "@tauri-apps/plugin-process";
import { Channel, invoke } from "@tauri-apps/api/core";
import { Loader } from "./components/spinner";
// import markdownit from 'markdown-it'
import { marked } from "marked";

type StreamEvent =
  | {
      event: "started";
      data: {
        prompt: string;
      };
    }
  | {
      event: "delta";
      data: {
        content: string;
      };
    }
  | {
      event: "finished";
      data: {
        full_response: string | null;
      };
    };

function App() {
  // const [projectDir, setProjectDir] = createSignal<string | null>(null);
  const [history, updateHistory] = createSignal<string[]>([]);
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

  const onSend = async (e: KeyboardEvent) => {
    console.log(prompt());
    if (e.key === "Enter" && e.metaKey && prompt().trim() !== "") {
      const userPrompt = prompt();
      updateHistory((p) => [...p, userPrompt]);
      setGenerating(true);
      setPrompt("");

      const onEvent = new Channel<StreamEvent>();
      onEvent.onmessage = async (message) => {
        const h = history();
        const l = h.pop();

        if (message.event === "started") {
          updateHistory((p) => [...p, ""]);
        }
        if (message.event === "delta") {
          updateHistory((p) => [...p, l + message.data.content]);
        }
        if (message.event === "finished") {
          console.log("finished", l);
          const markdownResponse = await marked.parse(l!);
          updateHistory((p) => [...p, markdownResponse]);
        }
      };
      await invoke("call_llm", {
        prompt: userPrompt,
        onEvent: onEvent,
      });

      setGenerating(false);
    }

    // if (e.key === "Enter" && e.ctrlKey && prompt().trim() !== "") {
    //   const userPrompt = prompt();
    //   updateHistory((p) => [...p, userPrompt]);
    //   setGenerating(true);
    //   setPrompt("");
    //
    //   const response = await invoke("call_llm", {
    //     prompt: userPrompt,
    //   });
    //   let msg = "";
    //
    //   const markdownResponse = await marked.parse(response);
    //
    //   updateHistory((p) => [...p, markdownResponse]);
    //   setGenerating(false);
    // }
  };

  // TODO: maybe clipboard should appear in floating box above textarea?

  return (
    <main class="flex flex-col h-full p-2 gap-1">
      <div data-tauri-drag-region class="h-7 select-none" />

      <div class="flex-1 text-ctp-pink overflow-auto text-text">
        <For
          each={history()}
          fallback={<div class="text-subtext-0 text-xl">LET'S START</div>}
        >
          {(item, index) => (
            <div
              data-index={index()}
              class="border rounded border-ctp-surface0 px-2 py-1"
            >
              <div
                class="prose !max-w-none prose-headings:text-ctp-pink prose-strong:text-ctp-mauve prose-em:text-ctp-maroon prose-a:text-ctp-blue hover:prose-a:text-ctp-teal prose-code:text-ctp-peach prose-pre:bg-ctp-surface0 prose-pre:text-ctp-text prose-p:text-ctp-subtext1 prose-ul:text-ctp-subtext0"
                innerHTML={item}
              ></div>
              {/* <CodeBlock code={code()} /> */}
            </div>
          )}
        </For>

        <Show when={generating()}>
          <Loader width={30} height={25} />
        </Show>
      </div>

      <textarea
        onKeyDown={onSend}
        ref={promptInputRef}
        value={prompt()}
        class="bg-ctp-base text-ctp-pink border rounded border-ctp-surface0 focus:border-ctp-surface2 h-24 w-full px-2 py-1 outline-none"
        onInput={(e) => setPrompt(e.currentTarget.value)}
      />
    </main>
  );
}

export default App;
