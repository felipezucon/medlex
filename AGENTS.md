# Project instructions

## Project context

This is a static study website for Medical English.

The application is hosted on GitHub Pages and uses only:

- HTML
- CSS
- Vanilla JavaScript
- JSON files
- localStorage

There is no backend, authentication, database, or build system. The only permitted external API is the optional Gemini correction described below.

## Main requirements

- Preserve all existing Anki-style vocabulary features.
- Add the exam simulator as a separate section.
- Do not rewrite the existing application unnecessarily.
- Prefer small, focused changes.
- Use relative paths compatible with GitHub Pages.
- Do not add API keys, secrets, server code, or paid services.
- Do not load the source PDFs in the production website.
- Exam content must be loaded from files in `data/exams/`.
- User progress must be stored in localStorage.
- Manual open-answer correction must use self-assessment rubrics.
- Do not grade open answers by exact string comparison.
- All examination content must remain in Spanish and English as written in the source materials.
- Interface text may follow the language already used by the existing website.

## AI grading rules

- AI is permitted only to compare open exam/practice answers with the source text, expected answer and grading rules stored in the content JSON.
- Never use AI for flashcards, objective questions, content generation, medical lookup, chat, grounding, tools, or external search.
- Never generate a missing expected answer, accepted variant, source excerpt, rubric, or score scale.
- Never commit an API key, password, decrypted credential, or test credential that could be mistaken for a real key.
- Never send the API key in a URL, request body, log, backup, grading history, or DOM attribute.
- Every AI-gradable item must have a stable ID, expected answer, answer language, maximum points, and either a rubric whose points equal that maximum or a source-backed holistic score scale.
- Exam AI grading runs automatically at finalization and is definitive for that attempt. Keep manual grading available when no key is configured or an API failure occurs.
- Practice AI output remains advisory and requires human acceptance.
- Keep Gemini interactions isolated, stateless, with `store: false`, and without grounding, tools, history, or model fallback.
- Increment `AI_GRADING_PROMPT_VERSION` whenever the grading instruction or payload semantics change.
- Increment `AI_GRADING_SCHEMA_VERSION` whenever the structured output contract changes.

## JavaScript conventions

- Use modern vanilla JavaScript.
- Prefer ES modules when compatible with the existing structure.
- Separate data loading, rendering, grading, and storage.
- Avoid global variables when possible.
- Handle missing or malformed JSON gracefully.
- Escape user-provided content before inserting it into HTML.
- Avoid inline event handlers.
- Do not use `innerHTML` for user-entered answers.

## Accessibility

- Every form control must have a label.
- Buttons must be keyboard accessible.
- Use semantic HTML.
- Maintain visible focus states.
- Use aria-live for score and validation messages when appropriate.

## Responsive design

- Support mobile and desktop layouts.
- Preserve the current visual identity.
- Avoid fixed widths that break on small screens.

## Validation before completing a task

- Check that the existing vocabulary section still works.
- Check that the simulator loads without console errors.
- Check that progress survives a page refresh.
- Check that restarting an exam clears only that exam.
- Check that all paths work under a GitHub Pages subdirectory.
- Summarize all changed files.
