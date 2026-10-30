fn main() {
  // The Steam build finds libsteam_api.so beside its binary (tools/steam-lib.mjs puts it there).
  if std::env::var_os("CARGO_FEATURE_STEAM").is_some()
    && std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("linux")
  {
    println!("cargo:rustc-link-arg-bins=-Wl,-rpath,$ORIGIN");
  }
  tauri_build::build()
}
