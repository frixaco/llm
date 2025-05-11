use std::env;
use std::path::PathBuf;

use futures::StreamExt;
use git2::Repository;
use nucleo_matcher::{
    pattern::{CaseMatching, Normalization, Pattern},
    Config, Matcher,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::ipc::Channel;
use walkdir::{DirEntry, WalkDir};

#[tauri::command]
fn get_project_dir(path: Option<String>) -> String {
    let target_path = match path {
        Some(p) => p,
        None => env::current_dir()
            .map(|path| path.to_string_lossy().into_owned())
            .unwrap_or_else(|_| "Unknown".to_string()),
    };
    // println!("Target path: {}", target_path.to_string());
    match Repository::discover(&target_path) {
        Ok(repo) => match repo.workdir() {
            Some(workdir) => match workdir.to_str() {
                Some(wd_path) => {
                    // println!("Git dir: {}", wd_path);
                    wd_path.to_string()
                }
                None => {
                    eprintln!("Failed to convert workdir to string");
                    "Unknown".to_string()
                }
            },
            None => {
                eprintln!("Failed to convert repo path to string");
                "Unknown".to_string()
            }
        },
        Err(_) => "Unknown".to_string(),
    }
}

fn is_ignored(entry: &DirEntry) -> bool {
    let name = entry.file_name().to_string_lossy();

    if entry.file_type().is_dir()
        && (name == "target" || name == "node_modules" || name == ".git" || name == ".venv")
    {
        return false;
    }

    true
}

#[tauri::command]
fn fuzzy_search(search_term: String) -> Vec<String> {
    println!("search term: {}", search_term);

    let cwd = get_project_dir(None);
    println!("cwd: {}", cwd);

    let paths: Vec<String> = WalkDir::new(&cwd)
        .into_iter()
        .filter_entry(is_ignored)
        .filter_map(|e| e.ok())
        .map(|p| {
            p.path()
                .strip_prefix(&cwd)
                .unwrap_or(p.path())
                .to_path_buf()
        })
        .collect::<Vec<PathBuf>>()
        .iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect();

    let mut matcher = Matcher::new(Config::DEFAULT.match_paths());
    matcher.config.prefer_prefix = true;

    let results = Pattern::parse(&search_term, CaseMatching::Ignore, Normalization::Smart)
        .match_list(paths, &mut matcher);

    for (path, score) in &results {
        println!("{} - {}", path, score);
    }

    results.into_iter().map(|(p, _s)| p).collect()
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
enum StreamEvent {
    #[serde(rename_all = "camelCase")]
    Started {
        prompt: String,
    },
    #[serde(rename_all = "camelCase")]
    Delta {
        content: Option<String>,
        tool_calls: Option<Vec<String>>,
    },
    #[serde(rename_all = "camelCase")]
    Finished {
        full_response: Option<String>,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    id: String,
    choices: Vec<Choice>,
}

#[derive(PartialEq, Debug, Deserialize)]
#[serde(rename_all = "snake_case")] // tool_calls, stop, length, content_filter, error
enum FinishReason {
    ToolCalls,
    Stop,
    Length,
    ContentFilter,
    Error,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: Option<Message>,
    delta: Option<Delta>,
    finish_reason: Option<FinishReason>,
}

#[derive(Debug, Deserialize)]
struct Delta {
    role: String,
    content: Option<String>,
    tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Debug, Deserialize)]
struct Message {
    role: String,
    content: Option<String>,
    tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Debug, Deserialize)]
struct ToolCall {
    id: String,
    #[serde(rename = "type")]
    type_field: String,
    function: FunctionCall,
}

#[derive(Debug, Deserialize)]
struct FunctionCall {
    name: String,
    arguments: String,
}

#[derive(Serialize, Deserialize)]
struct Usage {
    include: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Role {
    System,
    User,
    Assistant,
    Tool,
    Developer,
}

#[derive(Serialize)]
struct ChatMessage<'a> {
    role: &'a Role,
    content: &'a str,
}

#[derive(Serialize)]
struct ChatCompletionRequest<'a> {
    model: &'a str,
    messages: &'a [ChatMessage<'a>],
    stream: bool,
    tools: serde_json::Value,
    // tool_choice: TODO: @edit_tool - to force certain tools
    // usage: Option<Usage>,
    temperature: f32,
}

const OPENROUTER_CHAT_URL: &str = "https://openrouter.ai/api/v1/chat/completions";

#[tauri::command]
async fn call_llm(prompt: String, on_event: Channel<StreamEvent>) -> Result<(), String> {
    on_event
        .send(StreamEvent::Started {
            prompt: prompt.clone(),
        })
        .unwrap();

    let client = reqwest::Client::new();

    let system_prompt = ChatMessage {
        role: &Role::System,
        content: "You are a Senior Software Engineer with extensive knowledge in many programming languages, frameworks, libraries, design patterns and best practices.

Answer in two phases.
Phase 1 – present the solution and a detailed plan.
Phase 2 – call tools if they are needed to accomplish given task; otherwise omit Phase 2.
"
    };

    let user_prompt = ChatMessage {
        role: &Role::User,
        content: &prompt,
    };

    // model: "qwen/qwen3-235b-a22b:nitro",
    // model: "openai/gpt-4o-2024-11-20"),
    // model: "openai/gpt-4.1-mini"),
    // model: "google/gemini-2.5-pro-preview-05-06"),
    // model: "anthropic/claude-3.7-sonnet"),
    let payload = ChatCompletionRequest {
        model: "google/gemini-2.5-flash-preview:nitro",
        // model: "anthropic/claude-3.7-sonnet",
        messages: &[system_prompt, user_prompt],
        stream: true,
        temperature: 0.0,
        tools: json!([
            {
                "type": "function",
                "function": {
                  "name": "read_file",
                  "description":
                    "Read a **text** file in the current workspace and return its complete UTF-8 contents as a string.",
                  "parameters": {
                    "type": "object",
                    "properties": {
                      "path": {
                        "type": "string",
                        "description":
                          "Relative path from the project root to the file to read (e.g. \"src/index.ts\"). Must stay inside the workspace.",
                      },
                    },
                    "required": ["path"],
                  },
                },
            }
        ]),
    };

    let openrouter_api_key: String = env::var("OPENROUTER_API_KEY").unwrap_or("".to_string());

    let res = client
        .post(OPENROUTER_CHAT_URL)
        .header("Authorization", format!("Bearer {}", openrouter_api_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|err| format!("Request error: {}", err))?;

    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
        match item {
            Ok(bytes) => {
                let chunk = String::from_utf8_lossy(&bytes);
                for line in chunk.lines() {
                    println!("msg: {:?}", &line);
                    if let Some(json_str) = line.strip_prefix("data: ") {
                        if json_str == "[DONE]" {
                            println!("DONE");
                            on_event
                                .send(StreamEvent::Finished {
                                    full_response: Some("done".to_string()),
                                })
                                .unwrap();
                            break;
                        }

                        match serde_json::from_str::<ChatCompletionResponse>(json_str) {
                            Ok(msg) => {
                                let choice = &msg.choices[0];
                                if let Some(delta) = &choice.delta {
                                    if let Some(text) = &delta.content {
                                        on_event
                                            .send(StreamEvent::Delta {
                                                content: Some(text.clone()),
                                                tool_calls: None,
                                            })
                                            .unwrap();
                                    }
                                    if delta.content.is_none() && delta.tool_calls.is_some() {
                                        println!("TOOL CALL BOOM!!!!");
                                        if let Some(tool_calls) = &delta.tool_calls {
                                            let tool_names: Vec<String> = tool_calls
                                                .iter()
                                                .map(|e| e.function.name.clone())
                                                .collect();
                                            on_event
                                                .send(StreamEvent::Delta {
                                                    content: None,
                                                    tool_calls: Some(tool_names),
                                                })
                                                .unwrap();

                                            // if let Some(first_call) = tool_calls.get(0) {
                                            //     let tool_name = &first_call.function.name;
                                            //     if tool_name == "read_file" {
                                            //     }
                                            // }
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                eprintln!("{}", e)
                            }
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("stream error: {}", e);
                break;
            }
        }
    }

    Ok(())

    // let body: ChatCompletionResponse = res
    //     .json()
    //     .await
    //     .map_err(|err| format!("Response error: {}", err))?;
    //
    // let content = &body
    //     .choices
    //     .into_iter()
    //     .next()
    //     .and_then(|choice| choice.message.content)
    //     .ok_or("No content in response")?;
    //
    // Ok(content.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_project_dir,
            call_llm,
            fuzzy_search
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
