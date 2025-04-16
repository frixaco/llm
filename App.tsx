import { useState } from "react";
import "./App.css";

import { readTextFile } from "@tauri-apps/plugin-fs";
import { CodeBlock } from "./codeblock";

const file = "D:/dev/llm/cli-go/cli.go"

function App() {
  const [code, setCode] = useState("")
  const onClick = async () => {
    const content = await readTextFile(file)
    setCode(content)
  }


  return (
    <main className="container">
      <button onClick={onClick}>READ FILE</button>
      <CodeBlock code={code} />
    </main>
  );
}

export default App;
