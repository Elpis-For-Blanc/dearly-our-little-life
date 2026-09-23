# DEARLY — 우리의 작은 집

## BGM (배경음악) 등록 방법

이 프로젝트의 BGM은 **제작자가 프로젝트 파일에 직접 포함한 MP3만** 재생돼요. 일반 사용자가
음악을 업로드하는 기능은 없고, 필요하지도 않아요 — 아래 두 가지만 하면 끝이에요.

1. **MP3 파일을 넣을 폴더**: `public/music/` 안에 MP3 파일을 그대로 복사해 넣으세요. 이 폴더는
   Vite가 가공 없이 그대로 서비스하는 정적 파일 폴더예요. (`public/music/README.md`에도 같은
   안내가 있어요.) **주의**: 실제 배포용 음원 파일 자체는 제작자가 직접 준비해야 해요 — 이 저장소에는
   임의의 저작권 음원이 포함되어 있지 않아요.

2. **설정 파일에서 곡을 등록**: `src/features/bgm/bgmConfig.ts`를 열어 `BGM_TRACKS` 배열에
   항목을 추가하세요. 플레이어 컴포넌트나 다른 코드는 전혀 건드릴 필요 없어요.

   ```ts
   export const BGM_TRACKS: BgmTrackDef[] = [
     { id: 'morning-1', title: '아침 산책', fileName: 'morning.mp3', band: 'morning', order: 0, enabled: true },
   ]
   ```

### 추천 파일명 작성 방법

파일명 자체는 무엇이든 상관없어요 (`fileName` 필드에 정확히 그 이름을 적으면 돼요) — 다만
`아침1.mp3`처럼 시간대와 순서를 알아보기 쉽게 짓는 걸 추천해요. 예: `morning-1.mp3`,
`evening-walk.mp3`.

### 음악 제목 바꾸기

`title` 필드를 원하는 문구로 바꾸면 플레이어 하단에 바로 그 제목이 표시돼요.

### 시간대 지정하기

`band` 필드에 다음 중 하나를 적으세요.

| 값 | 의미 | 시간 |
|---|---|---|
| `'morning'` | 아침 | 05:00-10:59 |
| `'daytime'` | 낮 | 11:00-16:59 |
| `'evening'` | 저녁 | 17:00-20:59 |
| `'night'` | 밤 | 21:00-04:59 |
| `'common'` | 공통 | 특정 시간대에 곡이 없을 때만 대신 재생되는 예비 곡 |

### 여러 곡 등록하기

같은 `band` 값으로 항목을 여러 개 추가하면 돼요. 예를 들어 아침 곡을 두 개 등록하고 싶다면
`band: 'morning'`인 항목을 두 개 만드세요.

### 재생 순서 변경하기

같은 시간대 안에서의 재생 순서는 `order` 필드(작은 숫자가 먼저 재생)로 정해져요. 배열에 적은
순서와는 무관하니, 순서만 바꾸고 싶다면 `order` 숫자만 조정하면 돼요.

### 음악 파일 교체하기

기존 파일을 지우고 `public/music/`에 새 MP3를 넣은 뒤, 그 항목의 `fileName`을 새 파일명으로
바꾸면 돼요. 잠깐 등록을 끄고 싶을 때는 파일을 지우지 않고 `enabled: false`로만 바꿔도 돼요 —
플레이어가 그 곡을 건너뛰어요.

---

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
