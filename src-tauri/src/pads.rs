// Controllers on Linux (P20). WebKitGTK has no Gamepad API, so the app reads controllers
// with gilrs and sends the page every change as a "pads" event, in the Gamepad API's
// standard layout (src/ui/native-pads.ts).
use gilrs::{Axis, Button, Gilrs};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

// The standard layout's button order.
const BUTTONS: [Button; 17] = [
  Button::South,
  Button::East,
  Button::West,
  Button::North,
  Button::LeftTrigger,
  Button::RightTrigger,
  Button::LeftTrigger2,
  Button::RightTrigger2,
  Button::Select,
  Button::Start,
  Button::LeftThumb,
  Button::RightThumb,
  Button::DPadUp,
  Button::DPadDown,
  Button::DPadLeft,
  Button::DPadRight,
  Button::Mode,
];

#[derive(Serialize, Clone)]
struct Pad {
  index: usize,
  id: String,
  buttons: Vec<f32>,
  axes: [f32; 4],
}

fn snapshot(gilrs: &Gilrs) -> Vec<Pad> {
  gilrs
    .gamepads()
    .filter(|(_, pad)| pad.is_connected())
    .map(|(id, pad)| Pad {
      index: id.into(),
      id: pad.name().to_string(),
      buttons: BUTTONS
        .iter()
        .map(|&b| if pad.is_pressed(b) { 1.0 } else { 0.0 })
        .collect(),
      // gilrs counts up as positive; the standard layout counts down as positive.
      axes: [
        pad.value(Axis::LeftStickX),
        -pad.value(Axis::LeftStickY),
        pad.value(Axis::RightStickX),
        -pad.value(Axis::RightStickY),
      ],
    })
    .collect()
}

pub fn start(app: AppHandle) {
  std::thread::spawn(move || {
    let mut gilrs = match Gilrs::new() {
      Ok(gilrs) => gilrs,
      Err(err) => {
        eprintln!("PADS off: {err}");
        return;
      }
    };
    loop {
      let mut changed = false;
      while gilrs.next_event().is_some() {
        changed = true;
      }
      if changed {
        let _ = app.emit("pads", snapshot(&gilrs));
      }
      std::thread::sleep(std::time::Duration::from_millis(8));
    }
  });
}
