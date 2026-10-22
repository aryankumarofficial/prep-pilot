from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Attempt, AttemptQuestion, Skill, SkillEvidence


def skill_summary(db: Session, user_id: str) -> list[dict]:
    rows = db.scalars(
        select(SkillEvidence)
        .where(SkillEvidence.user_id == user_id)
        .order_by(SkillEvidence.observed_at.desc(), SkillEvidence.id)
    ).all()
    by_skill = defaultdict(list)
    for row in rows:
        by_skill[row.skill_id].append(row)
    questions = db.execute(
        select(AttemptQuestion.question_version_id, AttemptQuestion.snapshot)
        .join(Attempt, Attempt.id == AttemptQuestion.attempt_id)
        .where(Attempt.user_id == user_id, Attempt.status != "in_progress")
    ).all()
    unique = defaultdict(set)
    for version_id, snapshot in questions:
        unique[snapshot["skill_id"]].add(version_id)
    result = []
    for skill in db.scalars(select(Skill).order_by(Skill.category, Skill.name)):
        evidence = by_skill[skill.id][:3]
        total = sum(row.total_count * (3 - i) for i, row in enumerate(evidence))
        correct = sum(row.correct_count * (3 - i) for i, row in enumerate(evidence))
        n = len(unique[skill.id])
        result.append(
            {
                "id": skill.id,
                "name": skill.name,
                "category": skill.category,
                "score": round(100 * correct / total, 1) if total else None,
                "unique_questions": n,
                "attempts": len(by_skill[skill.id]),
                "evidence_level": "Not assessed"
                if not total
                else "Limited evidence"
                if n < 4
                else "Starter evidence",
                "reliable": n >= 4,
                "last_assessed": evidence[0].observed_at if evidence else None,
            }
        )
    return result
