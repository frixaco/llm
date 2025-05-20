use std::fs;
use std::path::PathBuf;
use std::{env, sync::Mutex};

use futures::StreamExt;
use git2::Repository;
use nucleo_matcher::{
    pattern::{CaseMatching, Normalization, Pattern},
    Config, Matcher,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{ipc::Channel, Manager, State};
use walkdir::{DirEntry, WalkDir};

struct AppData {
    project_dir: String,
}

#[tauri::command]
fn set_project_dir(path: String, state: State<'_, Mutex<AppData>>) {
    let mut state = state.lock().unwrap();
    state.project_dir = path;
    println!("Set project dir to: {}", state.project_dir);
}

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
fn fuzzy_search(search_term: String, state: State<'_, Mutex<AppData>>) -> Vec<String> {
    println!("search term: {}", search_term);

    let cwd = &state.lock().unwrap().project_dir;
    // let cwd = get_project_dir(None);
    // println!("cwd: {}", state.project_dir);

    let paths: Vec<String> = WalkDir::new(cwd)
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

// model: "qwen/qwen3-235b-a22b:nitro",
// model: "openai/gpt-4o-2024-11-20"),
// model: "openai/gpt-4.1-mini"),
// model: "google/gemini-2.5-pro-preview-05-06"),
// model: "anthropic/claude-3.7-sonnet"),
// model: "anthropic/claude-3.7-sonnet",

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
enum StreamEvent {
    #[serde(rename_all = "camelCase")]
    Started {},
    #[serde(rename_all = "camelCase")]
    Delta {
        role: Role,
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

#[derive(Serialize, Deserialize, Debug)]
struct ReadFileToolArgs {
    path: String,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ToolCall {
    id: String,
    #[serde(rename = "type")]
    type_field: String,
    function: FunctionCall,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct FunctionCall {
    name: String,
    arguments: String,
}

#[derive(Serialize, Deserialize)]
struct Usage {
    include: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
enum Role {
    System,
    User,
    Assistant,
    Tool,
    Developer,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ChatMessage {
    role: Role,
    content: String,
    tool_call_id: Option<String>,
    name: Option<String>,
    tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    stream: bool,
    tools: serde_json::Value,
    // tool_choice: TODO: @edit_tool - to force certain tools
    // usage: Option<Usage>,
    temperature: f32,
}

const OPENROUTER_CHAT_URL: &str = "https://openrouter.ai/api/v1/chat/completions";

async fn run_chat_completion(
    messages: &mut Vec<ChatMessage>,
    on_event: &Channel<StreamEvent>,
    cwd: String,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let openrouter_api_key: String = match env::var("OPENROUTER_API_KEY") {
        Ok(env) => env,
        Err(e) => return Err(e.to_string()),
    };

    let mut pending_tool_calls: Vec<ToolCall> = vec![];

    loop {
        println!("MESSAGES: {:?}", &messages);

        let payload = ChatCompletionRequest {
            model: "google/gemini-2.5-flash-preview:nitro".to_string(),
            messages: messages.clone(),
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

        let res = client
            .post(OPENROUTER_CHAT_URL)
            .header("Authorization", format!("Bearer {}", openrouter_api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|err| format!("Request error: {}", err))?;

        let mut stream = res.bytes_stream();
        let mut done = false;

        let mut assistant_response = String::new();
        let mut assistant_tool_calls: Option<Vec<ToolCall>> = None;

        while let Some(item) = stream.next().await {
            match item {
                Ok(bytes) => {
                    let chunk = String::from_utf8_lossy(&bytes);
                    for line in chunk.lines() {
                        if let Some(json_str) = line.strip_prefix("data: ") {
                            if json_str == "[DONE]" {
                                println!("KINDA DONE");
                                done = true;
                                break;
                            }

                            match serde_json::from_str::<ChatCompletionResponse>(json_str) {
                                Ok(msg) => {
                                    let choice = &msg.choices[0];
                                    println!("CHOICE: {:#?}", &choice);
                                    if let Some(delta) = &choice.delta {
                                        if let Some(text) = &delta.content {
                                            assistant_response.push_str(text);
                                            on_event
                                                .send(StreamEvent::Delta {
                                                    role: Role::Assistant,
                                                    content: Some(text.clone()),
                                                    tool_calls: None,
                                                })
                                                .unwrap();
                                        }
                                        if delta.content.is_none() && delta.tool_calls.is_some() {
                                            if let Some(tool_calls) = &delta.tool_calls {
                                                assistant_tool_calls = Some(tool_calls.clone());

                                                for call in tool_calls.iter().cloned() {
                                                    pending_tool_calls.push(call);
                                                    println!(
                                                        "TOOL CALL DETECTED: {:#?}",
                                                        &pending_tool_calls
                                                    );
                                                }
                                            }
                                        }
                                    }

                                    if choice.finish_reason.is_some() {
                                        messages.push(ChatMessage {
                                            role: Role::Assistant,
                                            content: assistant_response.clone(),
                                            tool_call_id: None,
                                            name: None,
                                            tool_calls: assistant_tool_calls.clone(),
                                        });
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

        if !pending_tool_calls.is_empty() {
            for tool_call in pending_tool_calls.drain(..) {
                let ToolCall {
                    id: tool_id,
                    function:
                        FunctionCall {
                            arguments: tool_args,
                            name: tool_name,
                            ..
                        },
                    ..
                } = tool_call;

                on_event
                    .send(StreamEvent::Delta {
                        role: Role::Tool,
                        content: None,
                        tool_calls: Some(vec![tool_name.to_string()]),
                    })
                    .unwrap();

                println!("TOOL CALLING: {}", &tool_name);

                let mut tool_message = ChatMessage {
                    role: Role::Tool,
                    tool_call_id: Some(tool_id.to_string()),
                    name: Some(tool_name.to_string()),
                    content: "".to_string(),
                    tool_calls: None,
                };

                if tool_name == "read_file" {
                    let args = match serde_json::from_str::<ReadFileToolArgs>(&tool_args) {
                        Ok(a) => a,
                        Err(e) => ReadFileToolArgs {
                            path: e.to_string(),
                        },
                    };

                    let content = read_file(&cwd, args);

                    tool_message.content = serde_json::to_string(&json!({
                        "textContent": content
                    }))
                    .unwrap();
                    println!("FINISHED READING");
                }

                on_event
                    .send(StreamEvent::Delta {
                        role: Role::Tool,
                        content: None,
                        tool_calls: None,
                    })
                    .unwrap();
                messages.push(tool_message);
            }
            continue;
        }

        if done && pending_tool_calls.is_empty() {
            println!("DONE - DONE");
            break;
        }
    }

    Ok(())
}

fn read_file(cwd: &String, args: ReadFileToolArgs) -> Result<String, String> {
    match fs::read_to_string(format!("{}/{}", cwd, args.path)) {
        Ok(v) => Ok(v),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn call_llm(
    mut messages: Vec<ChatMessage>,
    on_event: Channel<StreamEvent>,
    state: State<'_, Mutex<AppData>>,
) -> Result<(), String> {
    on_event.send(StreamEvent::Started {}).unwrap();

    let cwd = state.lock().unwrap().project_dir.clone();

    let result = run_chat_completion(&mut messages, &on_event, cwd).await;

    on_event
        .send(StreamEvent::Finished {
            full_response: Some("done".to_string()),
        })
        .unwrap();

    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(Mutex::new(AppData {
                project_dir: get_project_dir(None),
            }));
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            set_project_dir,
            call_llm,
            fuzzy_search
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
