use std::env;

use git2::Repository;

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

// p := ORPayload{Model: "google/gemini-2.5-pro-preview-03-25", Messages: []ORMessage{
// 	{
//
// 		Role: "system", Content: "You are an assistant at Senior Software Engineer level",
// 	},
// 	{
// 		Role: "user", Content: prompt,
// 	},
// }}
//
// payload, err := json.Marshal(p)
// if err != nil {
// 	log.Fatal(err)
// }
//
// req, err := http.NewRequest("POST", openrouterUrl, bytes.NewBuffer(payload))
// if err != nil {
// 	log.Fatal(err)
// }
// req.Header.Add("Authorization", "Bearer "+os.Getenv("OPENROUTER_API_KEY"))
// req.Header.Add("Content-Type", "application/json")
//
// res, err := client.Do(req)
// if err != nil {
// 	log.Fatal(err)
// }
// defer res.Body.Close()
//
// if res.StatusCode != 200 {
// 	b, _ := io.ReadAll(res.Body)
// 	log.Fatal("Wrong response shape", string(b))
// }
//
// var response ORResponse
// if err := json.NewDecoder(res.Body).Decode(&response); err != nil {
// 	log.Fatal(err)
// }
//
// return responseMsg(response)

const OPENROUTER_CHAT_URL: &str = "https://openrouter.ai/api/v1/chat/completions";

#[tauri::command]
async fn call_llm(prompt: String) -> String {
    prompt
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
