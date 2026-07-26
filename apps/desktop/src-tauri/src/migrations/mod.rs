use std::fs;
use std::path::PathBuf;

/// Trait for versioned database migrations.
pub trait Migration: Send + Sync {
    /// Returns the migration version number (monotonically increasing).
    fn version(&self) -> u32;
    /// Returns a human-readable name for this migration.
    fn name(&self) -> &str;
    /// Apply the migration.
    fn up(&self) -> Result<(), String>;
    /// Rollback the migration.
    fn down(&self) -> Result<(), String>;
}

/// Tracks which migrations have been applied and runs pending ones.
pub struct MigrationRunner {
    migrations: Vec<Box<dyn Migration>>,
    state_path: PathBuf,
}

impl MigrationRunner {
    /// Creates a new runner that stores migration state at `data_dir/.migrations`.
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            migrations: Vec::new(),
            state_path: data_dir.join(".migrations"),
        }
    }

    /// Register a migration.
    pub fn add(&mut self, migration: Box<dyn Migration>) {
        self.migrations.push(migration);
    }

    /// Returns the set of already-applied version numbers.
    fn applied_versions(&self) -> Vec<u32> {
        fs::read_to_string(&self.state_path)
            .ok()
            .map(|content| {
                content
                    .lines()
                    .filter_map(|line| line.trim().parse::<u32>().ok())
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Persist a newly-applied version number.
    fn record_applied(&self, version: u32) -> Result<(), String> {
        let mut versions = self.applied_versions();
        if !versions.contains(&version) {
            versions.push(version);
            versions.sort();
        }
        let content = versions
            .iter()
            .map(|v| v.to_string())
            .collect::<Vec<_>>()
            .join("\n");
        if let Some(parent) = self.state_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("create migration dir: {e}"))?;
        }
        fs::write(&self.state_path, content).map_err(|e| format!("write migration state: {e}"))
    }

    /// Run all pending migrations in version order. Returns the list of applied versions.
    pub fn run_pending(&self) -> Result<Vec<u32>, String> {
        let applied = self.applied_versions();
        let mut pending: Vec<&dyn Migration> = self
            .migrations
            .iter()
            .filter(|m| !applied.contains(&m.version()))
            .map(|m| m.as_ref())
            .collect();
        pending.sort_by_key(|m| m.version());

        let mut applied_now = Vec::new();
        for migration in pending {
            migration.up()?;
            self.record_applied(migration.version())?;
            applied_now.push(migration.version());
        }
        Ok(applied_now)
    }

    /// Returns the list of all registered migration versions and their applied status.
    pub fn status(&self) -> Vec<(u32, String, bool)> {
        let applied = self.applied_versions();
        let mut entries: Vec<_> = self
            .migrations
            .iter()
            .map(|m| (m.version(), m.name().to_string(), applied.contains(&m.version())))
            .collect();
        entries.sort_by_key(|e| e.0);
        entries
    }
}

// ---------------------------------------------------------------------------
// Sample migration: 001_initial
// ---------------------------------------------------------------------------

pub struct InitialMigration;

impl Migration for InitialMigration {
    fn version(&self) -> u32 {
        1
    }

    fn name(&self) -> &str {
        "001_initial"
    }

    fn up(&self) -> Result<(), String> {
        // Placeholder — no schema changes yet.
        Ok(())
    }

    fn down(&self) -> Result<(), String> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn runs_pending_and_records_state() {
        let dir = tempfile::tempdir().unwrap();
        let runner_path = dir.path().join(".migrations");
        let mut runner = MigrationRunner::new(dir.path().to_path_buf());
        runner.add(Box::new(InitialMigration));

        let applied = runner.run_pending().unwrap();
        assert_eq!(applied, vec![1]);

        let state = fs::read_to_string(&runner_path).unwrap();
        assert_eq!(state.trim(), "1");

        // Running again should be a no-op.
        let applied2 = runner.run_pending().unwrap();
        assert!(applied2.is_empty());
    }

    #[test]
    fn status_reports_correctly() {
        let dir = tempfile::tempdir().unwrap();
        let mut runner = MigrationRunner::new(dir.path().to_path_buf());
        runner.add(Box::new(InitialMigration));

        let status = runner.status();
        assert_eq!(status.len(), 1);
        assert_eq!(status[0].0, 1);
        assert!(!status[0].2); // not yet applied

        runner.run_pending().unwrap();
        let status = runner.status();
        assert!(status[0].2); // now applied
    }
}
