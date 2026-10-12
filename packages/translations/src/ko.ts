import type { Messages } from "./index";

const messages = {
  "banner.title": "개인정보 선택",
  "banner.description": "사용할 수 있는 쿠키를 선택하세요.",
  "banner.acceptAll": "모든 쿠키 허용",
  "banner.rejectAll": "선택 쿠키 거부",
  "banner.customize": "맞춤 설정",
  "banner.save": "저장",
  "banner.close": "닫기",
  "preferences.title": "쿠키 설정",
  "preferences.description": "목적별로 쿠키를 관리하세요.",
  "category.necessary.name": "필수",
  "category.necessary.description": "이 사이트에 필요합니다.",
  "category.functional.name": "기능",
  "category.functional.description": "설정을 기억합니다.",
  "category.analytics.name": "분석",
  "category.analytics.description": "사이트 이용 현황을 측정합니다.",
  "category.marketing.name": "마케팅",
  "category.marketing.description": "광고를 지원합니다.",
  "optOut.label": "판매 또는 공유 거부",
  "gpc.honoured": "글로벌 개인정보 보호 설정을 존중했습니다.",
  "recall.label": "쿠키 선택 검토",
  "gated.placeholder": "이 콘텐츠에는 사용자의 허가가 필요합니다.",
  "gated.allow": "콘텐츠 허용",
} as const satisfies Messages;
export default messages;
export { messages };
