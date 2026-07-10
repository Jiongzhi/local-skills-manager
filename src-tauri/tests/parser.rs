extern crate local_skills_manager_tauri_lib as local_skills_manager_tauri;

use local_skills_manager_tauri::skills::parser::parse_metadata;

#[test]
fn prefers_front_matter() {
    assert_eq!(
        parse_metadata(
            "---\nname: Browser\ndescription: Drive tabs\n---\n# ignored",
            "browser",
        ),
        ("Browser".into(), "Drive tabs".into())
    );
}

#[test]
fn falls_back_to_heading_and_paragraph() {
    assert_eq!(
        parse_metadata("# Release helper\n\nBuild safely.", "release"),
        ("Release helper".into(), "Build safely.".into())
    );
}
