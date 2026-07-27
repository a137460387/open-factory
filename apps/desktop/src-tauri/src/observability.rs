use tracing_subscriber::{fmt, EnvFilter};
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

/// Initialize tracing subscriber.
/// - Development: pretty-printed human-readable output
/// - Production (RUST_LOG set): JSON structured output
pub fn init_tracing() {
    let is_dev = cfg!(debug_assertions);

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        if is_dev {
            EnvFilter::new("debug")
        } else {
            EnvFilter::new("info")
        }
    });

    if is_dev {
        tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer().pretty())
            .init();
    } else {
        tracing_subscriber::registry()
            .with(filter)
            .with(fmt::layer().json())
            .init();
    }
}
