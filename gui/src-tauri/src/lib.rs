use std::env;

use git2::Repository;
use serde::Deserialize;
use serde_json::json;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
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

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    id: String,
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: Message,
    finish_reason: Option<String>,
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

const OPENROUTER_CHAT_URL: &str = "https://openrouter.ai/api/v1/chat/completions";

#[tauri::command]
async fn call_llm(prompt: String) -> Result<String, String> {
    let client = reqwest::Client::new();

    let system_prompt = json!({
    "role": "system",
        "content": "You are an assistant at Senior Software Engineer level"
    });

    let user_prompt = json!({"role": "user", "content": prompt});

    let payload = json!({
        "model" : "google/gemini-2.5-pro-preview-03-25",
        "messages": [system_prompt, user_prompt]
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

    let body: ChatCompletionResponse = res
        .json()
        .await
        .map_err(|err| format!("Response error: {}", err))?;

    let content = &body
        .choices
        .into_iter()
        .next()
        .and_then(|choice| choice.message.content)
        .ok_or("No content in response")?;

    Ok(content.to_string())
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
