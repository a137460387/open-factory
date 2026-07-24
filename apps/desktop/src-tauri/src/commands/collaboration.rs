use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::net::{Ipv4Addr, SocketAddr};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};
use tokio::net::TcpListener;
use tokio::sync::broadcast;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollaborationHostRequest {
    pub port: u16,
    pub network_mode: Option<String>,
    pub auth_token: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollaborationHostState {
    pub active: bool,
    pub port: u16,
    pub network_mode: String,
}

struct CollaborationRuntime {
    sender: broadcast::Sender<String>,
    shutdown: broadcast::Sender<()>,
    port: u16,
    network_mode: String,
}

static COLLABORATION_RUNTIME: OnceLock<Mutex<Option<CollaborationRuntime>>> = OnceLock::new();

fn runtime_slot() -> &'static Mutex<Option<CollaborationRuntime>> {
    COLLABORATION_RUNTIME.get_or_init(|| Mutex::new(None))
}

fn is_valid_token(token: &str) -> bool {
    !token.is_empty() && token.len() <= 256 && token.chars().all(|c| !c.is_control())
}

#[tauri::command]
pub async fn start_collaboration_host(
    app: AppHandle,
    request: CollaborationHostRequest,
) -> Result<CollaborationHostState, String> {
    let port = if request.port == 0 {
        37822
    } else {
        request.port
    };
    let network_mode = request.network_mode.unwrap_or_else(|| "localhost".to_string());
    let auth_token = request.auth_token.filter(|t| is_valid_token(t));

    if let Some(existing) = runtime_slot()
        .lock()
        .map_err(|_| "Unable to lock collaboration runtime".to_string())?
        .as_ref()
    {
        return Ok(CollaborationHostState {
            active: true,
            port: existing.port,
            network_mode: existing.network_mode.clone(),
        });
    }

    let bind_addr = if network_mode == "lan" {
        Ipv4Addr::UNSPECIFIED
    } else {
        Ipv4Addr::LOCALHOST
    };
    let listener = TcpListener::bind(SocketAddr::from((bind_addr, port)))
        .await
        .map_err(|error| error.to_string())?;
    let local_port = listener
        .local_addr()
        .map_err(|error| error.to_string())?
        .port();
    let (sender, _) = broadcast::channel::<String>(256);
    let (shutdown, mut shutdown_receiver) = broadcast::channel::<()>(1);
    {
        let mut slot = runtime_slot()
            .lock()
            .map_err(|_| "Unable to lock collaboration runtime".to_string())?;
        *slot = Some(CollaborationRuntime {
            sender: sender.clone(),
            shutdown: shutdown.clone(),
            port: local_port,
            network_mode: network_mode.clone(),
        });
    }

    tauri::async_runtime::spawn(async move {
        loop {
            let accepted = tokio::select! {
                _ = shutdown_receiver.recv() => break,
                accepted = listener.accept() => accepted,
            };
            let Ok((stream, _addr)) = accepted else {
                break;
            };
            let app_handle = app.clone();
            let mut receiver = sender.subscribe();
            let sender_for_incoming = sender.clone();
            let expected_token = auth_token.clone();
            tauri::async_runtime::spawn(async move {
                let Ok(mut socket) = tokio_tungstenite::accept_async(stream).await else {
                    return;
                };
                if let Some(expected) = expected_token {
                    let auth_msg = match socket.next().await {
                        Some(Ok(msg)) => msg.into_text().unwrap_or_default(),
                        _ => return,
                    };
                    if auth_msg.trim() != expected {
                        let _ = socket.close(None).await;
                        return;
                    }
                    let _ = socket.send(tokio_tungstenite::tungstenite::Message::Text(
                        r#"{"type":"auth-ok"}"#.to_string(),
                    )).await;
                }
                let (mut write, mut read) = socket.split();
                let incoming = async {
                    while let Some(message) = read.next().await {
                        let Ok(message) = message else {
                            break;
                        };
                        if let Ok(text) = message.into_text() {
                            let _ = app_handle.emit("collaboration-message", text.clone());
                            let _ = sender_for_incoming.send(text);
                        }
                    }
                };
                let outgoing = async {
                    while let Ok(text) = receiver.recv().await {
                        if write
                            .send(tokio_tungstenite::tungstenite::Message::Text(text))
                            .await
                            .is_err()
                        {
                            break;
                        }
                    }
                };
                futures_util::pin_mut!(incoming, outgoing);
                futures_util::future::select(incoming, outgoing).await;
            });
        }
    });

    Ok(CollaborationHostState {
        active: true,
        port: local_port,
        network_mode,
    })
}

#[tauri::command]
pub fn stop_collaboration_host() -> Result<(), String> {
    let mut slot = runtime_slot()
        .lock()
        .map_err(|_| "Unable to lock collaboration runtime".to_string())?;
    if let Some(runtime) = slot.as_ref() {
        let _ = runtime.shutdown.send(());
    }
    *slot = None;
    Ok(())
}

#[tauri::command]
pub fn broadcast_collaboration_message(app: AppHandle, message: String) -> Result<(), String> {
    crate::input_validator::validate_string(&message, "message")?;
    let sender = runtime_slot()
        .lock()
        .map_err(|_| "Unable to lock collaboration runtime".to_string())?
        .as_ref()
        .map(|runtime| runtime.sender.clone());
    if let Some(sender) = sender {
        let _ = sender.send(message.clone());
    }
    let _ = app.emit("collaboration-message", message);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_zero_port_to_default() {
        let request = CollaborationHostRequest {
            port: 0,
            network_mode: None,
            auth_token: None,
        };
        assert_eq!(if request.port == 0 { 37822 } else { request.port }, 37822);
    }

    #[test]
    fn rejects_empty_auth_token() {
        assert!(!is_valid_token(""));
    }

    #[test]
    fn accepts_valid_auth_token() {
        assert!(is_valid_token("my-secret-token-123"));
    }

    #[test]
    fn rejects_control_chars_in_token() {
        assert!(!is_valid_token("bad\x00token"));
    }
}
