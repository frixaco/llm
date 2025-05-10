import { createSignal, onCleanup, Show } from "solid-js";

export default function BlinkingCursor() {
  const [visible, setVisible] = createSignal(true);

  const interval = setInterval(() => {
    setVisible((v) => !v);
  }, 500);

  onCleanup(() => clearInterval(interval));

  return (
    <Show when={visible()}>
      <span class="inline-block w-[1ch] bg-ctp-surface0">&nbsp;</span>
    </Show>
  );
}
