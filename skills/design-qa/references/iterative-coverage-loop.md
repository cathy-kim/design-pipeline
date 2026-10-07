# Iterative Coverage Loop

haiku 모델 기반 QA Agent가 100% 커버리지를 달성할 때까지 반복 실행하는 시스템.

---

## 개요

저비용 모델(haiku)로 QA 테스트를 실행하되, 커버리지가 100%에 도달할 때까지 자동으로 재시도합니다.

### 핵심 원칙

```
1. 첫 실행 → 커버리지 측정
2. 100% 미달 → 누락 항목 분석
3. 타겟 테스트 추가 → 재실행
4. 반복 (최대 N회)
5. 100% 달성 또는 최대 시도 도달 시 종료
```

---

## Configuration

### 기본 설정

```yaml
iterative_coverage:
  enabled: true
  target_coverage: 100        # 목표 커버리지 (%)
  max_iterations: 5           # 최대 반복 횟수
  model: haiku                # 사용 모델
  retry_strategy: targeted    # targeted | full

  thresholds:
    min_improvement: 5        # 최소 개선률 (%) - 이하면 조기 종료
    acceptable_coverage: 95   # 허용 가능 커버리지 (max_iterations 도달 시)
```

### 반복 전략

| 전략 | 설명 | 사용 시점 |
|------|------|----------|
| `targeted` | 실패/누락 항목만 재테스트 | 기본값, 효율적 |
| `full` | 전체 테스트 재실행 | 상호의존성 있을 때 |

---

## Loop Algorithm

```python
def iterative_coverage_loop(config):
    iteration = 0
    coverage = 0
    previous_coverage = 0
    failed_items = []

    while iteration < config.max_iterations:
        iteration += 1

        # 1. 테스트 실행
        if iteration == 1 or config.retry_strategy == 'full':
            results = run_full_test_suite()
        else:
            results = run_targeted_tests(failed_items)

        # 2. 커버리지 계산
        coverage = calculate_coverage(results)
        failed_items = get_failed_items(results)

        # 3. 종료 조건 체크
        if coverage >= config.target_coverage:
            return SUCCESS, coverage, iteration

        # 4. 개선 없음 체크
        improvement = coverage - previous_coverage
        if improvement < config.min_improvement and iteration > 1:
            if coverage >= config.acceptable_coverage:
                return ACCEPTABLE, coverage, iteration
            else:
                return STALLED, coverage, iteration

        previous_coverage = coverage

        # 5. 다음 반복을 위한 분석
        analyze_failures(failed_items)
        adjust_test_parameters(failed_items)

    # max_iterations 도달
    if coverage >= config.acceptable_coverage:
        return ACCEPTABLE, coverage, iteration
    return MAX_ITERATIONS_REACHED, coverage, iteration
```

---

## Implementation

### Python Test Runner

```python
#!/usr/bin/env python3
"""
Iterative Coverage Test Runner
"""

import json
from dataclasses import dataclass
from typing import List, Dict, Tuple
from enum import Enum

class ExitStatus(Enum):
    SUCCESS = "100% coverage achieved"
    ACCEPTABLE = "Acceptable coverage reached"
    STALLED = "No improvement detected"
    MAX_ITERATIONS = "Max iterations reached"

@dataclass
class CoverageConfig:
    target_coverage: float = 100.0
    max_iterations: int = 5
    min_improvement: float = 5.0
    acceptable_coverage: float = 95.0
    retry_strategy: str = "targeted"

def run_iterative_coverage(
    test_function,
    config: CoverageConfig = None
) -> Tuple[ExitStatus, float, int, Dict]:
    """
    반복 커버리지 테스트 실행

    Args:
        test_function: 테스트 실행 함수 (returns: results dict with 'coverage', 'failed_items')
        config: 설정

    Returns:
        (status, final_coverage, iterations, detailed_results)
    """
    if config is None:
        config = CoverageConfig()

    iteration = 0
    coverage = 0.0
    previous_coverage = 0.0
    all_results = []
    failed_items = []

    print(f"🎯 Target: {config.target_coverage}% coverage")
    print(f"🔄 Max iterations: {config.max_iterations}")
    print()

    while iteration < config.max_iterations:
        iteration += 1
        print(f"━━━ Iteration {iteration}/{config.max_iterations} ━━━")

        # Run tests
        if iteration == 1 or config.retry_strategy == 'full':
            results = test_function(mode='full')
        else:
            results = test_function(mode='targeted', targets=failed_items)

        coverage = results.get('coverage', 0)
        failed_items = results.get('failed_items', [])
        all_results.append(results)

        print(f"📊 Coverage: {coverage:.1f}%")
        print(f"❌ Failed items: {len(failed_items)}")

        # Check success
        if coverage >= config.target_coverage:
            print(f"\n✅ {ExitStatus.SUCCESS.value}")
            return ExitStatus.SUCCESS, coverage, iteration, all_results

        # Check improvement
        improvement = coverage - previous_coverage
        if improvement < config.min_improvement and iteration > 1:
            if coverage >= config.acceptable_coverage:
                print(f"\n⚠️ {ExitStatus.ACCEPTABLE.value} ({coverage:.1f}%)")
                return ExitStatus.ACCEPTABLE, coverage, iteration, all_results
            else:
                print(f"\n⚠️ {ExitStatus.STALLED.value}")
                # Continue trying...

        previous_coverage = coverage

        if failed_items:
            print(f"🔍 Analyzing {len(failed_items)} failed items for retry...")
        print()

    # Max iterations reached
    status = ExitStatus.ACCEPTABLE if coverage >= config.acceptable_coverage else ExitStatus.MAX_ITERATIONS
    print(f"\n{'✅' if status == ExitStatus.ACCEPTABLE else '⚠️'} {status.value}")
    return status, coverage, iteration, all_results
```

### 사용 예시

```python
from iterative_coverage import run_iterative_coverage, CoverageConfig

def my_test_function(mode='full', targets=None):
    """실제 테스트 실행 함수"""
    if mode == 'full':
        results = run_full_qa_suite()
    else:
        results = run_targeted_qa(targets)

    return {
        'coverage': results.calculate_coverage(),
        'failed_items': results.get_failures(),
        'details': results.to_dict()
    }

# 실행
config = CoverageConfig(
    target_coverage=100,
    max_iterations=5,
    min_improvement=5,
    acceptable_coverage=95
)

status, coverage, iterations, results = run_iterative_coverage(
    my_test_function,
    config
)

print(f"Final: {status.value} with {coverage}% in {iterations} iterations")
```

---

## Agent Integration

### screen-qa-agent 연동

```markdown
## Iterative Coverage Mode

screen-qa-agent는 다음과 같이 반복 커버리지 모드를 실행합니다:

1. **첫 번째 실행**: 전체 체크리스트 기반 테스트
2. **결과 분석**: 누락/실패 항목 식별
3. **타겟 재테스트**: 실패 항목만 집중 테스트
4. **반복**: 100% 또는 max_iterations까지

### 트리거 방법

- 자동: `model: haiku` 설정 시 기본 활성화
- 수동: `--iterative` 플래그 사용
- 설정: `iterative_coverage.enabled: true`
```

### qa-expert 연동

```markdown
## QA Expert Integration

qa-expert는 screen-qa-agent의 반복 커버리지 결과를 받아:

1. 최종 커버리지 검증
2. 반복해도 해결 안 된 항목 분석
3. 수동 검토 필요 항목 리스트업
4. 종합 QA 리포트 생성
```

---

## Output Format

### Iteration Report

```markdown
## Iterative Coverage Report

### Summary
| 메트릭 | 값 |
|--------|-----|
| Final Coverage | 100% |
| Iterations | 3 |
| Status | SUCCESS |
| Model | haiku |

### Iteration History

| # | Coverage | Failed | Improvement |
|---|----------|--------|-------------|
| 1 | 75% | 8 | - |
| 2 | 90% | 3 | +15% |
| 3 | 100% | 0 | +10% |

### Failed Items Resolution

| Item | Iteration 1 | Iteration 2 | Iteration 3 |
|------|-------------|-------------|-------------|
| disabled state | ❌ | ❌ | ✅ |
| dark mode | ❌ | ✅ | ✅ |
| sizes test | ❌ | ✅ | ✅ |
```

---

## Best Practices

### 1. 적절한 max_iterations 설정

| 테스트 복잡도 | 권장 max_iterations |
|--------------|---------------------|
| 단순 컴포넌트 | 3 |
| 중간 복잡도 | 5 |
| 복잡한 페이지 | 7 |
| 전체 앱 | 10 |

### 2. min_improvement 튜닝

- **5%**: 일반적인 케이스
- **3%**: 이미 높은 커버리지에서 마지막 몇 % 달성 시
- **10%**: 빠른 조기 종료 원할 때

### 3. 실패 분석 자동화

```python
def analyze_failures(failed_items):
    """실패 원인 분류"""
    categories = {
        'selector_issue': [],      # 선택자 문제
        'timing_issue': [],        # 타이밍 문제
        'missing_element': [],     # 요소 없음
        'visual_diff': [],         # 시각적 차이
        'accessibility': [],       # 접근성 문제
    }

    for item in failed_items:
        category = classify_failure(item)
        categories[category].append(item)

    return categories
```

### 4. 선택자 자동 조정

```python
def adjust_test_parameters(failed_items):
    """다음 반복을 위한 파라미터 조정"""
    adjustments = []

    for item in failed_items:
        if item.failure_reason == 'selector_not_found':
            # 대체 선택자 시도
            adjustments.append({
                'item': item.name,
                'action': 'try_alternative_selector',
                'alternatives': generate_alternative_selectors(item.selector)
            })
        elif item.failure_reason == 'timeout':
            # 대기 시간 증가
            adjustments.append({
                'item': item.name,
                'action': 'increase_timeout',
                'new_timeout': item.timeout * 2
            })

    return adjustments
```

---

## Troubleshooting

### 커버리지가 올라가지 않을 때

1. **선택자 확인**: 대상 요소가 실제로 존재하는지
2. **타이밍 이슈**: wait 시간 충분한지
3. **동적 콘텐츠**: 로딩 완료 대기 필요
4. **조건부 렌더링**: 특정 조건에서만 나타나는 요소

### 최대 반복 도달 시

1. acceptable_coverage 이상이면 수동 검토로 전환
2. 반복해도 실패하는 항목은 별도 이슈로 기록
3. 테스트 자체의 문제인지 실제 버그인지 구분

---

## Related Files

- `skills/screen-qa/SKILL.md` - 메인 Skill 문서
- `agents/screen-qa-agent.md` - Screen QA Agent
- `agents/qa-expert.md` - QA Expert Agent
- `test-scripts/shadcn-button-qa-full.py` - 실제 구현 예시
