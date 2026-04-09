"""
Scoring utilities for PHQ-9 and GAD-7 assessment scores.
Calculates severity levels and primary issue from questionnaire responses.
"""

from typing import Literal, Dict, Any

SeverityLevel = Literal["Normal", "Mild", "Moderate", "Severe"]
PrimaryIssue = Literal["Depression", "Anxiety", "Mixed", "None"]

# PHQ-9 Score Thresholds (0-27)
PHQ9_THRESHOLDS = {
    "Normal": (0, 4),      # 0-4
    "Mild": (5, 9),        # 5-9
    "Moderate": (10, 14),  # 10-14
    "Severe": (15, 27)     # 15-27
}

# GAD-7 Score Thresholds (0-21)
GAD7_THRESHOLDS = {
    "Normal": (0, 4),      # 0-4
    "Mild": (5, 9),        # 5-9
    "Moderate": (10, 14),  # 10-14
    "Severe": (15, 21)     # 15-21
}

# Numeric severity levels
SEVERITY_LEVELS = {
    "Normal": 0,
    "Mild": 1,
    "Moderate": 2,
    "Severe": 3
}

def get_severity_level(score: int, assessment_type: str) -> SeverityLevel:
    """
    Get severity level from score.
    
    Args:
        score: Raw score from PHQ-9 or GAD-7
        assessment_type: Either 'phq9' or 'gad7'
    
    Returns:
        Severity level: 'Normal', 'Mild', 'Moderate', or 'Severe'
    """
    if assessment_type.lower() == "phq9":
        thresholds = PHQ9_THRESHOLDS
    elif assessment_type.lower() == "gad7":
        thresholds = GAD7_THRESHOLDS
    else:
        raise ValueError("assessment_type must be 'phq9' or 'gad7'")
    
    for level, (min_val, max_val) in thresholds.items():
        if min_val <= score <= max_val:
            return level
    return "Severe"

def calculate_baseline_profile(phq9_answers: list, gad7_answers: list) -> Dict[str, Any]:
    """
    Calculate baseline profile from PHQ-9 and GAD-7 responses.
    
    Args:
        phq9_answers: List of 9 integers (0-3) for PHQ-9 responses
        gad7_answers: List of 7 integers (0-3) for GAD-7 responses
    
    Returns:
        Dictionary with scores, severity levels, and primary issue
    """
    # Calculate raw scores
    phq9_score = sum(phq9_answers)
    gad7_score = sum(gad7_answers)
    
    # Get severity levels
    phq9_severity = get_severity_level(phq9_score, "phq9")
    gad7_severity = get_severity_level(gad7_score, "gad7")
    
    # Determine overall baseline (highest severity)
    phq9_numeric = SEVERITY_LEVELS[phq9_severity]
    gad7_numeric = SEVERITY_LEVELS[gad7_severity]
    overall_baseline_numeric = max(phq9_numeric, gad7_numeric)
    
    # Convert back to string
    reverse_levels = {v: k for k, v in SEVERITY_LEVELS.items()}
    overall_baseline = reverse_levels[overall_baseline_numeric]
    
    # Determine primary issue
    if phq9_numeric > gad7_numeric:
        primary_issue = "Depression"
    elif gad7_numeric > phq9_numeric:
        primary_issue = "Anxiety"
    elif phq9_numeric == gad7_numeric and phq9_numeric > 0:
        primary_issue = "Mixed"
    else:
        primary_issue = "None"
    
    return {
        "phq9_score": phq9_score,
        "gad7_score": gad7_score,
        "phq9_level": phq9_severity,
        "gad7_level": gad7_severity,
        "phq9_level_numeric": phq9_numeric,
        "gad7_level_numeric": gad7_numeric,
        "baseline_level_numeric": overall_baseline_numeric,
        "overall_baseline_level": overall_baseline,
        "primary_issue": primary_issue
    }

def map_to_severe_level(severity: SeverityLevel) -> str:
    """
    Map internal severity level to API parameter.
    
    Args:
        severity: One of 'Normal', 'Mild', 'Moderate', 'Severe'
    
    Returns:
        String for API transmission
    """
    severity_map = {
        "Normal": "normal",
        "Mild": "mild",
        "Moderate": "moderate",
        "Severe": "severe"
    }
    return severity_map.get(severity, "normal")
