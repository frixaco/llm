import json
from time import monotonic
from rich.syntax import Syntax
from rich.table import Table

from textual import events
from textual.app import App, ComposeResult, RenderResult
from textual.containers import HorizontalGroup, VerticalScroll
from textual.reactive import reactive
from textual.widgets import Button, Digits, Footer, Header, Input, RichLog, TextArea

CODE = '''\
def loop_first_last(values: Iterable[T]) -> Iterable[tuple[bool, bool, T]]:
    """Iterate and generate a tuple with a flag for first and last value."""
    iter_values = iter(values)
    try:
        previous_value = next(iter_values)
    except StopIteration:
        return
    first = True
    for value in iter_values:
        yield first, False, previous_value
        first = False
        previous_value = value
    yield first, True, previous_value\
'''


class Messages(RichLog):
    """Message history"""


class PromptInput(TextArea):
    """User prompt input area"""

    def on_mount(self) -> None:
        self.focus()

    def on_key(self, event: events.Key) -> None:
        if event.key == "enter":
            # TODO: submit
            pass
        # messages = self.app.query_one(Messages)
        # messages.write(f"PromptInput key: {event.key!r}")


class Aitetsu(App):
    """A Textual app to manage stopwatches."""

    CSS_PATH = "main.tcss"

    def compose(self) -> ComposeResult:
        """Create child widgets for the app."""
        yield VerticalScroll(Messages(id="messages", highlight=True, markup=True))
        yield PromptInput(id="prompt", tab_behavior="indent", language="markdown")

    def on_ready(self) -> None:
        """Called  when the DOM is ready."""
        text_log = self.query_one(RichLog)

        text_log.write(Syntax(CODE, "python", indent_guides=True))


if __name__ == "__main__":
    app = Aitetsu()
    app.run()
