pub fn parse_metadata(content: &str, directory_name: &str) -> (String, String) {
    let (front_matter_name, front_matter_description, body) = parse_front_matter(content);
    let (heading, paragraph) = parse_heading_and_paragraph(body);

    (
        front_matter_name
            .or(heading)
            .unwrap_or_else(|| directory_name.to_owned()),
        front_matter_description.or(paragraph).unwrap_or_default(),
    )
}

fn parse_front_matter(content: &str) -> (Option<String>, Option<String>, &str) {
    let Some(first_line) = content.split_inclusive('\n').next() else {
        return (None, None, content);
    };
    if first_line.trim() != "---" {
        return (None, None, content);
    }

    let mut name = None;
    let mut description = None;
    let mut offset = first_line.len();

    for line in content[offset..].split_inclusive('\n') {
        if line.trim() == "---" {
            return (name, description, &content[offset + line.len()..]);
        }

        if let Some(value) = line.trim().strip_prefix("name:") {
            name = nonempty_value(value);
        } else if let Some(value) = line.trim().strip_prefix("description:") {
            description = nonempty_value(value);
        }

        offset += line.len();
    }

    (None, None, content)
}

fn parse_heading_and_paragraph(content: &str) -> (Option<String>, Option<String>) {
    let mut lines = content.lines();
    let heading = lines.find_map(|line| line.trim().strip_prefix("# ").and_then(nonempty_value));

    let paragraph = lines.find_map(|line| {
        let line = line.trim();
        (!line.starts_with('#'))
            .then(|| line.to_owned())
            .filter(|line| !line.is_empty())
    });

    (heading, paragraph)
}

fn nonempty_value(value: &str) -> Option<String> {
    let value = value.trim();
    (!value.is_empty()).then(|| value.to_owned())
}
