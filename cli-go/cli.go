package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/charmbracelet/bubbles/v2/cursor"
	"github.com/charmbracelet/bubbles/v2/spinner"
	"github.com/charmbracelet/bubbles/v2/textarea"
	tea "github.com/charmbracelet/bubbletea/v2"
	"github.com/charmbracelet/lipgloss/v2"
)

func Cli() {
	p := tea.NewProgram(initialModel(), tea.WithKeyboardEnhancements(
		tea.WithKeyReleases,
		tea.WithUniformKeyLayout,
	))
	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Oof: %v\n", err)
	}
}

type State int

const (
	Idle State = iota
	WaitingInitialLLMRes
	LLMRequestedTool
	ToolRunning
	SendingToolResult
	WaitingLLM
)

type Model struct {
	textarea    textarea.Model
	statusStyle lipgloss.Style
	statusBar   Status
	response    string
	err         error
	spinner     spinner.Model
	state       State
}

type Status struct {
	tokens int
	cost   float64
}

func initialModel() Model {
	ta := textarea.New()
	ta.Placeholder = "Send a message..."
	ta.VirtualCursor = true
	ta.Focus()

	ta.Prompt = "│ "
	ta.SetWidth(30)
	ta.MaxHeight = 10
	ta.SetHeight(1)

	ta.Styles.Focused.CursorLine = lipgloss.NewStyle()
	ta.Styles.Focused.Prompt = lipgloss.NewStyle().Foreground(lipgloss.Color("#b4befe"))
	// ta.Styles.Focused.Base = lipgloss.NewStyle().Border(lipgloss.RoundedBorder(), true).BorderForeground(lipgloss.Color("#cba6f7"))
	// ta.Styles.Blurred.Base = lipgloss.NewStyle().Border(lipgloss.RoundedBorder(), true).BorderForeground(lipgloss.Color("#7f849c"))

	ta.ShowLineNumbers = false

	ta.KeyMap.InsertNewline.SetEnabled(false)

	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))

	return Model{
		textarea:    ta,
		statusStyle: lipgloss.NewStyle().Align(lipgloss.Right).Padding(0, 1).Foreground(lipgloss.Color("#b4befe")),
		statusBar:   Status{tokens: 1000, cost: 0.01},
		response:    "",
		err:         nil,
		state:       Idle,
		spinner:     s,
	}
}

func (m Model) Init() tea.Cmd {
	return textarea.Blink
}

func (m *Model) updateTextareaHeight() {
	content := m.textarea.Value()
	lines := strings.Count(content, "\n") + 1
	if content == "" {
		lines = 1
	}
	newHeight := min(lines, m.textarea.MaxHeight)
	m.textarea.SetHeight(newHeight)
}

func editFile(path string, searchBlock string, replaceBlock string, expectedReplacements int) {

}

func processPrompt(prompt string) tea.Cmd {
	return func() tea.Msg {
		openrouterUrl := "https://openrouter.ai/api/v1/chat/completions"

		client := &http.Client{}

		p := ORPayload{Model: "google/gemini-2.5-pro-preview-03-25", Messages: []ORMessage{
			{

				Role: "system", Content: "You are an assistant at Senior Software Engineer level",
			},
			{
				Role: "user", Content: prompt,
			},
		}}

		payload, err := json.Marshal(p)
		if err != nil {
			log.Fatal(err)
		}

		req, err := http.NewRequest("POST", openrouterUrl, bytes.NewBuffer(payload))
		if err != nil {
			log.Fatal(err)
		}
		req.Header.Add("Authorization", "Bearer "+os.Getenv("OPENROUTER_API_KEY"))
		req.Header.Add("Content-Type", "application/json")

		res, err := client.Do(req)
		if err != nil {
			log.Fatal(err)
		}
		defer res.Body.Close()

		if res.StatusCode != 200 {
			b, _ := io.ReadAll(res.Body)
			log.Fatal("Wrong response shape", string(b))
		}

		var response ORResponse
		if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
			log.Fatal(err)
		}

		return responseMsg(response)
	}
}

type responseMsg ORResponse

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.textarea.SetWidth(msg.Width)
		m.updateTextareaHeight()

	case responseMsg:
		m.response = msg.Choices[0].Message.Content
		m.state = Idle
		return m, nil

	case spinner.TickMsg:
		var cmd tea.Cmd
		if m.state == Idle {
			return m, nil
		}
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd

	case tea.KeyPressMsg:
		switch msg.String() {
		case "esc":
		case "ctrl+c":
			return m, tea.Quit
		case "enter":
			prompt := m.textarea.Value()
			m.textarea.Reset()
			m.textarea.SetHeight(1)
			m.state = WaitingInitialLLMRes
			cmds = append(cmds, processPrompt(prompt), m.spinner.Tick)
			return m, tea.Batch(cmds...)
		case "shift+enter":
			m.textarea.InsertString("\n")
			m.updateTextareaHeight()
			var cmd tea.Cmd
			m.textarea, cmd = m.textarea.Update(msg)
			cmds = append(cmds, cmd)
			return m, tea.Batch(cmds...)
		default:
			var cmd tea.Cmd
			m.textarea, cmd = m.textarea.Update(msg)
			cmds = append(cmds, cmd)
			m.spinner, cmd = m.spinner.Update(msg)
			cmds = append(cmds, cmd)
			m.updateTextareaHeight()
			return m, tea.Batch(cmds...)
		}

	case cursor.BlinkMsg:
		var cmd tea.Cmd
		m.textarea, cmd = m.textarea.Update(msg)
		m.spinner, cmd = m.spinner.Update(msg)
		cmds = append(cmds, cmd)
		m.updateTextareaHeight()
		return m, tea.Batch(cmds...)
	}

	return m, nil
}

func (m Model) View() string {
	statusView := m.statusStyle.Width(m.textarea.Width() + 2).Render(fmt.Sprintf("tokens: %7d\ncost: %9.2f", m.statusBar.tokens, m.statusBar.cost))

	if m.state == WaitingInitialLLMRes {
		return fmt.Sprintf(
			"%s\n%s\n%s\n%s",
			m.spinner.View(),
			m.response,
			statusView,
			m.textarea.View(),
		)
	}

	return fmt.Sprintf(
		"%s\n%s\n%s",
		m.response,
		statusView,
		m.textarea.View(),
	)
}
