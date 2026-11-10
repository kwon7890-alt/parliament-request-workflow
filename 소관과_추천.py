"""국회 요구 문항의 1순위 소관 과를 추천한다.

배분기준표의 키워드, 제외어, 우선순위를 사용한다. 추천 결과는 최종 배분이
아니므로 일치하는 규칙이 없으면 임의로 정하지 않고 ``확인필요``를 반환한다.
"""

from __future__ import annotations

import csv
import re
from collections import defaultdict
from functools import lru_cache
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DEFAULT_RULES_PATH = ROOT / "data" / "배분기준표_소관키워드_304건.csv"
DEFAULT_TEST_PATH = ROOT / "data" / "시험_요구문항_40건.csv"
DEFAULT_ORG_PATH = ROOT / "data" / "A부_조직도_26개과.csv"


def _normalize(value: str) -> str:
    """대소문자와 연속 공백 차이를 제거한다."""

    return " ".join(value.casefold().split())


@lru_cache(maxsize=8)
def _load_rules(path_text: str) -> tuple[dict[str, object], ...]:
    """CSV 배분기준표를 읽어 추천에 필요한 값만 보관한다."""

    path = Path(path_text)
    rules: list[dict[str, object]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            keyword = _normalize(row["키워드"])
            if not keyword:
                continue
            rules.append(
                {
                    "department": row["과"].strip(),
                    "keyword": keyword,
                    "exclusions": tuple(
                        _normalize(item)
                        for item in row.get("제외어", "").split("|")
                        if item.strip()
                    ),
                    "priority": int(row.get("우선순위") or 3),
                }
            )
    return tuple(rules)


@lru_cache(maxsize=4)
def _load_organization(path_text: str) -> dict[str, str]:
    """과 이름을 조직도의 주요업무와 연결한다."""

    organization: dict[str, str] = {}
    with Path(path_text).open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            organization[row["과"].strip()] = row["주요업무"].strip()
    return organization


def _rule_points(priority: int, keyword: str) -> int:
    """한 규칙의 설명용 점수를 계산한다.

    처리지침대로 우선순위 3·2·1에 각각 10·7·4점을 주고, 구체적인 긴 키워드에는 최대
    3점을 더한다. 같은 과에서 키워드가 둘 이상 맞으면 최종 점수에 2점을
    추가한다.
    """

    priority_points = {3: 10, 2: 7, 1: 4}.get(priority, max(1, priority * 3 + 1))
    return priority_points + min(3, len(keyword) // 2)


def recommend_department_detail(
    question: str,
    rules_path: str | Path = DEFAULT_RULES_PATH,
    organization_path: str | Path = DEFAULT_ORG_PATH,
) -> dict[str, object]:
    """요구 문항의 1순위 소관 과와 판정 근거를 반환한다."""

    text = _normalize(question)
    scores: dict[str, int] = defaultdict(int)
    matched_keywords: dict[str, set[str]] = defaultdict(set)
    matched_priorities: dict[str, int] = defaultdict(int)
    longest_matches: dict[str, int] = defaultdict(int)
    organization = _load_organization(str(Path(organization_path).resolve()))

    if text:
        for rule in _load_rules(str(Path(rules_path).resolve())):
            keyword = str(rule["keyword"])
            if keyword not in text:
                continue
            if any(exclusion in text for exclusion in rule["exclusions"]):
                continue

            department = str(rule["department"])
            if department not in organization:
                continue
            if keyword in matched_keywords[department]:
                continue
            matched_keywords[department].add(keyword)
            scores[department] += _rule_points(int(rule["priority"]), keyword)
            matched_priorities[department] = max(
                matched_priorities[department], int(rule["priority"])
            )
            longest_matches[department] = max(longest_matches[department], len(keyword))

    for department, keywords in matched_keywords.items():
        if len(keywords) >= 2:
            scores[department] += 2

    ranking = sorted(
        scores,
        key=lambda department: (
            -matched_priorities[department],
            -scores[department],
            -longest_matches[department],
            -len(matched_keywords[department]),
            department,
        ),
    )
    top_priority = matched_priorities.get(ranking[0], 0) if ranking else 0
    tied_departments = [
        candidate
        for candidate in ranking
        if matched_priorities[candidate] == top_priority
    ]
    is_tie = len(tied_departments) > 1
    department = ranking[0] if ranking and not is_tie else "확인필요"
    score = scores.get(ranking[0], 0) if ranking else 0
    second_score = scores.get(ranking[1], 0) if len(ranking) > 1 else 0
    high_match = score >= 16 and (second_score == 0 or score - second_score >= 6)
    medium_match = score >= 8 and (second_score == 0 or score > second_score)
    judgment = "높은 일치" if high_match else "보통 일치" if medium_match else "낮은 일치"

    project_code_match = re.search(r"(?<!\d)(\d{4}-\d{3})(?!\d)", question)

    return {
        "입력": question.strip(),
        "사업코드": project_code_match.group(1) if project_code_match else "확인 필요(사업자료 없음)",
        "사업명": "확인 필요(사업자료 없음)",
        "소관": (
            f"{department} · {organization.get(department, '업무 확인 필요')}"
            if department != "확인필요"
            else "확인 필요"
        ),
        "판정": "동순위" if is_tie else judgment if department != "확인필요" else "일치 없음",
        "점수": score,
        "사람 확인": "불필요" if high_match and not is_tie else "필요",
        "1순위_배분과": department,
        "동순위후보": tied_departments if is_tie else [],
        "일치키워드": sorted(
            matched_keywords.get(ranking[0], set()) if ranking else set(),
            key=lambda value: (-len(value), value),
        ),
    }


def recommend_department(
    question: str,
    rules_path: str | Path = DEFAULT_RULES_PATH,
) -> str:
    """요구 문항 하나를 받아 1순위 소관 과 이름을 반환한다.

    각 과의 일치 키워드 점수를 합산한다. 우선순위가 높은 규칙과 긴 키워드에
    더 높은 점수를 주며, 제외어가 포함된 규칙은 사용하지 않는다.
    """

    result = recommend_department_detail(question, rules_path)
    tied = result["동순위후보"]
    if tied:
        return f"확인필요: {'|'.join(tied)}"
    return str(result["1순위_배분과"])


def format_recommendation(question: str) -> str:
    """상세 추천 결과를 사람이 읽기 좋은 7개 항목으로 만든다."""

    result = recommend_department_detail(question)
    return "\n".join(
        [
            f"1. 입력: `{result['입력']}`",
            f"2. 사업코드: `{result['사업코드']}`",
            f"3. 사업명: `{result['사업명']}`",
            f"4. 소관: `{result['소관']}`",
            f"5. 판정: `{result['판정']}`",
            f"6. 점수: `{result['점수']}점`",
            f"7. 사람 확인: `{result['사람 확인']}`",
        ]
    )


def evaluate(test_path: str | Path = DEFAULT_TEST_PATH) -> tuple[int, int]:
    """시험 CSV를 평가하여 (1순위 정답 수, 전체 건수)를 반환한다."""

    correct = 0
    total = 0
    with Path(test_path).open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            predicted = recommend_department(row["요구내용"])
            correct += predicted == row["정답_배분과"].strip()
            total += 1
    return correct, total


if __name__ == "__main__":
    correct, total = evaluate()
    print(f"1순위 정답: {correct}/{total}")
    example = "보안관제센터 24시간 운영을 위한 관제용역과 정보보안장비 도입 예산 및 산출근거를 제출하라"
    print(format_recommendation(example))
