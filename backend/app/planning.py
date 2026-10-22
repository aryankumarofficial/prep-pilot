"""Pure scheduling rules. The LLM never controls scores, dates or task state."""

from dataclasses import dataclass
from datetime import date, timedelta
from math import floor


@dataclass(frozen=True)
class Topic:
    id: str
    name: str
    relevance: float
    score: float | None
    prerequisites: tuple[str, ...] = ()
    reliable: bool = False


def priority(topic: Topic, needed_as_prerequisite: bool) -> float:
    gap = (100 - topic.score) / 100 if topic.score is not None else 0.5
    return round(0.50 * max(0, min(1, gap)) + 0.35 * topic.relevance + 0.15 * int(needed_as_prerequisite), 5)


def order_topics(topics: list[Topic]) -> list[Topic]:
    by_id = {t.id: t for t in topics}
    needed = {p for t in topics for p in t.prerequisites}
    if any(p not in by_id for p in needed):
        raise ValueError("A prerequisite is missing from the role catalogue")
    result: list[Topic] = []
    done: set[str] = set()
    while len(result) < len(topics):
        ready = [t for t in topics if t.id not in done and set(t.prerequisites) <= done]
        if not ready:
            raise ValueError("The prerequisite catalogue contains a cycle")
        ready.sort(key=lambda t: (-priority(t, t.id in needed), t.id))
        result.append(ready[0])
        done.add(ready[0].id)
    return result


def schedule(
    topics: list[Topic],
    start: date,
    deadline: date,
    daily_minutes: int,
    completed: set[str] | None = None,
    used_today: int = 0,
) -> dict:
    """15 minute learning blocks, followed by a reserved review/mock budget.

    Dates are inclusive. Unfillable work is explicit. Whole blocks may leave spare
    minutes, but never exceed daily capacity. Completed task keys remain stable.
    """
    completed = completed or set()
    days = max(0, (deadline - start).days + 1)
    capacities = [max(0, daily_minutes - used_today)] + [daily_minutes] * max(0, days - 1) if days else []
    total = sum(capacities)
    learning_budget = floor(total * 0.78 / 15) * 15
    tasks, unscheduled = [], []
    day, used_learning = 0, 0

    def place(key, title, kind, skill_id, reason, *, learning=False):
        nonlocal day, used_learning
        if key in completed:
            return
        while day < days and capacities[day] < 15:
            day += 1
        if day >= days or (learning and used_learning + 15 > learning_budget):
            unscheduled.append({"key": key, "title": title, "minutes": 15, "skill_id": skill_id})
            return
        tasks.append(
            {
                "key": key,
                "title": title,
                "task_type": kind,
                "skill_id": skill_id,
                "planned_minutes": 15,
                "planned_date": start + timedelta(days=day),
                "reason": reason,
            }
        )
        capacities[day] -= 15
        if learning:
            used_learning += 15

    for topic in order_topics(topics):
        if topic.relevance <= 0 and not any(topic.id in t.prerequisites for t in topics):
            continue
        score = f"{topic.score:g}% on recent assessments" if topic.score is not None else "not yet assessed"
        reason = (
            f"{topic.name}: {score}; role relevance {topic.relevance:.0%}. Prerequisites are scheduled first."
        )
        steps = [
            ("concepts", "Learn the foundations"),
            ("examples", "Work through examples"),
            ("practice", "Practice and explain"),
            ("recall", "Recall without notes"),
        ]
        if topic.reliable and topic.score is not None and topic.score >= 80:
            steps = steps[-1:]
        for suffix, label in steps:
            place(f"{topic.id}:{suffix}", f"{topic.name} · {label}", "learn", topic.id, reason, learning=True)

    # The remaining capacity is for review and milestone quizzes, including the final mock.
    # Grouped subject quizzes use different items from the diagnostic starter test.
    groups = list(dict.fromkeys(t.id.split("-")[0] for t in order_topics(topics)))
    reserved_blocks = max(0, floor((total - learning_budget) / 15))
    for i in range(reserved_blocks):
        is_final = i == reserved_blocks - 1
        group = groups[i % len(groups)] if groups else "mixed"
        key = "final-mock" if is_final else f"review:{i}:{group}"
        place(
            key,
            "Mixed placement mock" if is_final else f"{group.upper()} · Review and milestone quiz",
            "mock" if is_final else "revision",
            None,
            "Reserved practice time. Quiz results update measured skills; checking off a lesson does not.",
        )
    return {
        "tasks": tasks,
        "unscheduled": unscheduled,
        "available_minutes": total,
        "scheduled_minutes": sum(t["planned_minutes"] for t in tasks),
        "learning_budget": learning_budget,
    }
