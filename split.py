"""원문 PDF 3건을 문항 단위로 나누어 data/문항목록.csv를 만든다.

처리지침 제2장과 사용자 지정 분리 규칙을 따른다. 외부 패키지는 pypdf만
사용하며, 수신자와 담당 보좌관의 이름·연락처는 결과에 저장하지 않는다.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parent
SOURCE_DIR = ROOT / "원문"
OUTPUT_PATH = ROOT / "data" / "문항목록.csv"
FIELDS = ["파일명", "위원회", "의원", "제출기한", "문항번호", "요구내용", "세부항목", "비고"]

TITLE_RE = re.compile(r"^(?P<committee>.+?위원회)\s+(?P<member>.+?)\s+의원실\s+자료요구서$")
DEADLINE_RE = re.compile(r"제출기한:\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.")
QUESTION_RE = re.compile(r"^\s*(\d+)\.\s*(.+?)\s*$")
SUBITEM_RE = re.compile(r"^\s*([가-힣])\.\s*(.+?)\s*$")
NOTE_RE = re.compile(r"^\s*※\s*(.+?)\s*$")
EXPECTED_COUNT_RE = re.compile(r"_(\d+)문항\.pdf$", re.IGNORECASE)
PHONE_RE = re.compile(r"(?<!\d)\d{2,3}-\d{3,4}-\d{4}(?!\d)")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def extract_lines(pdf_path: Path) -> list[str]:
    """PDF의 모든 페이지에서 텍스트 줄을 순서대로 추출한다."""

    reader = PdfReader(pdf_path)
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    return [line.rstrip() for line in text.splitlines()]


def append_text(parts: list[str], text: str) -> None:
    """빈 문자열을 제외하고 바로 앞 항목에 이어 붙인다."""

    cleaned = " ".join(text.split())
    if cleaned:
        parts.append(cleaned)


def parse_pdf(pdf_path: Path) -> tuple[list[dict[str, str]], dict[str, object]]:
    """PDF 하나를 파싱하고 CSV 행과 검증 결과를 반환한다."""

    lines = extract_lines(pdf_path)
    nonempty = [line.strip() for line in lines if line.strip()]
    if not nonempty:
        raise ValueError(f"텍스트를 추출할 수 없습니다: {pdf_path.name}")

    title_match = TITLE_RE.match(nonempty[0])
    if not title_match:
        raise ValueError(f"첫 줄에서 위원회·의원을 찾지 못했습니다: {pdf_path.name}: {nonempty[0]}")
    committee = title_match.group("committee")
    member = title_match.group("member")

    deadline = ""
    for line in nonempty:
        match = DEADLINE_RE.search(line)
        if match:
            year, month, day = map(int, match.groups())
            deadline = f"{year:04d}-{month:02d}-{day:02d}"
            break
    if not deadline:
        raise ValueError(f"제출기한을 찾지 못했습니다: {pdf_path.name}")

    questions: list[dict[str, object]] = []
    current: dict[str, object] | None = None
    last_kind = ""

    for raw_line in lines:
        line = raw_line.strip()
        if not line or line == nonempty[0]:
            continue
        if line.startswith("수신:") or line.startswith("담당 보좌관:") or line == "끝.":
            continue

        question_match = QUESTION_RE.match(line)
        if question_match:
            current = {
                "number": int(question_match.group(1)),
                "requirement": [question_match.group(2)],
                "subitems": [],
                "notes": [],
            }
            questions.append(current)
            last_kind = "requirement"
            continue

        if current is None:
            # 제목과 수신 줄 이외에 문항 전 머리말이 있으면 저장하지 않는다.
            continue

        subitem_match = SUBITEM_RE.match(line)
        if subitem_match:
            current["subitems"].append([f"{subitem_match.group(1)}. {subitem_match.group(2)}"])
            last_kind = "subitem"
            continue

        note_match = NOTE_RE.match(line)
        if note_match:
            # 정답 CSV는 비고 내용만 저장하고 원문의 표시 기호(※)는 제외한다.
            current["notes"].append([note_match.group(1)])
            last_kind = "note"
            continue

        if last_kind == "subitem" and current["subitems"]:
            append_text(current["subitems"][-1], line)
        elif last_kind == "note" and current["notes"]:
            append_text(current["notes"][-1], line)
        else:
            append_text(current["requirement"], line)
            last_kind = "requirement"

    rows: list[dict[str, str]] = []
    for question in questions:
        requirement = " ".join(question["requirement"])
        # 정답 CSV는 여러 세부항목을 셀 안의 줄바꿈이 아닌 ` / `로 구분한다.
        subitems = " / ".join(" ".join(parts) for parts in question["subitems"])
        notes = "\n".join(" ".join(parts) for parts in question["notes"])
        combined = "\n".join((requirement, subitems, notes))
        if any(blocked in combined for blocked in ("수신:", "담당 보좌관:")):
            raise ValueError(f"제외 대상 문구가 문항에 포함됐습니다: {pdf_path.name}")
        if PHONE_RE.search(combined) or EMAIL_RE.search(combined):
            raise ValueError(f"연락처로 보이는 값이 문항에 포함됐습니다: {pdf_path.name}")
        rows.append(
            {
                "파일명": pdf_path.name,
                "위원회": committee,
                "의원": member,
                "제출기한": deadline,
                "문항번호": str(question["number"]),
                "요구내용": requirement,
                "세부항목": subitems,
                "비고": notes,
            }
        )

    expected_match = EXPECTED_COUNT_RE.search(pdf_path.name)
    if not expected_match:
        raise ValueError(f"파일명에서 문항 수를 찾지 못했습니다: {pdf_path.name}")
    expected = int(expected_match.group(1))
    numbers = [int(row["문항번호"]) for row in rows]
    last_number = numbers[-1] if numbers else 0
    continuous = numbers == list(range(1, last_number + 1))
    matched = len(rows) == expected and last_number == expected and continuous
    summary = {
        "파일명": pdf_path.name,
        "파일명의 문항 수": expected,
        "뽑은 문항 수": len(rows),
        "마지막 번호": last_number,
        "번호 연속": continuous,
        "일치": matched,
    }
    return rows, summary


def write_csv(rows: list[dict[str, str]]) -> None:
    """CSV를 Excel에서도 한글이 보이는 UTF-8 BOM 형식으로 저장한다."""

    with OUTPUT_PATH.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def print_summary(summaries: list[dict[str, object]]) -> None:
    """사용자 확인용 검증 표를 콘솔에 출력한다."""

    print("파일명 | 파일명의 문항 수 | 뽑은 문항 수 | 마지막 번호 | 번호 연속 | 일치")
    print("---|---:|---:|---:|---|---")
    for item in summaries:
        print(
            f"{item['파일명']} | {item['파일명의 문항 수']} | {item['뽑은 문항 수']} | "
            f"{item['마지막 번호']} | {'O' if item['번호 연속'] else 'X'} | "
            f"{'O' if item['일치'] else 'X'}"
        )


def main() -> None:
    pdf_paths = sorted(SOURCE_DIR.glob("*.pdf"))
    if len(pdf_paths) != 3:
        raise SystemExit(f"원문 PDF가 3건이어야 합니다. 현재 {len(pdf_paths)}건입니다.")

    all_rows: list[dict[str, str]] = []
    summaries: list[dict[str, object]] = []
    for pdf_path in pdf_paths:
        rows, summary = parse_pdf(pdf_path)
        all_rows.extend(rows)
        summaries.append(summary)

    print_summary(summaries)
    if not all(item["일치"] for item in summaries):
        raise SystemExit("문항 수 검증이 일치하지 않아 CSV를 저장하지 않았습니다.")

    write_csv(all_rows)
    print(f"\n저장: {OUTPUT_PATH}")
    print(f"전체 문항: {len(all_rows)}")


if __name__ == "__main__":
    main()
