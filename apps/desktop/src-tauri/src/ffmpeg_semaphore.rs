//! FFmpeg 子进程并发信号量——Rust 侧兜底限流（H2 方案 B）。
//!
//! TS 侧已有两级池限流（backgroundMediaPool 上限 4、uiFeedbackPool 固定 3），
//! 但如果某个新增入口忘记接池而失控，Rust 侧会无差别执行所有 spawn 请求。
//! 本模块提供全局信号量作为最后一道防线，阈值 6（略宽于 TS 侧合计上限）。
//!
//! 实现策略：`try_acquire_owned()`（非阻塞）。原因：Tauri 2 的同步 command
//! 在主/UI 线程上执行（从 wry IPC 回调 → on_message → run_invoke_handler 全程
//! 无 spawn_blocking 包装），阻塞等待会冻结 UI 并连锁阻塞所有 command 调用。
//! 因此 permit 拿不到时立即返回明确错误，不等待。

use std::sync::OnceLock;
use tokio::sync::Semaphore;

/// 全局信号量阈值：最多 6 个 FFmpeg 子进程同时运行。
///
/// TS 侧 backgroundMediaPool 上限 4 + uiFeedbackPool 固定 3 = 7，
/// Rust 侧兜底设 6，略紧于 TS 合计上限但留有余量——正常情况下不会触发。
const FFMPEG_SEMAPHORE_LIMIT: usize = 6;

static FFMPEG_SEMAPHORE: OnceLock<Semaphore> = OnceLock::new();

/// 获取全局 FFmpeg 信号量的静态引用。
fn ffmpeg_semaphore() -> &'static Semaphore {
    FFMPEG_SEMAPHORE.get_or_init(|| Semaphore::new(FFMPEG_SEMAPHORE_LIMIT))
}

/// 尝试获取一个 FFmpeg 子进程 permit。
///
/// 成功时返回一个 `OwnedSemaphorePermit`，其 `Drop` 实现会自动释放 permit
/// （包括 panic 场景）。失败时返回包含明确提示的错误字符串。
///
/// 这是一个非阻塞调用——拿不到 permit 立即返回 `Err`，不会在主线程上
/// 等待，从而避免 UI 冻结和 command 调用连锁阻塞。
pub fn try_acquire_ffmpeg_permit() -> Result<tokio::sync::OwnedSemaphorePermit, String> {
    match ffmpeg_semaphore().try_acquire_owned() {
        Ok(permit) => Ok(permit),
        Err(_) => Err(format!(
            "当前并发 FFmpeg 操作已达上限（{}），请稍后重试。如果持续出现此错误，请检查是否有新的媒体处理入口未接入 TS 侧限流池。",
            FFMPEG_SEMAPHORE_LIMIT
        )),
    }
}

/// 当前可用的 permit 数量（主要用于测试和诊断）。
pub fn available_permits() -> usize {
    ffmpeg_semaphore().available_permits()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::{Child, Command};
    use std::thread;
    use std::time::Duration;

    /// 在测试间串行化信号量操作，避免并发测试互相干扰。
    /// 同时在获取锁时清空信号量（通过重新初始化——但 OnceLock 只初始化一次，
    /// 所以用 acquire-then-release 方式将 permit 恢复到满额）。
    static TEST_LOCK: OnceLock<std::sync::Mutex<()>> = OnceLock::new();

    fn test_guard() -> std::sync::MutexGuard<'static, ()> {
        TEST_LOCK
            .get_or_init(|| std::sync::Mutex::new(()))
            .lock()
            .expect("test lock")
    }

    /// 排空信号量到满额状态：持续 try_acquire 并立即 drop 直到获取失败，
    /// 再把已持有的全部释放。但更简单的方式：acquire 所有可用 permit 再全部释放。
    fn drain_and_release_all() {
        let mut permits: Vec<tokio::sync::OwnedSemaphorePermit> = Vec::new();
        while let Ok(p) = ffmpeg_semaphore().try_acquire_owned() {
            permits.push(p);
        }
        // 现在 permits 持有全部 permit，drop 后全部释放
        drop(permits);
    }

    #[cfg(windows)]
    fn spawn_long_running_child() -> Child {
        Command::new("cmd")
            .args(["/C", "ping -n 30 127.0.0.1 >NUL"])
            .spawn()
            .expect("spawn long running child")
    }

    #[cfg(not(windows))]
    fn spawn_long_running_child() -> Child {
        Command::new("sh")
            .args(["-c", "sleep 30"])
            .spawn()
            .expect("spawn long running child")
    }

    #[test]
    fn acquire_six_times_then_seventh_fails() {
        let _guard = test_guard();
        drain_and_release_all();

        let mut permits: Vec<tokio::sync::OwnedSemaphorePermit> = Vec::new();
        for i in 0..FFMPEG_SEMAPHORE_LIMIT {
            let permit = try_acquire_ffmpeg_permit()
                .unwrap_or_else(|_| panic!("acquire #{} should succeed", i + 1));
            permits.push(permit);
        }

        // 第 7 次应该失败
        let result = try_acquire_ffmpeg_permit();
        assert!(result.is_err(), "7th acquire should fail");
        let err_msg = result.unwrap_err();
        assert!(
            err_msg.contains("已达上限"),
            "error message should mention limit: {}",
            err_msg
        );

        drop(permits);
    }

    #[test]
    fn release_permit_allows_reacquire() {
        let _guard = test_guard();
        drain_and_release_all();

        let permit = try_acquire_ffmpeg_permit().expect("first acquire should succeed");
        assert_eq!(available_permits(), FFMPEG_SEMAPHORE_LIMIT - 1);

        drop(permit);
        assert_eq!(
            available_permits(),
            FFMPEG_SEMAPHORE_LIMIT,
            "available permits should be restored after drop"
        );

        let _reacquired = try_acquire_ffmpeg_permit().expect("reacquire should succeed after release");
    }

    #[test]
    fn permit_released_on_panic() {
        let _guard = test_guard();
        drain_and_release_all();

        let result = std::panic::catch_unwind(|| {
            let _permit = try_acquire_ffmpeg_permit().expect("acquire before panic");
            assert_eq!(available_permits(), FFMPEG_SEMAPHORE_LIMIT - 1);
            panic!("simulated failure inside scope holding permit");
        });
        assert!(result.is_err(), "panic should have been caught");

        // permit should be released even though the holder panicked
        assert_eq!(
            available_permits(),
            FFMPEG_SEMAPHORE_LIMIT,
            "permit must be released after panic via Drop"
        );
    }

    #[test]
    fn concurrent_spawn_does_not_exceed_limit() {
        let _guard = test_guard();
        drain_and_release_all();

        // Spawn 8 long-running child processes via threads that each try to
        // acquire a permit before spawning. At most FFMPEG_SEMAPHORE_LIMIT
        // should be alive simultaneously.
        let active_counter = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let max_observed = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let barrier = std::sync::Arc::new(std::sync::Barrier::new(8));

        let mut handles = Vec::new();
        for _ in 0..8 {
            let active = active_counter.clone();
            let max = max_observed.clone();
            let bar = barrier.clone();
            handles.push(thread::spawn(move || {
                bar.wait();
                let permit = match try_acquire_ffmpeg_permit() {
                    Ok(p) => p,
                    Err(_) => {
                        // 7th & 8th threads expected to be rejected — they
                        // don't spawn a child, just return.
                        return;
                    }
                };

                let mut child = spawn_long_running_child();
                let current = active.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
                max.fetch_max(current, std::sync::atomic::Ordering::SeqCst);

                // hold the permit + child alive briefly so the counter is observable
                thread::sleep(Duration::from_millis(200));

                active.fetch_sub(1, std::sync::atomic::Ordering::SeqCst);

                // explicitly kill the child so we don't leave orphaned processes
                let _ = child.kill();
                let _ = child.wait();
                drop(permit);
            }));
        }

        for h in handles {
            let _ = h.join();
        }

        let max = max_observed.load(std::sync::atomic::Ordering::SeqCst);
        assert!(
            max <= FFMPEG_SEMAPHORE_LIMIT,
            "concurrent FFmpeg children should not exceed {}, but observed {}",
            FFMPEG_SEMAPHORE_LIMIT,
            max
        );
        // With 8 threads and 6 permits, at least 2 should have been rejected.
        // max should be exactly 6 (all 6 permits acquired simultaneously).
        assert_eq!(
            max, FFMPEG_SEMAPHORE_LIMIT,
            "expected exactly {} concurrent children, observed {}",
            FFMPEG_SEMAPHORE_LIMIT, max
        );
    }
}
