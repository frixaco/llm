import { useEffect, useRef, useState } from "react";
import "./App.css";

import { exit } from "@tauri-apps/plugin-process";
import { open } from "@tauri-apps/plugin-dialog";
import { Channel, invoke } from "@tauri-apps/api/core";
// import markdownit from 'markdown-it'
import { marked } from "marked";
import { Message } from "./message";
import { Aitetsu } from "./aitetsu";
import { PromptArea } from "./prompt-area";
import { Messages } from "./messages";

const useGlobalShortcuts = () => {
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      // Set project directory
      if (e.metaKey && e.key === "o") {
        const cwd = await open({ directory: true, multiple: false });
        if (cwd !== null) setCwd(cwd as string);
        await invoke("set_project_dir", {
          path: cwd,
        });
      }
    };

    document.addEventListener("keypress", handler);

    return () => document.removeEventListener("keypress", handler);
  }, []);
};

function Header({ cwd }: { cwd: string }) {
  return (
    <div
      data-tauri-drag-region
      className="h-7 w-full px-2 cursor-pointer py-1 select-none border-b border-b-ctp-mauve flex items-center justify-between"
    >
      <div className="w-1/3">
        <Aitetsu />
      </div>

      <div className="text-ctp-blue whitespace-nowrap w-1/3 text-center overflow-clip">
        <span>{cwd}</span>
      </div>

      <div className="w-1/3 justify-end items-center flex gap-3 text-xs font-mono font-sm">
        <span className="text-ctp-subtext0">1000 / 200,000</span>
      </div>
    </div>
  );
}

const SYSTEM_PROMPT: string = `You are a Senior Software Engineer with extensive knowledge in many programming languages, frameworks, libraries, design patterns and best practices.

Answer in two phases.
Phase 1 - present the solution and a detailed plan.
Phase 2 - call tools if they are needed to accomplish given task; otherwise omit Phase 2.
`;

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
  // const [history, setHistory] = useState<string[]>([]);
  // const [last, setLast] = useState<string | null>(null);
  // const [toolActive, setToolActive] = useState(false);
  // const [activeTool, setActiveTool] = useState<string | null>(null);
  // const [generating, setGenerating] = useState(false);
  const [cwd, setCwd] = useState<string>("-");

  // useEffect(() => {
  //   (async () => {
  //     if (!generating && last) {
  //       const markdownResponse = await marked.parse(last!);
  //       setLast(markdownResponse);
  //     }
  //   })();
  // }, [last]);

  return (
    <main className="flex flex-col h-full font-mono">
      <Header cwd={cwd} />

      <Messages />

      <PromptArea />
    </main>
  );
}

export default App;
