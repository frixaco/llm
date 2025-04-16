import { codeToHtml } from "shiki"
import { createSignal, createEffect, Show } from "solid-js"

export function CodeBlock(props: { code: string }) {
  const [highlightedCode, setHighlightedCode] = createSignal<string | null>(null)

  createEffect(async () => {
    console.log("codeblock effect", highlightedCode())
    const getHighlightedCode = async () => {
      setHighlightedCode(await codeToHtml(props.code, {
        lang: "go",
        theme: "catppuccin-mocha"
      }))
    }


    if (highlightedCode() == null && props.code != "") {
      getHighlightedCode()
    }
  })

  return <Show when={highlightedCode()} fallback={<span>Loading...</span>}>
    {(code) => (
      <div class='codeblock' innerHTML={code()}></div>
    )}
  </Show>
}

