import { useState, useEffect } from "react";
import "./App.css";

import { readTextFile } from "@tauri-apps/plugin-fs";
import { CodeBlock } from "./codeblock";

const file = "D:/dev/llm/cli-go/cli.go";

function App() {
  const [code, setCode] = useState("");
  const onClick = async () => {
    const content = await readTextFile(file);
    setCode(content);
  };

  useEffect(() => {
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
  }, []);

  return (
    <main className="container">
      <button onClick={onClick}>READ FILE</button>
      <CodeBlock code={code} />
    </main>
  );
}

export default App;
