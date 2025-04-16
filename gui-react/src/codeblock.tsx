import { useEffect, useState } from 'react'
import { codeToHtml } from "shiki"

export function CodeBlock({ code }: { code: string }) {
  const [highlightedCode, setHighlightedCode] = useState("<span>Loading...<span>")

  useEffect(() => {
    (async () => {
      const r = await codeToHtml(code, {
        lang: "go",
        theme: "catppuccin-mocha"
      })
      console.log("r", r)
      setHighlightedCode(r)
    })()
  }, [code])

  return <div className='codeblock' dangerouslySetInnerHTML={{ __html: highlightedCode }}></div>
}
