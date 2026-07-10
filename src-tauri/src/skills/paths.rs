use std::path::{Path, PathBuf};

use super::SkillSource;

#[derive(Clone, Debug)]
pub struct SkillPaths {
    home: PathBuf,
    app_data: PathBuf,
}

impl SkillPaths {
    pub fn new(home: PathBuf, app_data: PathBuf) -> Self {
        Self { home, app_data }
    }

    pub fn source(&self, source: SkillSource) -> PathBuf {
        self.home.join(match source {
            SkillSource::Codex => ".codex/skills",
            SkillSource::Claude => ".claude/skills",
        })
    }

    pub fn disabled(&self, source: SkillSource) -> PathBuf {
        self.app_data.join("disabled").join(source.as_str())
    }

    pub(crate) fn home(&self) -> &Path {
        &self.home
    }

    pub(crate) fn app_data(&self) -> &Path {
        &self.app_data
    }
}
