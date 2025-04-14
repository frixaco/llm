package main

type ORPayload struct {
	Model             string             `json:"model,omitempty"`
	Messages          []ORMessage        `json:"messages,omitempty"`
	Prompt            string             `json:"prompt,omitempty"`
	Stream            bool               `json:"stream,omitempty"`
	MaxTokens         int                `json:"max_tokens,omitempty"`
	Temperature       float32            `json:"temperature,omitempty"`
	Seed              int                `json:"seed,omitempty"`
	TopP              float32            `json:"top_p,omitempty"`
	TopK              float32            `json:"top_k,omitempty"`
	FrequencyPenalty  float32            `json:"frequency_penalty,omitempty"`
	PresencePenalty   float32            `json:"presence_penalty,omitempty"`
	RepetitionPenalty float32            `json:"repetition_penalty,omitempty"`
	TopLogprobs       int                `json:"top_logprobs,omitempty"`
	MinP              float32            `json:"min_p,omitempty"`
	TopA              float32            `json:"top_a,omitempty"`
	Transforms        []string           `json:"transforms,omitempty"`
	Models            []string           `json:"models,omitempty"`
	LogitBias         map[string]float32 `json:"logit_bias,omitempty"`
	Provider          ORProvider         `json:"provider"`
	Reasoning         ORReasoning        `json:"reasoning"`
	ResponseFormat    ORResponseFormat   `json:"response_format"`
	StructuredOutputs bool               `json:"structured_outputs,omitempty"`
	Stop              []string           `json:"stop,omitempty"`
	Tools             []ORTool           `json:"tools,omitempty"`
	ToolChoice        ORToolChoice       `json:"tool_choice,omitempty"` // TODO: can be specific function
	MaxPrice          map[string]int     `json:"max_price,omitempty"`
}

type ORToolChoice string

const (
	None     ORToolChoice = "none"
	Auto     ORToolChoice = "auto"
	Required ORToolChoice = "required"
)

type ORToolType string

const (
	Function ORToolType = "function"
)

type ORFunctionDescription struct {
	Description string                 `json:"description,omitempty"`
	Name        string                 `json:"name"`
	Parameters  map[string]interface{} `json:"parameters"`
}

type ORTool struct {
	Type     ORToolType            `json:"type"`
	Function ORFunctionDescription `json:"function"`
}

type ORResponseFormatType string

const (
	JsonObject ORResponseFormatType = "json_object"
)

type ORResponseFormat struct {
	Type ORResponseFormatType `json:"type,omitempty"`
}

type ORProvider struct {
	Sort string `json:"sort,omitempty"`
}

type OREffort string

const (
	High   OREffort = "high"
	Medium OREffort = "medium"
	Low    OREffort = "low"
)

type ORReasoning struct {
	Effort    OREffort `json:"effort,omitempty"`
	MaxTokens int      `json:"max_tokens,omitempty"`
	Exclude   bool     `json:"exclude,omitempty"`
}

type ORMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ORResponse struct {
	Id      string     `json:"id"`
	Choices []ORChoice `json:"choices"`
}

type ORChoice struct {
	Message ORMessage `json:"message"`
}
