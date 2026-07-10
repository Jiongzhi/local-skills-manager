extern crate local_skills_manager_tauri_lib as local_skills_manager_tauri;

use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};

use local_skills_manager_tauri::skills::{
    AppError, Operation, Outcome, SkillPaths, SkillService, SkillSource, Trash,
};
use tempfile::TempDir;

struct RecordingTrash {
    paths: Mutex<Vec<PathBuf>>,
}

impl RecordingTrash {
    fn new() -> Self {
        Self {
            paths: Mutex::new(Vec::new()),
        }
    }

    fn paths(&self) -> Vec<PathBuf> {
        self.paths.lock().unwrap().clone()
    }
}

impl Trash for RecordingTrash {
    fn delete(&self, path: &Path) -> Result<(), String> {
        self.paths.lock().unwrap().push(path.to_path_buf());
        Ok(())
    }
}

struct TestService {
    temp: TempDir,
    trash: RecordingTrash,
}

impl TestService {
    fn new() -> Self {
        Self {
            temp: TempDir::new().unwrap(),
            trash: RecordingTrash::new(),
        }
    }

    fn enabled(&self, source: SkillSource) -> PathBuf {
        self.paths().source(source)
    }

    fn disabled(&self, source: SkillSource) -> PathBuf {
        self.paths().disabled(source)
    }

    fn paths(&self) -> SkillPaths {
        SkillPaths::new(
            self.temp.path().join("home"),
            self.temp.path().join("app-data"),
        )
    }

    fn service(&self) -> SkillService<'_> {
        SkillService::new(self.paths(), &self.trash)
    }

    fn skill(&self, source: SkillSource, name: &str) -> PathBuf {
        let path = self.enabled(source).join(name);
        std::fs::create_dir_all(&path).unwrap();
        std::fs::write(path.join("SKILL.md"), "# Browser\nDrive tabs.").unwrap();
        path
    }
}

#[test]
fn disable_moves_a_skill_to_the_source_specific_store() {
    let fixture = TestService::new();
    fixture.skill(SkillSource::Codex, "browser");

    let summary = fixture
        .service()
        .operate(Operation::Disable, vec!["codex:enabled:browser".into()]);

    assert_eq!(summary.items[0].outcome, Outcome::Succeeded);
    assert!(fixture
        .disabled(SkillSource::Codex)
        .join("browser/SKILL.md")
        .exists());
    assert!(!fixture.enabled(SkillSource::Codex).join("browser").exists());
}

#[test]
fn restore_conflict_keeps_disabled_skill_in_place() {
    let fixture = TestService::new();
    let disabled = fixture.disabled(SkillSource::Codex).join("browser");
    std::fs::create_dir_all(&disabled).unwrap();
    std::fs::write(disabled.join("SKILL.md"), "# Browser").unwrap();
    fixture.skill(SkillSource::Codex, "browser");

    let summary = fixture
        .service()
        .operate(Operation::Restore, vec!["codex:disabled:browser".into()]);

    assert_eq!(summary.items[0].outcome, Outcome::Failed);
    assert_eq!(summary.items[0].code.as_deref(), Some("restore_conflict"));
    assert!(disabled.join("SKILL.md").exists());
}

#[test]
fn delete_passes_the_canonical_source_path_to_trash() {
    let fixture = TestService::new();
    let skill = fixture.skill(SkillSource::Claude, "browser");
    let expected = skill.canonicalize().unwrap();

    let summary = fixture
        .service()
        .operate(Operation::Delete, vec!["claude:enabled:browser".into()]);

    assert_eq!(summary.items[0].outcome, Outcome::Succeeded);
    assert_eq!(fixture.trash.paths(), vec![expected]);
}

#[test]
fn abnormal_records_are_skipped_without_calling_trash() {
    let fixture = TestService::new();
    let path = fixture.enabled(SkillSource::Codex).join("broken");
    std::fs::create_dir_all(&path).unwrap();

    let summary = fixture
        .service()
        .operate(Operation::Delete, vec!["codex:enabled:broken".into()]);

    assert_eq!(summary.items[0].outcome, Outcome::Skipped);
    assert_eq!(summary.items[0].code.as_deref(), Some("abnormal_skill"));
    assert!(fixture.trash.paths().is_empty());
}

#[test]
fn failed_items_do_not_prevent_later_items_from_running() {
    let fixture = TestService::new();
    fixture.skill(SkillSource::Codex, "browser");

    let summary = fixture.service().operate(
        Operation::Disable,
        vec![
            "codex:enabled:missing".into(),
            "codex:enabled:browser".into(),
        ],
    );

    assert_eq!(summary.items.len(), 2);
    assert_eq!(summary.items[0].code.as_deref(), Some("not_found"));
    assert_eq!(summary.items[1].outcome, Outcome::Succeeded);
}

#[test]
fn list_scans_only_non_hidden_skill_directories() {
    let fixture = TestService::new();
    fixture.skill(SkillSource::Codex, "browser");
    fixture.skill(SkillSource::Claude, ".ignored");
    std::fs::create_dir_all(fixture.enabled(SkillSource::Claude)).unwrap();
    std::fs::write(
        fixture.enabled(SkillSource::Claude).join("not-a-directory"),
        "x",
    )
    .unwrap();

    let skills = fixture.service().list().unwrap();

    assert_eq!(skills.len(), 1);
    assert_eq!(skills[0].id, "codex:enabled:browser");
    assert_eq!(skills[0].name, "Browser");
}

#[cfg(windows)]
#[test]
fn linked_source_root_is_rejected_before_external_skills_are_discovered() {
    let fixture = TestService::new();
    let outside = fixture.temp.path().join("outside");
    std::fs::create_dir_all(outside.join("browser")).unwrap();
    std::fs::write(outside.join("browser/SKILL.md"), "# Browser").unwrap();
    let linked_root = fixture.temp.path().join("home/.codex/skills");
    std::fs::create_dir_all(linked_root.parent().unwrap()).unwrap();
    std::os::windows::fs::symlink_dir(&outside, &linked_root).unwrap();

    assert_eq!(fixture.service().list(), Err(AppError::IoError));
    let summary = fixture
        .service()
        .operate(Operation::Delete, vec!["codex:enabled:browser".into()]);
    assert_eq!(summary.items[0].outcome, Outcome::Failed);
    assert_eq!(summary.items[0].code.as_deref(), Some("io_error"));
    assert!(fixture.trash.paths().is_empty());
}
