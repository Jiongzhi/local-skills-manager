use serde::Serialize;
use tauri::Manager;

use crate::skills::{
    AppError, Operation, OperationSummary, SkillPaths, SkillRecord, SkillService, SystemTrash,
};

static SYSTEM_TRASH: SystemTrash = SystemTrash;

#[derive(Debug, Serialize)]
pub struct CommandError {
    pub code: String,
}

impl CommandError {
    fn from_app_error(error: AppError) -> Self {
        Self {
            code: error.code().to_owned(),
        }
    }
}

#[tauri::command]
pub fn list_skills(app: tauri::AppHandle) -> Result<Vec<SkillRecord>, CommandError> {
    service_for(&app)?
        .list()
        .map_err(CommandError::from_app_error)
}

#[tauri::command]
pub fn operate_skills(
    app: tauri::AppHandle,
    operation: Operation,
    ids: Vec<String>,
) -> Result<OperationSummary, CommandError> {
    if ids.iter().any(|id| !is_valid_id(id)) {
        return Err(CommandError {
            code: "not_found".to_owned(),
        });
    }
    Ok(service_for(&app)?.operate(operation, ids))
}

fn service_for(app: &tauri::AppHandle) -> Result<SkillService<'static>, CommandError> {
    let home = dirs::home_dir().ok_or_else(|| CommandError {
        code: "io_error".to_owned(),
    })?;
    let app_data = app.path().app_data_dir().map_err(|_| CommandError {
        code: "io_error".to_owned(),
    })?;
    Ok(SkillService::new(
        SkillPaths::new(home, app_data),
        &SYSTEM_TRASH,
    ))
}

fn is_valid_id(id: &str) -> bool {
    let mut parts = id.split(':');
    let (Some(source), Some(state), Some(name), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return false;
    };
    matches!(source, "codex" | "claude")
        && matches!(state, "enabled" | "disabled" | "abnormal")
        && !name.is_empty()
        && !name.contains(['/', '\\'])
}

#[cfg(test)]
mod tests {
    use super::is_valid_id;

    #[test]
    fn accepts_only_skill_ids_without_path_separators() {
        assert!(is_valid_id("codex:enabled:browser"));
        assert!(is_valid_id("claude:abnormal:broken"));
        assert!(!is_valid_id("codex:enabled:../browser"));
        assert!(!is_valid_id("codex:enabled:browser:extra"));
        assert!(!is_valid_id("other:enabled:browser"));
    }
}
