from datetime import date

from .catalogue import CATALOGUE, QUESTIONS
from .config import Settings
from .db import make_database
from .models import Assessment, AssessmentQuestion, Prerequisite, QuestionVersion, Resource, RoleSkill, Skill


def seed(db):
    reviewed = date(2026, 10, 22)
    for skill_id, name, category, *_ in CATALOGUE:
        if db.get(Skill, skill_id) is None:
            db.add(Skill(id=skill_id, name=name, category=category, base_minutes=60))
    db.flush()
    for skill_id, _name, _category, relevance, prerequisite, title, url, publisher in CATALOGUE:
        if db.get(RoleSkill, ("Java Developer", skill_id)) is None:
            db.add(RoleSkill(role="Java Developer", skill_id=skill_id, relevance=relevance))
        if prerequisite and db.get(Prerequisite, (skill_id, prerequisite)) is None:
            db.add(Prerequisite(skill_id=skill_id, prerequisite_id=prerequisite))
        if db.get(Resource, skill_id) is None:
            db.add(
                Resource(
                    id=skill_id,
                    skill_id=skill_id,
                    title=title,
                    url=url,
                    publisher=publisher,
                    reviewed_on=reviewed,
                )
            )
        else:
            resource = db.get(Resource, skill_id)
            resource.url, resource.title, resource.publisher = url, title, publisher
            resource.reviewed_on = reviewed
        for i, (prompt, options, correct, explanation) in enumerate(QUESTIONS[skill_id]):
            key = f"{skill_id}-{i + 1}"
            version_id = f"{key}@1"
            values = [{"id": chr(97 + j), "text": option} for j, option in enumerate(options)]
            old = db.get(QuestionVersion, version_id)
            if old:
                if (old.prompt, old.options, old.correct_option, old.explanation) != (
                    prompt,
                    values,
                    chr(97 + correct),
                    explanation,
                ):
                    raise ValueError(f"Published question changed: {version_id}. Create a new revision.")
                # Source-link maintenance does not change a question's scoring content.
                old.source_url = url
            else:
                db.add(
                    QuestionVersion(
                        id=version_id,
                        question_key=key,
                        revision=1,
                        skill_id=skill_id,
                        prompt=prompt,
                        options=values,
                        correct_option=chr(97 + correct),
                        explanation=explanation,
                        source_url=url,
                        reviewed_on=reviewed,
                    )
                )
    db.flush()
    definitions = [
        ("diagnostic", "Your placement diagnostic", "diagnostic", None, 900),
        ("mixed-mock", "Mixed placement mock", "mock", None, 900),
    ]
    for category in dict.fromkeys(row[2] for row in CATALOGUE):
        group = next(row[0].split("-")[0] for row in CATALOGUE if row[2] == category)
        definitions.append((f"milestone-{group}", f"{category} milestone", "milestone", category, 900))
    for assessment_id, title, kind, category, duration in definitions:
        if db.get(Assessment, assessment_id) is None:
            db.add(
                Assessment(
                    id=assessment_id, title=title, kind=kind, category=category, duration_seconds=duration
                )
            )
            db.flush()
        position = 0
        for skill_id, _, skill_category, *_ in CATALOGUE:
            if category and skill_category != category:
                continue
            indices = [0, 1] if kind == "diagnostic" else [2, 3]
            for i in indices:
                question_id = f"{skill_id}-{i + 1}@1"
                if db.get(AssessmentQuestion, (assessment_id, question_id)) is None:
                    db.add(
                        AssessmentQuestion(
                            assessment_id=assessment_id, question_version_id=question_id, position=position
                        )
                    )
                position += 1
    db.flush()


def main():
    engine, sessions = make_database(Settings().database_url)
    with sessions.begin() as db:
        seed(db)
    engine.dispose()
    print("Seeded 12 skills, 48 original questions, 8 assessments and 12 learning resources.")


if __name__ == "__main__":
    main()
