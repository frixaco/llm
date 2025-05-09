use std::env;

use futures::StreamExt;
use git2::Repository;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::ipc::Channel;

#[tauri::command]
fn get_project_dir(path: Option<String>) -> String {
    let target_path = match path {
        Some(p) => p,
        None => env::current_dir()
            .map(|path| path.to_string_lossy().into_owned())
            .unwrap_or_else(|_| "Unknown".to_string()),
    };
    println!("Target path: {}", target_path.to_string());
    match Repository::discover(&target_path) {
        Ok(repo) => match repo.workdir() {
            Some(workdir) => match workdir.to_str() {
                Some(wd_path) => {
                    println!("Git dir: {}", wd_path);
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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
enum StreamEvent {
    #[serde(rename_all = "camelCase")]
    Started {
        prompt: String,
    },
    #[serde(rename_all = "camelCase")]
    Delta {
        content: String,
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

#[derive(Debug, Deserialize)]
struct Choice {
    message: Option<Message>,
    delta: Option<Delta>,
    finish_reason: Option<String>,
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
    // usage: Option<Usage>,
    // temperature:
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
        content: "You are a Senior Software Engineer with extensive knowledge in many programming languages, frameworks, libraries, design patterns and best practices."
    };

    let user_prompt = ChatMessage {
        role: &Role::User,
        content: &prompt,
    };

    // "model": "qwen/qwen3-235b-a22b:nitro",
    // "model": "openai/gpt-4o-2024-11-20"),
    // "model": "openai/gpt-4.1-mini"),
    // "model": "google/gemini-2.5-pro-preview-05-06"),
    // "model": "anthropic/claude-3.7-sonnet"),
    let payload = json!({
        "model": "google/gemini-2.5-flash-preview:nitro",
        "messages": [system_prompt, user_prompt],
        "stream": true,
    });

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
                                                content: text.clone(),
                                            })
                                            .unwrap();
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
        .invoke_handler(tauri::generate_handler![get_project_dir, call_llm])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
