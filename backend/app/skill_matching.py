"""Conservative catalogue term matching, independent of any model provider.

Matches are document mentions, not skill measurements or an ATS score.
"""

import re

from .schemas import EvidenceMatch, SkillExtraction

ALIASES = {
    "dsa-arrays": ("arrays", "array", "time complexity", "space complexity", "big o", "big-o"),
    "dsa-search": ("binary search", "linear search", "sorting", "quicksort", "merge sort"),
    "java-types": ("java", "jdk", "jvm"),
    "java-oop": (
        "oop",
        "object oriented",
        "object-oriented",
        "inheritance",
        "polymorphism",
        "encapsulation",
        "java objects",
    ),
    "sql-select": ("sql", "postgresql", "mysql", "relational databases"),
    "sql-joins": ("sql joins", "joins", "inner join", "left join", "group by", "aggregation"),
    "os-process": ("operating systems", "process scheduling", "virtual memory", "memory management"),
    "os-sync": (
        "threads",
        "multithreading",
        "synchronization",
        "synchronisation",
        "mutex",
        "semaphore",
        "deadlock",
    ),
    "net-tcp": ("tcp", "tcp/ip", "networking", "computer networks"),
    "net-http": ("http", "https", "rest api", "rest apis", "restful"),
    "apt-percent": ("percentages", "percentage"),
    "apt-ratios": ("ratios", "proportions"),
}


def document_matches(text: str, allowed: set[str]) -> list[EvidenceMatch]:
    matches = []
    for skill_id, aliases in ALIASES.items():
        if skill_id not in allowed:
            continue
        pattern = r"(?<!\w)(?:" + "|".join(re.escape(alias) for alias in aliases) + r")(?!\w)"
        for found in re.finditer(pattern, text, re.IGNORECASE):
            # Avoid promoting explicit negatives/optional clauses into positive mentions.
            start = max(text.rfind(separator, 0, found.start()) for separator in ("\n", ".", ";", ",")) + 1
            ends = [text.find(separator, found.end()) for separator in ("\n", ".", ";", ",")]
            end = min([position for position in ends if position >= 0] or [len(text)])
            clause = text[start:end]
            if re.search(
                r"\b(no|not|without|never|lack|lacking|unfamiliar|optional)\b|nice.to.have", clause, re.I
            ):
                continue
            evidence = text[max(start, found.start() - 100) : min(end, found.end() + 150)].strip()
            matches.append(EvidenceMatch(skill_id=skill_id, evidence=evidence))
            break
    return matches


def compare_documents(job_text: str, resume_text: str, allowed: set[str]) -> SkillExtraction:
    return SkillExtraction(
        required_skills=document_matches(job_text, allowed),
        resume_skills=document_matches(resume_text, allowed),
    )
