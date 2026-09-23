# public/music/

Put producer-provided MP3 files here. This folder is served as static
files by Vite exactly as-is — nothing here is bundled or transformed.

There is no upload feature for end users; this is the only way music gets
into the app. See the main project [README.md](../../README.md#bgm-배경음악-등록-방법)
for the full walkthrough (registering a track in `bgmConfig.ts`, assigning
it a time band, ordering multiple tracks, replacing a file).

This folder is empty by default and that's expected — the app runs fine
with no tracks registered; the BGM player just shows "등록된 음악이 없어요"
until real files are added here.
