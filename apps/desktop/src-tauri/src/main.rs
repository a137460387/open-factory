fn main() {
    if let Err(e) = open_factory_desktop_lib::run() {
        eprintln!("Application error: {e}");
        std::process::exit(1);
    }
}
