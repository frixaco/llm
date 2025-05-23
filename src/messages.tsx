export function Messages() {
  return (
    <div className="flex flex-col gap-2 flex-1 overflow-y-auto p-2 text-ctp-pink">
      {history.map((item) => (
        <Message text={item} streaming={false} />
      ))}
      <div className="border flex rounded border-ctp-surface0 px-2 py-1">
        <div
          className="prose !max-w-none prose-sm leading-tight prose-headings:text-ctp-pink prose-strong:text-ctp-mauve prose-em:text-ctp-maroon prose-a:text-ctp-blue hover:prose-a:text-ctp-teal prose-code:text-ctp-peach prose-pre:bg-ctp-surface0 prose-pre:text-ctp-text prose-p:text-ctp-subtext1 prose-ul:text-ctp-subtext0 prose-ol:list-inside"
          dangerouslySetInnerHTML={{ __html: last ?? "" }}
        />
        {toolActive && activeTool && (
          <span className="text-ctp-green text-xl py-2 px-1">{activeTool}</span>
        )}
      </div>
    </div>
  );
}
