package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/charmbracelet/bubbles/v2/cursor"
	"github.com/charmbracelet/bubbles/v2/textarea"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
)

func main() {
	p := tea.NewProgram(initialModel(), tea.WithKeyboardEnhancements(
		tea.WithKeyReleases,
		tea.WithUniformKeyLayout,
	))
	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Oof: %v\n", err)
	}
}

type model struct {
	messages    []string
	textarea    textarea.Model
	statusStyle lipgloss.Style
	statusBar   status
	err         error
}

type status struct {
	tokens int
	cost   float64
}

func initialModel() model {
	ta := textarea.New()
	ta.Placeholder = "Send a message..."
	ta.VirtualCursor = true
	ta.Focus()

	ta.Prompt = ""
	ta.SetWidth(30)
	ta.MaxHeight = 10
	ta.SetHeight(1)

	ta.Styles.Focused.CursorLine = lipgloss.NewStyle()
	ta.Styles.Focused.Prompt = lipgloss.NewStyle().Foreground(lipgloss.Color("#b4befe"))
	ta.Styles.Focused.Base = lipgloss.NewStyle().Border(lipgloss.RoundedBorder(), true).BorderForeground(lipgloss.Color("#cba6f7"))
	ta.Styles.Blurred.Base = lipgloss.NewStyle().Border(lipgloss.RoundedBorder(), true).BorderForeground(lipgloss.Color("#7f849c"))

	ta.ShowLineNumbers = false

	ta.KeyMap.InsertNewline.SetEnabled(false)

	return model{
		textarea:    ta,
		messages:    []string{},
		statusStyle: lipgloss.NewStyle().Align(lipgloss.Right).Padding(0, 1),
		err:         nil,
	}
}

func (m model) Init() tea.Cmd {
	return textarea.Blink
}

func (m *model) updateTextareaHeight() {
	content := m.textarea.Value()
	lines := strings.Count(content, "\n") + 1
	if content == "" {
		lines = 1
	}
	newHeight := min(lines, m.textarea.MaxHeight)
	m.textarea.SetHeight(newHeight)
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.textarea.SetWidth(msg.Width)
		m.updateTextareaHeight()

	case tea.KeyPressMsg:
		switch msg.String() {
		case "esc":
		case "ctrl+c":
			return m, tea.Quit
		case "enter":
			m.messages = append(m.messages, m.textarea.Value())
			m.textarea.Reset()
			m.textarea.SetHeight(1) // Reset to 1 line
			return m, nil
		case "shift+enter":
			m.textarea.InsertString("\n")
			m.updateTextareaHeight()
			m.textarea, cmd = m.textarea.Update(msg)
			return m, cmd
		default:
			m.textarea, cmd = m.textarea.Update(msg)
			m.updateTextareaHeight()
			return m, cmd
		}

	case cursor.BlinkMsg:
		m.textarea, cmd = m.textarea.Update(msg)
		m.updateTextareaHeight()
		return m, cmd
	}

	return m, nil
}

func (m model) View() string {
	statusView := m.statusStyle.Width(m.textarea.Width() + 2).Render(fmt.Sprintf("tokens: %7d\ncost: %9.2f", m.statusBar.tokens, m.statusBar.cost))
	return fmt.Sprintf(
		"%s\n%s",
		statusView,
		m.textarea.View(),
	)
}
