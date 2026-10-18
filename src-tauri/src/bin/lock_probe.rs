use billzen_lib::acquire_instance_lock;
use std::path::PathBuf;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: lock_probe <dir> [hold_secs]");
        std::process::exit(2);
    }
    let dir = PathBuf::from(&args[1]);
    let hold_secs: u64 = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(0);

    match acquire_instance_lock(&dir) {
        Ok(lock) => {
            println!("ACQUIRED");
            if hold_secs > 0 {
                std::thread::sleep(std::time::Duration::from_secs(hold_secs));
            }
            drop(lock);
            println!("RELEASED");
        }
        Err(e) => {
            eprintln!("REJECTED: {}", e);
            std::process::exit(1);
        }
    }
}
