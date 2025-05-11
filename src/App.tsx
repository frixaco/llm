import { useCallback, useEffect, useRef, useState } from "react";
import reactLogo from "./assets/react.svg";
import "./App.css";

import { exit } from "@tauri-apps/plugin-process";
import { Channel, invoke } from "@tauri-apps/api/core";
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
        content: string | null;
        tool_calls: string[] | null;
      };
    }
  | {
      event: "finished";
      data: {
        full_response: string | null;
      };
    };

function App() {
  // ── state ────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [fileDirPicker, setFileDirPicker] = useState(false);
  const [fileDirResults, setFileDirResults] = useState<string[]>([]);
  const [searchPath, setSearchPath] = useState("");

  // ── refs ─────────────────────────────────────────────────────────────
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── derived / memoised helpers ───────────────────────────────────────
  const updateHistory = useCallback(
    (updater: (prev: string[]) => string[]) =>
      setHistory((prev) =>
        updater(typeof updater === "function" ? prev : prev),
      ),
    [],
  );

  // ── side-effect: update searchPath when typing after “@” ─────────────
  useEffect(() => {
    if (!fileDirPicker) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const idx = prompt.lastIndexOf("@");
      if (idx !== -1) setSearchPath(prompt.slice(idx + 1));
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [prompt, fileDirPicker]);

  // ── side-effect: fuzzy search whenever searchPath changes ────────────
  useEffect(() => {
    if (searchPath === "") return;
    let cancelled = false;

    (async () => {
      const rs = await invoke<string[]>("fuzzy_search", {
        searchTerm: searchPath,
      });
      if (!cancelled) setFileDirResults(rs);
    })();

    return () => {
      cancelled = true;
    };
  }, [searchPath]);

  // ── side-effect: autofocus text-area on mount ────────────────────────
  useEffect(() => {
    if (promptInputRef.current?.hasAttribute("autofocus"))
      setTimeout(() => promptInputRef.current?.focus());
  }, []);

  // ── side-effect: global Ctrl-C handler ───────────────────────────────
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if (
        e.key === "c" &&
        e.ctrlKey &&
        (e.target as HTMLElement).tagName === "BODY" &&
        !generating
      ) {
        await exit(1);
      }
    };
    document.addEventListener("keypress", handler);
    return () => document.removeEventListener("keypress", handler);
  }, [generating]);

  // ── keyboard shortcut handler bound to <textarea> ────────────────────
  const onShortcut = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const key = e.key;

    // backspace immediately after “@” => exit picker
    if (key === "Backspace") {
      const { value } = e.currentTarget;
      if (value[value.length - 1] === "@") setFileDirPicker(false);
    }

    // start picker
    if (key === "@" && !fileDirPicker) {
      setFileDirPicker(true);
      setFileDirResults(
        await invoke<string[]>("fuzzy_search", { searchTerm: "." }),
      );
    }

    // space closes picker
    if (key === " " && fileDirPicker) setFileDirPicker(false);

    // send prompt on Enter
    if (key === "Enter") {
      e.preventDefault(); // keep behaviour identical to Solid
      const userPrompt = prompt.trim();
      if (userPrompt === "") return;

      updateHistory((prev) => [...prev, userPrompt]);
      setGenerating(true);
      setPrompt("");

      const onEvent = new Channel<StreamEvent>();
      onEvent.onmessage = async (message) => {
        const h = [...history]; // snapshot
        const last = h.pop() ?? "";
        if (message.event === "started") {
          setHistory([...h, ""]);
        }
        if (message.event === "delta") {
          if (!message.data.content && message.data.tool_calls) {
            setHistory([...h, last + " TOOL CALLING"]);
          }
          if (message.data.content && !message.data.tool_calls) {
            setHistory([...h, last + message.data.content]);
          }
        }
        if (message.event === "finished") {
          const markdownResponse = await marked.parse(last);
          setHistory([...h, markdownResponse]);
        }
      };

      await invoke("call_llm", { prompt: userPrompt, onEvent });
      setGenerating(false);
    }
  };

  return (
    <main className="flex flex-col h-full font-mono">
      {/* window-chrome / title bar */}
      <div
        data-tauri-drag-region
        className="h-7 w-full px-2 cursor-pointer py-1 select-none border-b border-b-ctp-mauve flex items-center justify-between"
      >
        <p className="text-sm font-mono font-semibold tracking-wider">
          {history.length !== 0 && (
            <>
              <span className="text-ctp-pink">a</span>
              <span className="text-ctp-green">i</span>
              <span className="text-ctp-yellow">t</span>
              <span className="text-ctp-red">e</span>
              <span className="text-ctp-sky">t</span>
              <span className="text-ctp-blue">s</span>
              <span className="text-ctp-peach">u</span>
            </>
          )}
        </p>

        <div className="flex gap-3 text-xs font-mono font-sm">
          <span className="text-ctp-text">1000 / 200,000</span>
          <span className="text-ctp-mauve">|</span>
          <span className="text-ctp-maroon">$ 0.23</span>
        </div>
      </div>

      {/* chat / history */}
      <div className="flex flex-col gap-2 flex-1 overflow-y-auto p-2 text-ctp-pink">
        {history.length === 0 ? (
          <div className="p-2">
            <p className="text-6xl font-mono font-semibold tracking-wider">
              <span className="text-ctp-pink">a</span>
              <span className="text-ctp-green">i</span>
              <span className="text-ctp-yellow">t</span>
              <span className="text-ctp-red">e</span>
              <span className="text-ctp-sky">t</span>
              <span className="text-ctp-blue">s</span>
              <span className="text-ctp-peach">u</span>
            </p>
          </div>
        ) : (
          history.map((item, i) => (
            <div
              key={i}
              data-index={i}
              className="border flex rounded border-ctp-surface0 px-2 py-1"
            >
              <div
                className="prose !max-w-none prose-sm leading-tight prose-headings:text-ctp-pink prose-strong:text-ctp-mauve prose-em:text-ctp-maroon prose-a:text-ctp-blue hover:prose-a:text-ctp-teal prose-code:text-ctp-peach prose-pre:bg-ctp-surface0 prose-pre:text-ctp-text prose-p:text-ctp-subtext1 prose-ul:text-ctp-subtext0 prose-ol:list-inside"
                dangerouslySetInnerHTML={{ __html: item }}
              />
              {generating && (
                <span className="inline-block w-[1ch] bg-ctp-surface0">
                  &nbsp;
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* prompt composer + file-picker overlay */}
      <div className="h-32 relative w-full p-2">
        {fileDirPicker && (
          <div className="absolute h-32 w-full text-ctp-green text-sm px-1 py-1 bottom-[8.5rem] rounded bg-ctp-mantle flex flex-col-reverse gap-1 overflow-auto">
            {fileDirResults.length === 0 ? (
              <div>No results</div>
            ) : (
              fileDirResults.map((item, idx) => {
                const isDirectory = item.endsWith("/");
                return (
                  <button
                    key={idx}
                    className="flex items-center justify-start gap-1 rounded hover:bg-ctp-surface0 px-1 py-0.5"
                    onClick={() => {
                      const idxAt = prompt.lastIndexOf("@");
                      if (idxAt !== -1) {
                        const before = prompt.slice(0, idxAt);
                        setPrompt(before + "@" + item);
                      }
                    }}
                  >
                    {isDirectory ? (
                      <svg
                        className="size-5 text-ctp-blue"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="currentColor"
                          fillRule="evenodd"
                          d="M2.07 5.258C2 5.626 2 6.068 2 6.95V14c0 3.771 0 5.657 1.172 6.828S6.229 22 10 22h4c3.771 0 5.657 0 6.828-1.172S22 17.771 22 14v-2.202c0-2.632 0-3.949-.77-4.804a3 3 0 0 0-.224-.225C20.151 6 18.834 6 16.202 6h-.374c-1.153 0-1.73 0-2.268-.153a4 4 0 0 1-.848-.352C12.224 5.224 11.816 4.815 11 4l-.55-.55c-.274-.274-.41-.41-.554-.53a4 4 0 0 0-2.18-.903C7.53 2 7.336 2 6.95 2c-.883 0-1.324 0-1.692.07A4 4 0 0 0 2.07 5.257M12.25 10a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5h-5a.75.75 0 0 1-.75-.75"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="size-5 text-ctp-lavender"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="currentColor"
                          d="m19.352 7.617l-3.96-3.563c-1.127-1.015-1.69-1.523-2.383-1.788L13 5c0 2.357 0 3.536.732 4.268S15.643 10 18 10h3.58c-.362-.704-1.012-1.288-2.228-2.383"
                        />
                        <path
                          fill="currentColor"
                          fillRule="evenodd"
                          d="M10 22h4c3.771 0 5.657 0 6.828-1.172S22 17.771 22 14v-.437c0-.873 0-1.529-.043-2.063h-4.052c-1.097 0-2.067 0-2.848-.105c-.847-.114-1.694-.375-2.385-1.066c-.692-.692-.953-1.539-1.067-2.386c-.105-.781-.105-1.75-.105-2.848l.01-2.834q0-.124.02-.244C11.121 2 10.636 2 10.03 2C6.239 2 4.343 2 3.172 3.172C2 4.343 2 6.229 2 10v4c0 3.771 0 5.657 1.172 6.828S6.229 22 10 22m.97-6.53a.75.75 0 0 1 1.06 0l1 1a.75.75 0 0 1 0 1.06l-1 1a.75.75 0 1 1-1.06-1.06l.47-.47l-.47-.47a.75.75 0 0 1 0-1.06m-.268-1.207a.75.75 0 1 0-1.404-.526l-1.5 4a.75.75 0 1 0 1.404.526zM7.53 13.47a.75.75 0 0 1 0 1.06l-.47.47l.47.47a.75.75 0 1 1-1.06 1.06l-1-1a.75.75 0 0 1 0-1.06l1-1a.75.75 0 0 1 1.06 0"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    <p
                      className={
                        isDirectory ? "text-ctp-blue" : "text-ctp-lavender"
                      }
                    >
                      {item}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* textarea */}
        <textarea
          ref={promptInputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.currentTarget.value)}
          onKeyDown={onShortcut}
          className="bg-ctp-base size-full px-2 py-1 text-ctp-pink border rounded border-ctp-surface2 focus:border-ctp-mauve outline-none"
          autoFocus
        />
      </div>
    </main>
  );
}

export default App;
