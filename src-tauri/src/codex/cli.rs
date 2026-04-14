use std::env;
use std::ffi::OsString;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::Stdio;

use tokio::process::Command;

const CODEX_PATH_ENV_VARS: &[&str] = &["CODEX_CLI_PATH", "CODEX_PATH"];
const NODE_PATH_ENV_VARS: &[&str] = &["CODEX_NODE_PATH"];

#[cfg(not(target_os = "windows"))]
const COMMON_UNIX_DIRS: &[&str] = &["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];
#[cfg(not(target_os = "windows"))]
const HOME_RELATIVE_DIRS: &[&str] = &[
    ".local/bin",
    "bin",
    ".npm-global/bin",
    "Library/pnpm",
    ".volta/bin",
    ".yarn/bin",
    ".bun/bin",
    ".asdf/shims",
];

pub async fn new_codex_command() -> Result<Command, String> {
    let codex_path = resolve_executable("codex", CODEX_PATH_ENV_VARS).await?;
    let launch_mode = determine_launch_mode(&codex_path).await?;

    Ok(match launch_mode {
        CodexLaunchMode::Direct { executable, path_dirs } => {
            let mut command = Command::new(&executable);
            apply_augmented_path(&mut command, path_dirs);
            command
        }
        CodexLaunchMode::ViaNode {
            node_executable,
            script_path,
            path_dirs,
        } => {
            let mut command = Command::new(&node_executable);
            command.arg(&script_path);
            apply_augmented_path(&mut command, path_dirs);
            command
        }
    })
}

enum CodexLaunchMode {
    Direct {
        executable: PathBuf,
        path_dirs: Vec<PathBuf>,
    },
    ViaNode {
        node_executable: PathBuf,
        script_path: PathBuf,
        path_dirs: Vec<PathBuf>,
    },
}

async fn determine_launch_mode(codex_path: &Path) -> Result<CodexLaunchMode, String> {
    let codex_dir = codex_path.parent().map(Path::to_path_buf);

    if script_requires_env_node(codex_path) {
        let node_executable = resolve_executable("node", NODE_PATH_ENV_VARS).await?;
        let node_dir = node_executable.parent().map(Path::to_path_buf);
        return Ok(CodexLaunchMode::ViaNode {
            node_executable,
            script_path: codex_path.to_path_buf(),
            path_dirs: unique_dirs([node_dir, codex_dir]),
        });
    }

    Ok(CodexLaunchMode::Direct {
        executable: codex_path.to_path_buf(),
        path_dirs: unique_dirs([codex_dir]),
    })
}

async fn resolve_executable(binary_name: &str, env_vars: &[&str]) -> Result<PathBuf, String> {
    if let Some(path) = resolve_from_env_override(env_vars) {
        return Ok(path);
    }

    if let Some(path) = resolve_from_known_paths(binary_name) {
        return Ok(path);
    }

    if let Some(path) = resolve_from_shell(binary_name).await {
        return Ok(path);
    }

    Err(format!(
        "未找到 {binary_name} 可执行文件。请确认已安装并且在终端中执行 `{binary_name} --version` 可以成功。"
    ))
}

fn resolve_from_env_override(env_vars: &[&str]) -> Option<PathBuf> {
    env_vars.iter().find_map(|key| {
        env::var_os(key)
            .map(PathBuf::from)
            .filter(|path| is_executable_file(path))
    })
}

fn resolve_from_known_paths(binary_name: &str) -> Option<PathBuf> {
    search_dirs().into_iter().find_map(|dir| {
        candidate_binary_names(binary_name)
            .into_iter()
            .map(|name| dir.join(name))
            .find(|path| is_executable_file(path))
    })
}

fn search_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Some(path_var) = env::var_os("PATH") {
        for dir in env::split_paths(&path_var) {
            push_unique_dir(&mut dirs, dir);
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Some(home) = env::var_os("HOME").map(PathBuf::from) {
            for dir in HOME_RELATIVE_DIRS {
                push_unique_dir(&mut dirs, home.join(dir));
            }

            push_nvm_dirs(&mut dirs, &home);
            push_fnm_dirs(&mut dirs, &home);
        }

        for dir in COMMON_UNIX_DIRS {
            push_unique_dir(&mut dirs, PathBuf::from(dir));
        }
    }

    dirs
}

#[cfg(not(target_os = "windows"))]
fn push_nvm_dirs(dirs: &mut Vec<PathBuf>, home: &Path) {
    let versions_dir = home.join(".nvm/versions/node");
    let Ok(entries) = fs::read_dir(versions_dir) else {
        return;
    };

    for entry in entries.flatten() {
        push_unique_dir(dirs, entry.path().join("bin"));
    }
}

#[cfg(not(target_os = "windows"))]
fn push_fnm_dirs(dirs: &mut Vec<PathBuf>, home: &Path) {
    let versions_dir = home.join(".local/share/fnm/node-versions");
    let Ok(entries) = fs::read_dir(versions_dir) else {
        return;
    };

    for entry in entries.flatten() {
        push_unique_dir(dirs, entry.path().join("installation/bin"));
    }
}

fn push_unique_dir(dirs: &mut Vec<PathBuf>, dir: PathBuf) {
    if !dir.as_os_str().is_empty() && !dirs.iter().any(|existing| existing == &dir) {
        dirs.push(dir);
    }
}

fn candidate_binary_names(binary_name: &str) -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        vec![
            format!("{binary_name}.exe"),
            format!("{binary_name}.cmd"),
            format!("{binary_name}.bat"),
            binary_name.to_string(),
        ]
    }

    #[cfg(not(target_os = "windows"))]
    {
        vec![binary_name.to_string()]
    }
}

async fn resolve_from_shell(binary_name: &str) -> Option<PathBuf> {
    let lookups = [
        ("/bin/zsh", vec!["-lc".to_string(), format!("whence -p {binary_name}")]),
        ("/bin/zsh", vec!["-ilc".to_string(), format!("whence -p {binary_name}")]),
        ("/bin/bash", vec!["-lc".to_string(), format!("type -P {binary_name}")]),
        ("/bin/bash", vec!["-ilc".to_string(), format!("type -P {binary_name}")]),
        ("/bin/sh", vec!["-lc".to_string(), format!("command -v {binary_name}")]),
    ];

    for (program, args) in lookups {
        if !Path::new(program).exists() {
            continue;
        }

        let output = match Command::new(program)
            .args(args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output()
            .await
        {
            Ok(output) => output,
            Err(_) => continue,
        };

        if !output.status.success() {
            continue;
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Some(path) = parse_executable_path_from_output(&stdout) {
            return Some(path);
        }
    }

    None
}

fn script_requires_env_node(path: &Path) -> bool {
    let Ok(file) = File::open(path) else {
        return false;
    };
    let mut reader = BufReader::new(file);
    let mut first_line = String::new();
    if reader.read_line(&mut first_line).is_err() {
        return false;
    }

    let shebang = first_line.trim();
    shebang.starts_with("#!")
        && shebang.contains("/usr/bin/env")
        && shebang.split_whitespace().any(|token| token == "node")
}

fn parse_executable_path_from_output(output: &str) -> Option<PathBuf> {
    output
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .rev()
        .map(PathBuf::from)
        .find(|path| is_executable_file(path))
}

fn apply_augmented_path(command: &mut Command, path_dirs: Vec<PathBuf>) {
    let mut combined = Vec::new();
    for dir in path_dirs {
        push_unique_dir(&mut combined, dir);
    }

    if let Some(existing_path) = env::var_os("PATH") {
        for dir in env::split_paths(&existing_path) {
            push_unique_dir(&mut combined, dir);
        }
    }

    if let Ok(joined) = join_paths_lossy(&combined) {
        command.env("PATH", joined);
    }
}

fn join_paths_lossy(paths: &[PathBuf]) -> Result<OsString, env::JoinPathsError> {
    env::join_paths(paths.iter().map(PathBuf::as_path))
}

fn unique_dirs<I>(dirs: I) -> Vec<PathBuf>
where
    I: IntoIterator<Item = Option<PathBuf>>,
{
    let mut unique = Vec::new();
    for dir in dirs.into_iter().flatten() {
        push_unique_dir(&mut unique, dir);
    }
    unique
}

fn is_executable_file(path: &Path) -> bool {
    let Ok(metadata) = path.metadata() else {
        return false;
    };

    if !metadata.is_file() {
        return false;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }

    #[cfg(not(unix))]
    {
        true
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_executable_path_from_output, script_requires_env_node, unique_dirs};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn create_temp_dir() -> PathBuf {
        let base = std::env::temp_dir().join(format!(
            "codex-ai-cli-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("time drift")
                .as_nanos()
        ));
        fs::create_dir_all(&base).expect("create temp dir");
        base
    }

    fn make_executable(path: &PathBuf, content: &str) {
        fs::write(path, content).expect("write temp executable");

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = fs::metadata(path).expect("metadata").permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(path, permissions).expect("chmod temp executable");
        }
    }

    #[test]
    fn shell_output_parser_uses_last_valid_executable_path() {
        let base = create_temp_dir();
        let executable = base.join("codex");
        make_executable(&executable, "#!/bin/sh\n");

        let output = format!(
            "Loading shell profile...\n{}\nnot-a-path\n{}\n",
            executable.display(),
            executable.display()
        );

        let resolved = parse_executable_path_from_output(&output);
        assert_eq!(resolved, Some(executable));

        fs::remove_dir_all(base).expect("remove temp dir");
    }

    #[test]
    fn detects_env_node_shebang() {
        let base = create_temp_dir();
        let script = base.join("codex.js");
        make_executable(&script, "#!/usr/bin/env node\nconsole.log('ok');\n");

        assert!(script_requires_env_node(&script));

        fs::remove_dir_all(base).expect("remove temp dir");
    }

    #[test]
    fn unique_dirs_keeps_first_occurrence_only() {
        let base = create_temp_dir();
        let first = base.join("first");
        let second = base.join("second");
        fs::create_dir_all(&first).expect("create first dir");
        fs::create_dir_all(&second).expect("create second dir");

        let dirs = unique_dirs([
            Some(first.clone()),
            Some(second.clone()),
            Some(first.clone()),
            None,
        ]);

        assert_eq!(dirs, vec![first, second]);

        fs::remove_dir_all(base).expect("remove temp dir");
    }
}
