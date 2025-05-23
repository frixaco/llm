import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";

export function PromptArea() {
    const [prompt, setPrompt] = useState("");
    const [fileDirPicker, setFileDirPicker] = useState(false);
    const [fileDirResults, setFileDirResults] = useState<string[]>([]);
    const [searchPath, setSearchPath] = useState("");

    const promptInputRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        if (promptInputRef.current?.hasAttribute("autofocus"))
            setTimeout(() => promptInputRef.current?.focus());
    }, []);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

            setHistory((prev) => [...prev, userPrompt]);
            setGenerating(true);
            setPrompt("");

            const onEvent = new Channel<StreamEvent>();
            onEvent.onmessage = async (message) => {
                if (message.event === "started") {
                    setLast("");
                }
                if (message.event === "delta") {
                    if (message.data.content == null && message.data.tool_calls != null) {
                        setToolActive(true);
                        setActiveTool(message.data.tool_calls[0]);
                        console.log("TOOL CALL STARTED: ", message.data.tool_calls[0]);
                    }
                    if (message.data.content && !message.data.tool_calls) {
                        setLast((p) => p! + message.data.content);
                    }
                    if (message.data.content != null && message.data.tool_calls != null) {
                        setToolActive(false);
                        setActiveTool(null);
                        console.log("TOOL CALL ENDED");
                    }
                }
                if (message.event === "finished") {
                    setHistory((p) => [...p, last!]);
                    setLast(null);
                }
            };

            await invoke("call_llm", {
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: prompt },
                ],
                onEvent,
            });
            setGenerating(false);
        }
    };

    return (
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
    )
}