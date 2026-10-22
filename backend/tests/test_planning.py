from collections import defaultdict
from datetime import date, timedelta

import pytest

from app.planning import Topic, order_topics, schedule


@pytest.mark.parametrize("minutes", [15, 20, 30, 60, 125, 480])
@pytest.mark.parametrize("days", [1, 3, 30])
def test_capacity_and_deadlines(minutes, days):
    start = date(2026, 10, 22)
    end = start + timedelta(days=days - 1)
    topics = [Topic("java-basics", "Basics", 1, 10), Topic("java-oop", "OOP", 1, 0, ("java-basics",))]
    result = schedule(topics, start, end, minutes)
    daily = defaultdict(int)
    for task in result["tasks"]:
        assert start <= task["planned_date"] <= end
        daily[task["planned_date"]] += task["planned_minutes"]
    assert all(value <= minutes for value in daily.values())
    if days == 1 and minutes == 15:
        assert result["unscheduled"]


def test_prerequisites_override_priority():
    topics = [Topic("child", "Advanced", 1, 0, ("parent",)), Topic("parent", "Foundation", 0.1, 100)]
    assert [t.id for t in order_topics(topics)] == ["parent", "child"]


def test_cycles_are_rejected():
    with pytest.raises(ValueError, match="cycle"):
        order_topics([Topic("a", "A", 1, None, ("b",)), Topic("b", "B", 1, None, ("a",))])


def test_completed_work_and_today_capacity():
    result = schedule(
        [Topic("java-basics", "Java", 1, 0)],
        date(2026, 10, 22),
        date(2026, 10, 22),
        60,
        {"java-basics:concepts"},
        used_today=15,
    )
    assert all(t["key"] != "java-basics:concepts" for t in result["tasks"])
    assert result["scheduled_minutes"] <= 45
