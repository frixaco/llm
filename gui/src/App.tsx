import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import "./App.css";

import { exit } from "@tauri-apps/plugin-process";
import { Channel, invoke } from "@tauri-apps/api/core";
// import { Loader } from "./components/spinner";
// import markdownit from 'markdown-it'
import { marked } from "marked";
import BlinkingCursor from "./components/blinking-cursor";

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
        content: string | null;
        tool_calls: string[];
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
  const [fileDirPicker, setFileDirPicker] = createSignal(false);
  const [fileDirResults, setFileDirResults] = createSignal<string[]>([]);
  const [searchPath, setSearchPath] = createSignal("");

  let timeout: ReturnType<typeof setTimeout>;

  createEffect(() => {
    if (fileDirPicker()) {
      const input = prompt();

      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const idx = input.lastIndexOf("@");
        let nsp = "";
        if (idx !== -1) {
          nsp = input.slice(idx + 1);
        } else {
          // TODO:
        }
        setSearchPath(nsp);
      }, 300);
    }

    onCleanup(() => clearTimeout(timeout));
  });

  createEffect(async () => {
    const sp = searchPath();

    const rs = await invoke<string[]>("fuzzy_search", {
      searchTerm: sp,
    });
    setFileDirResults(rs);
  });

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

  const onShortcut = async (e: KeyboardEvent) => {
    if (e.key == "Backspace") {
      const prevValue = (e.currentTarget as HTMLInputElement).value;
      if (prevValue[prevValue.length - 1] === "@") {
        setFileDirPicker(false);
      }
    }

    if (e.key === "@" && !fileDirPicker()) {
      setFileDirPicker(true);

      const initialResults = await invoke<string[]>("fuzzy_search", {
        searchTerm: ".",
      });
      setFileDirResults(initialResults);
    }

    if (e.key === "Space" && fileDirPicker()) {
      setFileDirPicker(false);
    }

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
          if (!message.data.content) {
            console.log(message.data.tool_calls);
            updateHistory((p) => [
              ...p,
              l + JSON.stringify(message.data.tool_calls),
            ]);
          } else {
            updateHistory((p) => [...p, l + message.data.content!]);
          }
        }
        if (message.event === "finished") {
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
    <main class="flex flex-col h-full font-mono">
      <div
        data-tauri-drag-region
        class="h-7 w-full px-2 cursor-pointer py-1 select-none border-b border-b-ctp-mauve flex items-center justify-between"
      >
        <p class="text-sm font-mono font-semibold tracking-wider">
          <Show when={history().length !== 0}>
            <span class="text-ctp-pink">a</span>
            <span class="text-ctp-green">i</span>
            <span class="text-ctp-yellow">t</span>
            <span class="text-ctp-red">e</span>
            <span class="text-ctp-sky">t</span>
            <span class="text-ctp-blue">s</span>
            <span class="text-ctp-peach">u</span>
          </Show>
        </p>

        <div class="flex gap-3 text-xs font-mono font-sm">
          <span class="text-ctp-text">1000 / 200,000</span>
          <span class="text-ctp-mauve">|</span>
          <span class="text-ctp-maroon">$ 0.23</span>
        </div>
      </div>

      <div class="flex flex-col gap-2 flex-1 overflow-y-auto p-2 text-ctp-pink">
        <For
          each={history()}
          fallback={
            <div class="p-2">
              <p class="text-6xl font-mono font-semibold tracking-wider">
                <span class="text-ctp-pink">a</span>
                <span class="text-ctp-green">i</span>
                <span class="text-ctp-yellow">t</span>
                <span class="text-ctp-red">e</span>
                <span class="text-ctp-sky">t</span>
                <span class="text-ctp-blue">s</span>
                <span class="text-ctp-peach">u</span>
              </p>
            </div>
          }
        >
          {(item, index) => (
            <div
              data-index={index()}
              class="border flex rounded border-ctp-surface0 px-2 py-1"
            >
              <div
                class="prose !max-w-none prose-sm leading-tight prose-headings:text-ctp-pink prose-strong:text-ctp-mauve prose-em:text-ctp-maroon prose-a:text-ctp-blue hover:prose-a:text-ctp-teal prose-code:text-ctp-peach prose-pre:bg-ctp-surface0 prose-pre:text-ctp-text prose-p:text-ctp-subtext1 prose-ul:text-ctp-subtext0 prose-ol:list-inside"
                innerHTML={item}
              />
              <Show when={generating()}>
                <span class="inline-block w-[1ch] bg-ctp-surface0">&nbsp;</span>
              </Show>
              {/* <CodeBlock code={code()} /> */}
            </div>
          )}
        </For>
      </div>

      <div class="h-32 relative w-full p-2">
        <Show when={fileDirPicker()}>
          <div class="absolute h-32 w-full text-ctp-green text-sm px-1 py-1 bottom-[8.5rem] rounded bg-ctp-mantle flex flex-col-reverse gap-1 overflow-auto">
            <For each={fileDirResults()} fallback={<div>No results</div>}>
              {(item, index) => {
                const isDirectory = item[item.length - 1] === "/";
                return (
                  <button
                    class="flex items-center justify-start gap-1 rounded hover:bg-ctp-surface0 px-1 py-0.5"
                    data-index={index()}
                    onClick={() => {
                      const p = prompt();
                      const idx = p.lastIndexOf("@");
                      if (idx !== -1) {
                        const before = p.slice(0, idx);
                        setPrompt(before + "@" + item);
                      } else {
                        // TODO:
                      }
                    }}
                  >
                    {isDirectory ? (
                      <svg
                        class="size-5 text-ctp-blue"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="currentColor"
                          fill-rule="evenodd"
                          d="M2.07 5.258C2 5.626 2 6.068 2 6.95V14c0 3.771 0 5.657 1.172 6.828S6.229 22 10 22h4c3.771 0 5.657 0 6.828-1.172S22 17.771 22 14v-2.202c0-2.632 0-3.949-.77-4.804a3 3 0 0 0-.224-.225C20.151 6 18.834 6 16.202 6h-.374c-1.153 0-1.73 0-2.268-.153a4 4 0 0 1-.848-.352C12.224 5.224 11.816 4.815 11 4l-.55-.55c-.274-.274-.41-.41-.554-.53a4 4 0 0 0-2.18-.903C7.53 2 7.336 2 6.95 2c-.883 0-1.324 0-1.692.07A4 4 0 0 0 2.07 5.257M12.25 10a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5h-5a.75.75 0 0 1-.75-.75"
                          clip-rule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        class="size-5 text-ctp-lavender"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="currentColor"
                          d="m19.352 7.617l-3.96-3.563c-1.127-1.015-1.69-1.523-2.383-1.788L13 5c0 2.357 0 3.536.732 4.268S15.643 10 18 10h3.58c-.362-.704-1.012-1.288-2.228-2.383"
                        />
                        <path
                          fill="currentColor"
                          fill-rule="evenodd"
                          d="M10 22h4c3.771 0 5.657 0 6.828-1.172S22 17.771 22 14v-.437c0-.873 0-1.529-.043-2.063h-4.052c-1.097 0-2.067 0-2.848-.105c-.847-.114-1.694-.375-2.385-1.066c-.692-.692-.953-1.539-1.067-2.386c-.105-.781-.105-1.75-.105-2.848l.01-2.834q0-.124.02-.244C11.121 2 10.636 2 10.03 2C6.239 2 4.343 2 3.172 3.172C2 4.343 2 6.229 2 10v4c0 3.771 0 5.657 1.172 6.828S6.229 22 10 22m.97-6.53a.75.75 0 0 1 1.06 0l1 1a.75.75 0 0 1 0 1.06l-1 1a.75.75 0 1 1-1.06-1.06l.47-.47l-.47-.47a.75.75 0 0 1 0-1.06m-.268-1.207a.75.75 0 1 0-1.404-.526l-1.5 4a.75.75 0 1 0 1.404.526zM7.53 13.47a.75.75 0 0 1 0 1.06l-.47.47l.47.47a.75.75 0 1 1-1.06 1.06l-1-1a.75.75 0 0 1 0-1.06l1-1a.75.75 0 0 1 1.06 0"
                          clip-rule="evenodd"
                        />
                      </svg>
                    )}

                    <p
                      class={
                        isDirectory ? "text-ctp-blue" : "text-ctp-lavender"
                      }
                    >
                      {item}
                    </p>
                  </button>
                );
              }}
            </For>
          </div>
        </Show>

        <textarea
          onKeyDown={onShortcut}
          ref={promptInputRef}
          value={prompt()}
          class="bg-ctp-base size-full px-2 py-1 text-ctp-pink border rounded border-ctp-surface2 focus:border-ctp-mauve outline-none"
          onInput={(e) => setPrompt(e.currentTarget.value)}
        />
      </div>
    </main>
  );
}

export default App;
