/// Shared input validation utilities for Tauri commands.
/// All user-facing IPC boundaries should validate inputs before processing.
const MAX_STRING_LENGTH: usize = 10_000;
const MAX_ARRAY_LENGTH: usize = 100_000;
const MAX_PATH_LENGTH: usize = 4096;

/// Validate a string input has a reasonable length.
pub fn validate_string(value: &str, field_name: &str) -> Result<(), String> {
    if value.len() > MAX_STRING_LENGTH {
        Err(format!(
            "{} exceeds maximum length ({} > {} chars)",
            field_name,
            value.len(),
            MAX_STRING_LENGTH
        ))
    } else {
        Ok(())
    }
}

/// Validate a string is non-empty and within length limits.
pub fn validate_non_empty_string(value: &str, field_name: &str) -> Result<(), String> {
    if value.is_empty() {
        Err(format!("{} must not be empty", field_name))
    } else {
        validate_string(value, field_name)
    }
}

/// Validate a path string is within length limits.
pub fn validate_path_length(path: &str) -> Result<(), String> {
    if path.len() > MAX_PATH_LENGTH {
        Err(format!(
            "Path exceeds maximum length ({} > {} chars)",
            path.len(),
            MAX_PATH_LENGTH
        ))
    } else {
        Ok(())
    }
}

/// Validate an array has a reasonable number of elements.
pub fn validate_array_length<T>(items: &[T], field_name: &str) -> Result<(), String> {
    if items.len() > MAX_ARRAY_LENGTH {
        Err(format!(
            "{} has too many elements ({} > {})",
            field_name,
            items.len(),
            MAX_ARRAY_LENGTH
        ))
    } else {
        Ok(())
    }
}

/// Validate a numeric value is within range (inclusive).
pub fn validate_range<N: PartialOrd + std::fmt::Display>(
    value: N,
    min: N,
    max: N,
    field_name: &str,
) -> Result<(), String> {
    if value < min || value > max {
        Err(format!(
            "{} must be between {} and {}, got {}",
            field_name, min, max, value
        ))
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_valid_string() {
        assert!(validate_string("hello", "name").is_ok());
    }

    #[test]
    fn rejects_oversized_string() {
        let long = "x".repeat(MAX_STRING_LENGTH + 1);
        assert!(validate_string(&long, "name").is_err());
    }

    #[test]
    fn rejects_empty_non_empty_string() {
        assert!(validate_non_empty_string("", "name").is_err());
    }

    #[test]
    fn accepts_non_empty_string() {
        assert!(validate_non_empty_string("hello", "name").is_ok());
    }

    #[test]
    fn rejects_oversized_path() {
        let long = "/".to_string() + &"a".repeat(MAX_PATH_LENGTH);
        assert!(validate_path_length(&long).is_err());
    }

    #[test]
    fn rejects_oversized_array() {
        let big: Vec<u32> = (0..MAX_ARRAY_LENGTH as u32 + 1).collect();
        assert!(validate_array_length(&big, "items").is_err());
    }

    #[test]
    fn accepts_valid_array() {
        let small: Vec<u32> = vec![1, 2, 3];
        assert!(validate_array_length(&small, "items").is_ok());
    }

    #[test]
    fn rejects_out_of_range_value() {
        assert!(validate_range(0u32, 1, 100, "count").is_err());
        assert!(validate_range(101u32, 1, 100, "count").is_err());
    }

    #[test]
    fn accepts_in_range_value() {
        assert!(validate_range(50u32, 1, 100, "count").is_ok());
    }
}
