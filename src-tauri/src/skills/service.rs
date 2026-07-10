use std::{
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
};

use super::{
    parser::parse_metadata, ItemResult, Operation, OperationSummary, Outcome, SkillPaths,
    SkillRecord, SkillSource, SkillState,
};

pub trait Trash: Send + Sync {
    fn delete(&self, path: &Path) -> Result<(), String>;
}

pub struct SystemTrash;

impl Trash for SystemTrash {
    fn delete(&self, path: &Path) -> Result<(), String> {
        trash::delete(path).map_err(|error| error.to_string())
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AppError {
    PermissionDenied,
    IoError,
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::PermissionDenied => "permission_denied",
            Self::IoError => "io_error",
        }
    }
}

pub struct SkillService<'a> {
    paths: SkillPaths,
    trash: &'a dyn Trash,
}

impl<'a> SkillService<'a> {
    pub fn new(paths: SkillPaths, trash: &'a dyn Trash) -> Self {
        Self { paths, trash }
    }

    pub fn list(&self) -> Result<Vec<SkillRecord>, AppError> {
        Ok(self
            .scan_all()?
            .into_iter()
            .map(|skill| skill.record)
            .collect())
    }

    pub fn operate(&self, operation: Operation, ids: Vec<String>) -> OperationSummary {
        let items = ids
            .into_iter()
            .map(|id| self.operate_one(operation.clone(), id))
            .collect();

        OperationSummary { operation, items }
    }

    fn operate_one(&self, operation: Operation, id: String) -> ItemResult {
        let skill = match self.scan_all() {
            Ok(skills) => skills.into_iter().find(|skill| skill.record.id == id),
            Err(error) => return failed(id, error.code()),
        };
        let Some(skill) = skill else {
            return failed(id, "not_found");
        };
        if skill.record.reason.as_deref() == Some("abnormal_skill") {
            return skipped(id, "abnormal_skill");
        }

        match operation {
            Operation::Disable => self.disable(id, skill),
            Operation::Restore => self.restore(id, skill),
            Operation::Delete => self.delete(id, skill),
        }
    }

    fn disable(&self, id: String, skill: ScannedSkill) -> ItemResult {
        if skill.record.state != SkillState::Enabled {
            return failed(id, "not_found");
        }
        let source = match self.safe_skill_path(
            skill.record.source.clone(),
            SkillState::Enabled,
            &skill.record.directory_name,
        ) {
            Ok(path) => path,
            Err(error) => return failed(id, error.code()),
        };
        let destination_root =
            match self.managed_root(skill.record.source.clone(), SkillState::Disabled, true) {
                Ok(Some(path)) => path,
                Ok(None) => return failed(id, "io_error"),
                Err(error) => return failed(id, error.code()),
            };
        let destination = destination_root.join(&skill.record.directory_name);
        match fs::rename(source, destination) {
            Ok(()) => succeeded(id),
            Err(error) => failed(id, io_code(&error)),
        }
    }

    fn restore(&self, id: String, skill: ScannedSkill) -> ItemResult {
        if skill.record.state != SkillState::Disabled {
            return failed(id, "not_found");
        }
        let source = match self.safe_skill_path(
            skill.record.source.clone(),
            SkillState::Disabled,
            &skill.record.directory_name,
        ) {
            Ok(path) => path,
            Err(error) => return failed(id, error.code()),
        };
        let destination_root =
            match self.managed_root(skill.record.source.clone(), SkillState::Enabled, true) {
                Ok(Some(path)) => path,
                Ok(None) => return failed(id, "io_error"),
                Err(error) => return failed(id, error.code()),
            };
        let destination = destination_root.join(&skill.record.directory_name);
        if destination.exists() {
            return failed(id, "restore_conflict");
        }
        match fs::rename(source, destination) {
            Ok(()) => succeeded(id),
            Err(error) => failed(id, io_code(&error)),
        }
    }

    fn delete(&self, id: String, skill: ScannedSkill) -> ItemResult {
        let path = match self.safe_skill_path(
            skill.record.source.clone(),
            skill.record.state.clone(),
            &skill.record.directory_name,
        ) {
            Ok(path) => path,
            Err(error) => return failed(id, error.code()),
        };
        match self.trash.delete(&path) {
            Ok(()) => succeeded(id),
            Err(_) => failed(id, "io_error"),
        }
    }

    fn scan_all(&self) -> Result<Vec<ScannedSkill>, AppError> {
        let mut skills = Vec::new();
        for source in [SkillSource::Codex, SkillSource::Claude] {
            skills.extend(self.scan_root(source.clone(), SkillState::Enabled)?);
            skills.extend(self.scan_root(source, SkillState::Disabled)?);
        }
        Ok(skills)
    }

    fn scan_root(
        &self,
        source: SkillSource,
        state: SkillState,
    ) -> Result<Vec<ScannedSkill>, AppError> {
        let Some(canonical_root) = self.managed_root(source.clone(), state.clone(), false)? else {
            return Ok(Vec::new());
        };
        let entries = fs::read_dir(&canonical_root).map_err(|error| app_error(&error))?;

        let mut skills = Vec::new();
        for entry in entries {
            let entry = entry.map_err(|error| app_error(&error))?;
            let file_type = entry.file_type().map_err(|error| app_error(&error))?;
            if !file_type.is_dir() {
                continue;
            }
            let Some(directory_name) = entry.file_name().to_str().map(str::to_owned) else {
                continue;
            };
            if directory_name.starts_with('.') {
                continue;
            }
            let canonical_path = match entry.path().canonicalize() {
                Ok(path) if path.starts_with(&canonical_root) => path,
                Ok(_) | Err(_) => continue,
            };
            let skill_file = canonical_path.join("SKILL.md");
            let (name, description, reason) = match fs::read_to_string(&skill_file) {
                Ok(content) => {
                    let (name, description) = parse_metadata(&content, &directory_name);
                    (name, description, None)
                }
                Err(_) => (
                    directory_name.clone(),
                    String::new(),
                    Some("abnormal_skill".to_owned()),
                ),
            };
            skills.push(ScannedSkill {
                record: SkillRecord {
                    id: format!(
                        "{}:{}:{}",
                        source.as_str(),
                        state_name(&state),
                        directory_name
                    ),
                    source: source.clone(),
                    state: state.clone(),
                    directory_name,
                    path: canonical_path.to_string_lossy().into_owned(),
                    name,
                    description,
                    reason,
                },
            });
        }
        Ok(skills)
    }

    fn managed_root(
        &self,
        source: SkillSource,
        state: SkillState,
        create: bool,
    ) -> Result<Option<PathBuf>, AppError> {
        let root = match state {
            SkillState::Enabled => self.paths.source(source),
            SkillState::Disabled => self.paths.disabled(source),
        };
        if create {
            fs::create_dir_all(&root).map_err(|error| app_error(&error))?;
        }
        let canonical_root = match root.canonicalize() {
            Ok(path) => path,
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(app_error(&error)),
        };
        let boundary = match state {
            SkillState::Enabled => self.paths.home(),
            SkillState::Disabled => self.paths.app_data(),
        }
        .canonicalize()
        .map_err(|error| app_error(&error))?;
        if canonical_root.starts_with(boundary) {
            Ok(Some(canonical_root))
        } else {
            Err(AppError::IoError)
        }
    }

    fn safe_skill_path(
        &self,
        source: SkillSource,
        state: SkillState,
        directory_name: &str,
    ) -> Result<PathBuf, AppError> {
        let root = self
            .managed_root(source, state, false)?
            .ok_or(AppError::IoError)?;
        let path = root
            .join(directory_name)
            .canonicalize()
            .map_err(|error| app_error(&error))?;
        if path.starts_with(&root) && path.is_dir() {
            Ok(path)
        } else {
            Err(AppError::IoError)
        }
    }
}

struct ScannedSkill {
    record: SkillRecord,
}

fn state_name(state: &SkillState) -> &'static str {
    match state {
        SkillState::Enabled => "enabled",
        SkillState::Disabled => "disabled",
    }
}

fn app_error(error: &std::io::Error) -> AppError {
    match error.kind() {
        ErrorKind::PermissionDenied => AppError::PermissionDenied,
        _ => AppError::IoError,
    }
}

fn io_code(error: &std::io::Error) -> &'static str {
    app_error(error).code()
}

fn succeeded(id: String) -> ItemResult {
    ItemResult {
        id,
        outcome: Outcome::Succeeded,
        code: None,
    }
}

fn skipped(id: String, code: &str) -> ItemResult {
    ItemResult {
        id,
        outcome: Outcome::Skipped,
        code: Some(code.to_owned()),
    }
}

fn failed(id: String, code: &str) -> ItemResult {
    ItemResult {
        id,
        outcome: Outcome::Failed,
        code: Some(code.to_owned()),
    }
}
