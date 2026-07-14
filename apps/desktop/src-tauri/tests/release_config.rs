use serde_json::Value;

fn tauri_config() -> Value {
    serde_json::from_str(include_str!("../tauri.conf.json")).expect("tauri.conf.json parses")
}

#[test]
fn updater_endpoint_is_configured_for_releases() {
    let config = tauri_config();
    assert_eq!(
        config["plugins"]["updater"]["endpoints"][0],
        "https://github.com/a137460387/open-factory/releases/latest/download/latest.json"
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

#[test]
fn windows_bundle_targets_include_msi_and_nsis() {
    let config = tauri_config();
    let targets = config["bundle"]["targets"]
        .as_array()
        .expect("bundle targets array");

    assert!(targets.iter().any(|value| value == "msi"));
    assert!(targets.iter().any(|value| value == "nsis"));
}
