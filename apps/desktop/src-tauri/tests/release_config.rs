use serde_json::Value;

fn tauri_config() -> Value {
    serde_json::from_str(include_str!("../tauri.conf.json")).expect("tauri.conf.json parses")
}

#[test]
fn updater_endpoint_is_configured_for_releases() {
    let config = tauri_config();
    assert_eq!(
        config["plugins"]["updater"]["endpoints"][0],
        "https://github.com/open-factory/open-factory/releases/latest/download/latest.json"
    );
    assert!(config["plugins"]["updater"]["pubkey"]
        .as_str()
        .is_some_and(|value| !value.trim().is_empty()));
}

#[test]
fn linux_deb_dependencies_include_webkit_and_ssl() {
    let config = tauri_config();
    let dependencies = config["bundle"]["linux"]["deb"]["depends"]
        .as_array()
        .expect("deb depends array");
    assert!(dependencies.iter().any(|value| value == "libwebkit2gtk-4.1-0"));
    assert!(dependencies.iter().any(|value| value == "libssl3"));
}
