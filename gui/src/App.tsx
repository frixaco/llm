import { useEffect, useState } from "react";
import "./App.css";

import { readDir, BaseDirectory, DirEntry } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";

function App() {
  const [failure, setError] = useState("");
  const [dirs, setDirs] = useState<string[]>([]);

  useEffect(() => {
    async function processEntriesRecursively(
      parent: string,
      entries: DirEntry[],
    ) {
      for (const entry of entries) {
        if (entry.isDirectory) {
          setDirs((p) => [...p, entry.name]);
          const dir = await join(parent, entry.name);
          processEntriesRecursively(
            dir,
            await readDir(dir, { baseDir: BaseDirectory.Home }),
          );
        }
      }
    }

    const check = async () => {
      try {
        const dir = "personal";
        const entries = await readDir(dir, {
          baseDir: BaseDirectory.Home,
        });

        processEntriesRecursively(dir, entries);
      } catch (err) {
        setError(String(err));
      }
    };
    check();
  }, []);

  return (
    <main className="container">
      <div className="dirs">
        {dirs.map((d, i) => (
          <div className="dir">
            <p key={`${d}_${i}`}>{d}</p>
          </div>
        ))}
      </div>

      <p>{failure}</p>
    </main>
  );
}

export default App;
