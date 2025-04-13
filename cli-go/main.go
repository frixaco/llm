package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
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
	textarea    textarea.Model
	statusStyle lipgloss.Style
	statusBar   status
	response    string
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

	return model{
		textarea:    ta,
		statusStyle: lipgloss.NewStyle().Align(lipgloss.Right).Padding(0, 1).Foreground(lipgloss.Color("#b4befe")),
		statusBar:   status{tokens: 1000, cost: 0.01},
		response:    "",
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

func processPrompt(prompt string) tea.Cmd {
	return func() tea.Msg {
		openrouterUrl := "https://openrouter.ai/api/v1/chat/completions"

		client := &http.Client{}

		p := openrouterPayload{Model: "google/gemini-2.5-pro-preview-03-25", Messages: []openrouterPayloadMessage{
			{Role: "user", Content: prompt},
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
			log.Fatal("Wrong response shape")
		}

		var response openrouterResponse
		if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
			log.Fatal(err)
		}

		return responseMsg(response)
	}
}

type responseMsg openrouterResponse

type openrouterPayload struct {
	Model    string                     `json:"model"`
	Messages []openrouterPayloadMessage `json:"messages"`
}

type openrouterPayloadMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openrouterResponse struct {
	Id      string                     `json:"id"`
	Choices []openrouterResponseChoice `json:"choices"`
}

type openrouterResponseChoice struct {
	Message openrouterPayloadMessage `json:"message"`
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.textarea.SetWidth(msg.Width)
		m.updateTextareaHeight()

	case responseMsg:
		m.response = msg.Choices[0].Message.Content
		return m, nil

	case tea.KeyPressMsg:
		switch msg.String() {
		case "esc":
		case "ctrl+c":
			return m, tea.Quit
		case "enter":
			prompt := m.textarea.Value()
			m.textarea.Reset()
			m.textarea.SetHeight(1)
			return m, processPrompt(prompt)
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
		"%s\n%s\n%s",
		m.response,
		statusView,
		m.textarea.View(),
	)
}
