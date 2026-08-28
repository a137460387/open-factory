// 正式构建（release）隐藏 Windows 控制台窗口；dev / tauri dev 保留控制台日志输出
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Err(e) = open_factory_desktop_lib::run() {
        eprintln!("Application error: {e}");
        std::process::exit(1);
    }
}
