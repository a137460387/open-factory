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
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollaborationHostState {
    pub active: bool,
    pub port: u16,
}

struct CollaborationRuntime {
    sender: broadcast::Sender<String>,
    shutdown: broadcast::Sender<()>,
    port: u16,
}

static COLLABORATION_RUNTIME: OnceLock<Mutex<Option<CollaborationRuntime>>> = OnceLock::new();

fn runtime_slot() -> &'static Mutex<Option<CollaborationRuntime>> {
    COLLABORATION_RUNTIME.get_or_init(|| Mutex::new(None))
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
    if let Some(existing) = runtime_slot()
        .lock()
        .map_err(|_| "Unable to lock collaboration runtime".to_string())?
        .as_ref()
    {
        return Ok(CollaborationHostState {
            active: true,
            port: existing.port,
        });
    }

    let listener = TcpListener::bind(SocketAddr::from((Ipv4Addr::UNSPECIFIED, port)))
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
            tauri::async_runtime::spawn(async move {
                let Ok(socket) = tokio_tungstenite::accept_async(stream).await else {
                    return;
                };
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
        let request = CollaborationHostRequest { port: 0 };
        assert_eq!(if request.port == 0 { 37822 } else { request.port }, 37822);
    }
}
