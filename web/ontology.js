(function initializeIssueOntology() {
  "use strict";

  const canvas = document.querySelector("#ontologyGraph");
  const stage = canvas?.closest(".ontology-stage");
  const tooltip = document.querySelector("#ontologyTooltip");
  const summary = document.querySelector("#ontologySummary");
  if (!canvas || !stage || !tooltip || !summary) return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const context = canvas.getContext("2d");
  const groupColors = {
    core: "#f3b83f", actor: "#8ca9ff", workflow: "#50d0ca",
    issue: "#bd8cff", guard: "#ff8b93", ai: "#6ee09d",
  };
  const groupAnchors = {
    core: [.50, .50], actor: [.18, .28], workflow: [.77, .30],
    issue: [.24, .76], guard: [.72, .78], ai: [.50, .16],
  };

  const definitions = [
    ["response", "외통위 대응", "core", ["외통위", "외교통일위원회"]],
    ["committee", "위원회", "actor", ["위원회"]], ["office", "의원실", "actor", ["의원실", "의원"]],
    ["coordinator", "국회 총괄", "actor", ["총괄"]], ["department", "현업 과", "actor", ["담당과", "소관과"]],
    ["request", "요구자료", "workflow", ["요구자료", "자료요구"]], ["split", "문항 분해", "workflow", ["문항"]],
    ["assign", "소관 배분", "workflow", ["배분", "소관"]], ["reply", "부서 회신", "workflow", ["회신", "답변"]],
    ["collect", "취합", "workflow", ["취합"]], ["finalize", "확정", "workflow", ["확정", "제출본"]],
    ["diplomacy", "외교", "issue", ["외교"]], ["unification", "통일", "issue", ["통일", "남북"]],
    ["overseas", "재외국민", "issue", ["재외국민", "재외동포"]], ["cooperation", "국제협력", "issue", ["국제협력", "협력"]],
    ["budget", "예산·결산", "issue", ["예산", "결산", "집행"]], ["civil", "민원", "issue", ["민원"]],
    ["policy", "정책", "issue", ["정책", "사업"]], ["digital", "정보화", "issue", ["정보화", "시스템", "디지털"]],
    ["safety", "안전", "issue", ["안전", "보안"]], ["education", "교육", "issue", ["교육", "연수"]],
    ["deadline", "제출기한", "guard", ["기한", "제출일"]], ["privacy", "개인정보", "guard", ["개인정보", "연락처"]],
    ["security", "정보보호", "guard", ["정보보호", "보안", "해킹"]], ["audit", "검증", "guard", ["검증", "오류", "누락"]],
    ["history", "처리 이력", "guard", ["이력", "기록"]], ["template", "공식양식", "guard", ["양식", "한글", "HWP"]],
    ["ai", "AI 추천", "ai", ["AI", "인공지능"]], ["rule", "배분 규칙", "ai", ["규칙", "기준", "키워드"]],
    ["past", "과거 대장", "ai", ["접수대장", "과거"]],
  ];
  const relationDefinitions = [
    ["response", "committee", "대응"], ["committee", "office", "구성"], ["office", "request", "요구"],
    ["response", "coordinator", "총괄"], ["coordinator", "assign", "확정"], ["assign", "department", "배정"],
    ["request", "split", "분해"], ["split", "assign", "추천"], ["department", "reply", "작성"],
    ["reply", "collect", "취합"], ["collect", "finalize", "확정"], ["finalize", "response", "완료"],
    ["response", "diplomacy", "의제"], ["response", "unification", "의제"], ["response", "overseas", "의제"],
    ["diplomacy", "cooperation", "협력"], ["overseas", "civil", "지원"], ["policy", "budget", "재원"],
    ["policy", "education", "추진"], ["policy", "digital", "지원"], ["digital", "safety", "운영"],
    ["request", "budget", "요구"], ["request", "policy", "요구"], ["request", "deadline", "준수"],
    ["reply", "template", "사용"], ["reply", "privacy", "보호"], ["digital", "security", "보호"],
    ["collect", "audit", "검사"], ["finalize", "history", "기록"], ["coordinator", "history", "관리"],
    ["ai", "assign", "보조"], ["rule", "ai", "근거"], ["past", "ai", "참조"],
    ["rule", "department", "연결"], ["past", "request", "비교"], ["audit", "privacy", "검사"],
    ["security", "safety", "포함"], ["deadline", "office", "확인"],
  ];

  let width = 0, height = 0, frame = 0, dragged = null, hovered = null, cases = [];
  const nodes = definitions.map(([id, label, group, keywords], index) => {
    const anchor = groupAnchors[group];
    const angle = index * 2.39996;
    return { id, label, group, keywords, count: 0, x: anchor[0] + Math.cos(angle) * .06, y: anchor[1] + Math.sin(angle) * .06, vx: 0, vy: 0, radius: id === "response" ? 36 : 23 };
  });
  const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const links = relationDefinitions.map(([source, target, relation]) => ({ source: nodeById[source], target: nodeById[target], relation }));

  function fitCanvas() {
    const bounds = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    width = bounds.width;
    height = bounds.height;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas.dataset.renderer = "force-ontology";
    canvas.dataset.nodes = String(nodes.length);
    canvas.dataset.links = String(links.length);
    canvas.dataset.motion = reduceMotion ? "static" : "animated";
  }

  function updateCounts(nextCases) {
    cases = Array.isArray(nextCases) ? nextCases : [];
    for (const node of nodes) {
      node.count = cases.reduce((total, item) => {
        const text = `${item.requirement ?? ""} ${item.status ?? ""} ${item.leadDepartment ?? ""}`.toLowerCase();
        return total + Number(node.keywords.some((keyword) => text.includes(keyword.toLowerCase())));
      }, 0);
      if (node.id === "request") node.count = cases.length;
      if (node.id === "assign") node.count = cases.filter((item) => item.status !== "접수").length;
      if (node.id === "reply") node.count = cases.filter((item) => ["회신중", "회신완료"].includes(item.status)).length;
      if (node.id === "collect") node.count = cases.filter((item) => item.status === "회신완료").length;
      node.radius = node.id === "response" ? 38 : Math.min(34, 21 + Math.sqrt(node.count) * 1.4);
    }
    summary.textContent = `${nodes.length}개 개념 · ${links.length}개 관계`;
    draw();
  }

  function simulate() {
    if (reduceMotion || dragged) return;
    for (const node of nodes) {
      const anchor = groupAnchors[node.group];
      node.vx += (anchor[0] - node.x) * .00045;
      node.vy += (anchor[1] - node.y) * .00045;
    }
    for (const link of links) {
      const dx = link.target.x - link.source.x, dy = link.target.y - link.source.y;
      const distance = Math.max(.001, Math.hypot(dx, dy));
      const desired = link.source.group === link.target.group ? .12 : .18;
      const force = (distance - desired) * .00034;
      link.source.vx += dx / distance * force;
      link.source.vy += dy / distance * force;
      link.target.vx -= dx / distance * force;
      link.target.vy -= dy / distance * force;
    }
    for (let first = 0; first < nodes.length; first += 1) {
      for (let second = first + 1; second < nodes.length; second += 1) {
        const a = nodes[first], b = nodes[second];
        const dx = b.x - a.x, dy = b.y - a.y, distanceSquared = Math.max(.002, dx * dx + dy * dy);
        const force = .000018 / distanceSquared;
        a.vx -= dx * force; a.vy -= dy * force; b.vx += dx * force; b.vy += dy * force;
      }
    }
    for (const node of nodes) {
      node.vx *= .91; node.vy *= .91;
      node.x = Math.max(.06, Math.min(.94, node.x + node.vx));
      node.y = Math.max(.08, Math.min(.92, node.y + node.vy));
    }
  }

  function nodePosition(node) { return { x: node.x * width, y: node.y * height }; }
  function roundedRect(x, y, w, h, radius) {
    context.beginPath();
    context.roundRect(x - w / 2, y - h / 2, w, h, radius);
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    const background = context.createRadialGradient(width * .5, height * .48, 0, width * .5, height * .48, width * .62);
    background.addColorStop(0, "rgba(35,86,216,.08)");
    background.addColorStop(1, "rgba(35,86,216,0)");
    context.fillStyle = background; context.fillRect(0, 0, width, height);

    context.font = '600 9px "Malgun Gothic", sans-serif';
    context.textAlign = "center";
    for (const link of links) {
      const source = nodePosition(link.source), target = nodePosition(link.target);
      const highlighted = hovered && (link.source === hovered || link.target === hovered);
      context.strokeStyle = highlighted ? "rgba(124,246,212,.92)" : "rgba(132,166,215,.34)";
      context.lineWidth = highlighted ? 1.8 : 1;
      context.beginPath(); context.moveTo(source.x, source.y); context.lineTo(target.x, target.y); context.stroke();
      if (highlighted && width > 560) {
        context.fillStyle = "rgba(220,255,247,.95)";
        context.fillText(link.relation, (source.x + target.x) / 2, (source.y + target.y) / 2 - 4);
      }
    }

    for (const node of nodes) {
      const position = nodePosition(node);
      const isHovered = node === hovered;
      const fontSize = node.id === "response" ? 15 : node.count > 0 ? 12.5 : 11.5;
      context.font = `${node.id === "response" ? 900 : 750} ${fontSize}px "Malgun Gothic", sans-serif`;
      const textWidth = context.measureText(node.label).width;
      const boxWidth = Math.max(node.radius * 2, textWidth + 22);
      const boxHeight = node.id === "response" ? 48 : node.count > 0 ? 40 : 34;
      node.hit = { x: position.x, y: position.y, width: boxWidth, height: boxHeight };
      context.shadowColor = isHovered ? `${groupColors[node.group]}bb` : "rgba(0,0,0,.42)";
      context.shadowBlur = isHovered ? 20 : 9;
      roundedRect(position.x, position.y, boxWidth, boxHeight, 12);
      context.fillStyle = isHovered ? `${groupColors[node.group]}66` : `${groupColors[node.group]}28`;
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = isHovered ? "#eafff9" : `${groupColors[node.group]}cc`;
      context.lineWidth = node.id === "response" ? 2.4 : 1.35;
      context.stroke();
      context.fillStyle = "#f4f8ff";
      context.textBaseline = "middle";
      context.fillText(node.label, position.x, position.y - (node.count ? 5 : 0));
      if (node.count) {
        context.font = '700 8px "Malgun Gothic", sans-serif';
        context.fillStyle = "#c6d4e8";
        context.fillText(`${node.count}건`, position.x, position.y + 11);
      }
    }
    canvas.dataset.frame = String(frame);
  }

  function loop() {
    frame += 1;
    simulate();
    draw();
    if (!reduceMotion) requestAnimationFrame(loop);
  }

  function findNode(event) {
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
    return nodes.find((node) => node.hit && Math.abs(x - node.hit.x) <= node.hit.width / 2 && Math.abs(y - node.hit.y) <= node.hit.height / 2) || null;
  }
  function showTooltip(node, event) {
    if (!node) { tooltip.classList.remove("on"); return; }
    const related = links.filter((link) => link.source === node || link.target === node).slice(0, 4).map((link) => {
      const other = link.source === node ? link.target : link.source;
      return `${link.relation} → ${other.label}`;
    });
    tooltip.innerHTML = `<b>${node.label}</b><span>현재 문항 ${node.count}건</span><small>${related.join(" · ")}</small>`;
    const bounds = stage.getBoundingClientRect();
    tooltip.style.left = `${Math.min(bounds.width - 210, Math.max(8, event.clientX - bounds.left + 14))}px`;
    tooltip.style.top = `${Math.min(bounds.height - 82, Math.max(8, event.clientY - bounds.top + 14))}px`;
    tooltip.classList.add("on");
  }

  canvas.addEventListener("pointermove", (event) => {
    if (dragged) {
      const bounds = canvas.getBoundingClientRect();
      dragged.x = Math.max(.05, Math.min(.95, (event.clientX - bounds.left) / bounds.width));
      dragged.y = Math.max(.06, Math.min(.94, (event.clientY - bounds.top) / bounds.height));
      draw(); return;
    }
    hovered = findNode(event);
    canvas.style.cursor = hovered ? "grab" : "default";
    showTooltip(hovered, event);
  }, { passive: true });
  canvas.addEventListener("pointerdown", (event) => { dragged = findNode(event); if (dragged) canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener("pointerup", (event) => { if (dragged) canvas.releasePointerCapture(event.pointerId); dragged = null; });
  canvas.addEventListener("pointerleave", () => { hovered = null; dragged = null; tooltip.classList.remove("on"); });

  new ResizeObserver(() => { fitCanvas(); draw(); }).observe(canvas);
  fitCanvas();
  if (reduceMotion) { for (let index = 0; index < 90; index += 1) simulate(); draw(); } else requestAnimationFrame(loop);

  window.OntologyMap = {
    setCases: updateCounts,
    inspect: () => ({ nodes: nodes.length, links: links.length, frame, motion: canvas.dataset.motion, sample: nodes[0].hit }),
  };
  if (window.ApiClient) ApiClient.getCases().then(updateCounts).catch(() => updateCounts([]));
}());
