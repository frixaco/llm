package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

type ParticipantType string

const (
	Me   ParticipantType = "user"
	LLM  ParticipantType = "llm"
	Tool ParticipantType = "tool"
)

type Message struct {
	from ParticipantType
	text string
}

type History struct {
	messages []Message
}

const (
	green   string = "\033[32m"
	blue    string = "\033[34m"
	magenta string = "\033[35m"
)

func main() {
	messages := []Message{
		{from: Me, text: "hello world"},
		{from: LLM, text: "How are you doing?"},
		{from: Tool, text: "Edited that file successfully"},
	}
	scanner := bufio.NewScanner(os.Stdin)

	for {
		// Save cursor position in terminal
		fmt.Print("\033[s")

		for _, msg := range messages {
			switch msg.from {
			case Me:
				fmt.Printf("%sYou: %s%s\n", green, msg.text, green)
			case LLM:
				fmt.Printf("%sLLM: %s%s\n", blue, msg.text, blue)
			case Tool:
				fmt.Printf("%sTool: %s%s\n", magenta, msg.text, magenta)
			}
		}

		fmt.Print("> ")

		if scanner.Scan() {
			userPrompt := strings.TrimSpace(scanner.Text())
			if userPrompt != "" {
				// Restores cursor to saved position and clears from that position to the end of the screen
				fmt.Print("\033[u\033[0J")
				messages = append(messages, Message{
					from: Me,
					text: userPrompt,
				})
			}
		}
	}
}
