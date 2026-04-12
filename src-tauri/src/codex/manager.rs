use std::collections::HashMap;

use super::process::CodexChild;

/// Manages running Codex CLI subprocess instances, keyed by employee_id.
pub struct CodexManager {
    processes: HashMap<String, CodexChild>,
}

impl CodexManager {
    pub fn new() -> Self {
        Self {
            processes: HashMap::new(),
        }
    }

    pub fn add_process(&mut self, employee_id: String, child: CodexChild) {
        self.processes.insert(employee_id, child);
    }

    pub fn remove_process(&mut self, employee_id: &str) -> Option<CodexChild> {
        self.processes.remove(employee_id)
    }

    pub fn is_running(&self, employee_id: &str) -> bool {
        self.processes.contains_key(employee_id)
    }
}
