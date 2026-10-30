// The desktop app wraps the web build in dist/ (ADR-0001). One extra: a measurement run.
// TTT_MEASURE=high or TTT_MEASURE=low opens a fixed Vanishing scene, measures 240 frames
// while the camera moves, prints one "MEASURE" line and quits. TTT_MEASURE=search times
// the line games' search in its worker (TTT-4.1.3, TTT-4.1.4) the same way. The title's
// Quit button closes the app (TTT-4.1.6). The Steam build (feature `steam`, TTT-4.3.2)
// connects to the Steam client before the window opens and prints one "STEAM" line.
// On Linux the app reads controllers for the page (P20).
use tauri::{WebviewUrl, WebviewWindowBuilder};

#[cfg(target_os = "linux")]
mod pads;

#[cfg(feature = "steam")]
mod steam {
  // Valve's test app (Spacewar) until the game has its own App ID (TTT-5.1).
  const APP_ID: u32 = 480;

  // Before the web view exists, so the overlay can hook its rendering. Without the Steam
  // client the game still runs.
  pub fn start() {
    match steamworks::Client::init_app(APP_ID) {
      Ok(client) => {
        let utils = client.utils();
        println!(
          "STEAM app={} user={} overlay={} deck={}",
          utils.app_id().0,
          client.friends().name(),
          utils.is_overlay_enabled(),
          utils.is_steam_running_on_steam_deck(),
        );
        // Steam queues callbacks until they are run; the thread keeps the client alive.
        std::thread::spawn(move || loop {
          client.run_callbacks();
          std::thread::sleep(std::time::Duration::from_millis(100));
        });
      }
      Err(err) => println!("STEAM off: {err}"),
    }
  }
}

#[tauri::command]
fn report(app: tauri::AppHandle, msg: String) {
  println!("MEASURE {msg}");
  app.exit(0);
}

#[tauri::command]
fn quit(app: tauri::AppHandle) {
  app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  #[cfg(feature = "steam")]
  steam::start();
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![report, quit])
    .setup(|app| {
      let page = match std::env::var("TTT_MEASURE").as_deref() {
        Ok(gfx @ ("high" | "low")) => format!("index.html?scene=vanishing-mid&orbit=1&gfx={gfx}"),
        Ok("search") => "index.html?search=1&gfx=2d".to_string(),
        _ => "index.html".to_string(),
      };
      let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App(page.into()))
        .title("Noughty Crosses")
        .inner_size(1280.0, 800.0)
        .min_inner_size(640.0, 480.0)
        .build()?;
      window.set_focus()?;
      #[cfg(target_os = "linux")]
      pads::start(app.handle().clone());
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running the desktop app");
}
