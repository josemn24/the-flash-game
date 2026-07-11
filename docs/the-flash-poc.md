I want you to create from scratch a functional proof of concept for an app called **The Flash**.

The Flash is a fast-paced quiz game inspired by a competitive trivia game that was originally played among friends through a Telegram chat. This first version must NOT include multiplayer, rooms, login, backend, database, or admin panel. The goal of this proof of concept is to validate only the user experience: the game should feel fluid, fast, visual, intuitive, and fun to play.

Important: although this prompt is written in English, the final app must be entirely in **Spanish**. All UI copy, buttons, labels, questions, answers, explanations, result messages, errors, and game text must be written in Spanish.

Create a fully functional frontend application focused on a single playable stage for one user.

---

# 1. Main goal

Create a **UX proof of concept** for The Flash:

* Single player.
* 100% frontend.
* No backend.
* No database.
* No authentication.
* No rooms.
* No multiple players.
* No global ranking.
* No admin panel.
* No unnecessary complex logic.
* Mock questions defined directly in the code.
* One complete playable stage from beginning to end.
* Strong focus on visual experience, buttons, timer, transitions, and the feeling of speed.

The question this PoC must answer is:

> Is playing one stage of The Flash fun and fluid as an app experience?

---

# 2. Tech stack

Use this stack:

* Next.js with App Router.
* React.
* TypeScript.
* Tailwind CSS.
* Framer Motion for transitions and microinteractions.
* Do not use a backend.
* Do not use Supabase.
* Do not use Firebase.
* Do not use API routes unless absolutely necessary, but preferably do not use them.
* Do not use a database.
* Do not use authentication.
* Do not install heavy unnecessary libraries.

The app must be runnable with:

```bash
npm install
npm run dev
```

---

# 3. Language requirement

The final application must be completely in **Spanish**.

This includes:

* screen titles;
* subtitles;
* buttons;
* labels;
* timers;
* progress text;
* result messages;
* questions;
* answers;
* explanations;
* empty states;
* feedback messages;
* accessibility labels when visible or relevant;
* any user-facing text.

Use natural Spanish from Spain, with a casual but polished tone.

Examples:

* “Jugar etapa demo”
* “Empezar etapa”
* “Pregunta 3/10”
* “Respuesta enviada”
* “Etapa completada”
* “Ver respuestas”
* “Volver a jugar”
* “Primero importa acertar. Después, responder rápido.”

Do not leave any visible English text in the app.

---

# 4. Product concept

The Flash should feel like a mix between:

* a fast trivia game;
* a race against the clock;
* a final sprint;
* a visual competition;
* a short mobile-first challenge.

It must not feel like a boring quiz form.

The identity should communicate:

* speed;
* tension;
* clarity;
* competition;
* energy;
* modernity;
* a social game feeling, even though this PoC is single player.

The experience must be designed mobile-first, while still looking good on desktop.

---

# 5. App flow

The PoC must include these states or screens:

## 5.1 Start screen

Initial screen with:

* App name: **The Flash**.
* A short subtitle, for example:

  * “10 preguntas. Poco tiempo. Cero excusas.”
  * or a similar competitive Spanish phrase.
* A short description:

  * “Juega una etapa demo y responde antes de que se acabe el tiempo.”
* Primary button:

  * “Jugar etapa demo”
* Strong visual design:

  * dark or gradient background;
  * feeling of speed;
  * visual elements inspired by flashes, sprint, energy, or countdown;
  * good contrast;
  * modern look.

When the user clicks the button, move to the stage intro screen.

---

## 5.2 Stage intro screen

Show a card or screen with information about the demo stage:

* Title: “Etapa Demo”
* Subtitle: “Sprint de prueba”
* Number of questions.
* Estimated duration.
* Question types included.
* Main rule:

  * “Primero importa acertar. Después, responder rápido.”
* Warning:

  * “Una vez empieces, el temporizador no se detiene.”
* Primary button:

  * “Empezar etapa”

This screen should build tension before starting.

When the user clicks “Empezar etapa”, question 1 starts.

---

## 5.3 Active question screen

This is the most important screen of the PoC.

Show one question at a time.

Visible elements:

* Question category.
* Current question number and total.

  * Example: “Pregunta 3/10”
* Stage progress bar.
* Visible timer.
* Question text.
* Answer options or input, depending on the question type.
* Submit button when needed.
* Visual state for selected answer.

During a question:

* The user can answer only once.
* Once answered, the answer is locked.
* After a short transition, the app automatically moves to the next question.
* Do not show whether the answer was correct or incorrect during the stage.
* Do not show points during the stage.
* Do not show solutions during the stage.

The experience should feel:

* fast;
* clear;
* distraction-free;
* with large buttons;
* easy to use on mobile;
* fluid.

---

## 5.4 Transition between questions

After answering a question, show a brief transition for a few tenths of a second.

It may show Spanish text such as:

* “Respuesta enviada”
* “Siguiente pregunta”
* “Sigue el sprint”

Do not show whether the user was correct or wrong.

The transition should be quick, not slow or annoying.

---

## 5.5 If time runs out on a question

If the timer reaches zero:

* The question is marked as unanswered.
* It is saved as missed or unanswered.
* The app automatically moves to the next question after a short transition.
* The whole stage must not be blocked.
* The game must not restart.

---

## 5.6 Final results screen

After all questions are completed, show an attractive final screen.

It must include:

* Title:

  * “Etapa completada”
* Total score.
* Number of correct answers.
* Number of wrong answers.
* Number of unanswered questions.
* Total time used.
* Accuracy percentage.
* Dynamic Spanish message depending on performance:

  * If the user did very well: “Sprint brutal.”
  * If the user did okay: “Buen ritmo, pero puedes apretar más.”
  * If the user did poorly: “Etapa dura. Vuelve a intentarlo.”
* Button:

  * “Volver a jugar”
* Secondary button:

  * “Ver respuestas”

In this PoC, since it is single player, solutions can be shown after finishing.

---

## 5.7 Answer review screen or section

When the user clicks “Ver respuestas”, show a question-by-question summary.

For each question, show:

* Question number.
* Category.
* Question text.
* User answer.
* Correct answer.
* Whether it was correct, incorrect, or unanswered.
* Points earned.
* Time used.
* Short explanation.

This section can be displayed below the final screen or as a separate view within the same frontend app.

---

# 6. Question types to support

The PoC must include a demo stage with mock questions of several types.

It must support these question types:

## 6.1 Multiple choice

The question shows several options, usually 4.

Example:

* Question: “¿Cuál es la capital de Canadá?”
* Options:

  * Toronto
  * Ottawa
  * Vancouver
  * Montreal
* Correct answer:

  * Ottawa

The user taps an option and can submit it, or the option can be submitted automatically after tapping it. For this PoC, use selection first and then show a “Confirmar respuesta” button, to avoid accidental mistakes.

---

## 6.2 True/False

The question shows two large buttons:

* “Verdadero”
* “Falso”

This should be very fast to answer.

The answer can be submitted automatically on tap, or use a confirm button. For True/False, submit directly when tapping so it feels faster.

---

## 6.3 Short text answer

The question shows a text input and a submit button.

The correction must be flexible:

* ignore uppercase/lowercase;
* ignore accents;
* ignore extra spaces;
* allow equivalent answers configured in an array.

Example:

Question:

* “¿En qué año terminó la Segunda Guerra Mundial?”

Accepted answers:

* “1945”

Another example:

* Configured correct answer: “Cristóbal Colón”
* These should be accepted:

  * “cristobal colon”
  * “Cristobal Colon”
  * “CRISTÓBAL COLÓN”
  * “cristóbalcolon”

---

## 6.4 Image with multiple choice

The question must show an image and several options.

To avoid complicated external assets, you may use stable remote images or visual placeholders. If you prefer not to use external images, create a simulated visual card as an “image” using an emoji, flag, icon, or graphic block.

Example:

* Category: “Geografía”
* Image: Japanese flag or visual representation.
* Question: “¿A qué país pertenece esta bandera?”
* Options:

  * Japón
  * Corea del Sur
  * China
  * Vietnam
* Correct answer:

  * Japón

The image must look good on mobile.

---

# 7. Demo stage mock data

Create a mock data file, for example:

```txt
/data/demoStage.ts
```

It must contain a stage with 8 to 10 questions.

Each question structure must include at least:

```ts
type QuestionType = "multiple-choice" | "true-false" | "short-text" | "image-choice";

type Question = {
  id: string;
  type: QuestionType;
  category: string;
  question: string;
  options?: string[];
  correctAnswer: string | boolean;
  acceptedAnswers?: string[];
  imageUrl?: string;
  imageAlt?: string;
  timeLimit: number;
  points: number;
  explanation: string;
};
```

The stage should have a structure similar to:

```ts
export const demoStage = {
  id: "demo-stage",
  title: "Etapa Demo",
  subtitle: "Sprint de prueba",
  description: "Una etapa rápida para probar The Flash.",
  questions: [...]
};
```

Create varied questions in Spanish about general knowledge, geography, sports, cinema, history, science, music, or logic.

Do not make the questions too difficult. The goal is to test the experience, not frustrate the user.

---

# 8. Scoring system

Implement a simple but realistic scoring logic.

Each question has:

* Maximum value: `V`
* Time limit: `T`
* Time used by the user: `t`

If the answer is correct:

```txt
points = V × (1 - 0.5 × (t / T))
```

Rules:

* The maximum score is V.
* The minimum score for a correct answer is 50% of V.
* Round to the nearest integer.
* Ensure it never goes below 50% of the maximum value, rounded up.

Example:

Question worth 10 points with a 20-second limit:

* answer in 0s: 10 points;
* answer in 10s: about 8 points;
* answer in 20s: 5 points.

If the answer is incorrect:

* Multiple choice: penalty of 20% of the maximum value.
* Image with multiple choice: penalty of 20% of the maximum value.
* True/False: penalty of 40% of the maximum value.
* Short text answer: 0 points, no penalty.

For this PoC, the final total score cannot go below 0.

Create this logic in a separate file, for example:

```txt
/lib/scoring.ts
```

It must be well typed and easy to modify.

---

# 9. Timer

Create a reusable timer component, for example:

```txt
/components/Timer.tsx
```

Requirements:

* Receives `duration`.
* Receives callbacks:

  * `onTimeUp`.
  * optionally `onTick`.
* Shows remaining seconds.
* Shows visual progress, such as a circular bar, horizontal bar, or both.
* Changes visually when little time remains.
* Must be clear and visible.
* Must not produce bugs if the user answers right when the timer reaches zero.
* When moving to the next question, the timer must reset with the new question duration.

Important:

* Avoid multiple active intervals.
* Clean intervals properly.
* Do not allow a question to be answered twice.

---

# 10. Visual experience

The app must have its own visual identity.

Recommended visual direction:

* Dark background with gradients.
* Electric accents.
* Feeling of speed.
* Rounded cards.
* Large buttons.
* Clear typography.
* Microanimations.
* Visible progress.
* Hover/tap states.
* Mobile-first design.

The interface must feel like a modern app, not a basic HTML page.

Use Tailwind CSS for styles.

Use Framer Motion for:

* screen entrance animations;
* transitions between questions;
* button animations;
* final screen animation;
* progress bar animations;
* visual feedback for selected answers.

Do not overuse animations. They should improve the experience, not slow it down.

---

# 11. Suggested components

Organize the app into clear components.

Suggested structure:

```txt
/app
  page.tsx

/components
  StartScreen.tsx
  StageIntro.tsx
  QuestionScreen.tsx
  Timer.tsx
  AnswerOption.tsx
  ResultScreen.tsx
  ReviewAnswers.tsx
  ProgressBar.tsx

/data
  demoStage.ts

/lib
  scoring.ts
  normalizeAnswer.ts

/types
  game.ts
```

You may adjust the structure if needed, but keep the code clean and understandable.

---

# 12. Application state

The app must control local state for:

* current screen;
* current question index;
* user answers;
* start time of each question;
* time used per question;
* whether the answer was correct;
* points earned;
* whether the question was unanswered;
* final result.

Do not use Redux or unnecessary global state libraries.

Use `useState`, `useMemo`, `useCallback`, and `useEffect` where appropriate.

Avoid overengineering.

---

# 13. Screen states

Use a simple state machine or a state like:

```ts
type GameStatus = "start" | "intro" | "playing" | "transition" | "finished" | "review";
```

Expected behavior:

* `start`: start screen.
* `intro`: stage intro.
* `playing`: active question.
* `transition`: answer submitted / next question.
* `finished`: final results.
* `review`: answer review.

---

# 14. Rules during the stage

During the stage:

* Do not show whether an answer is correct.
* Do not show explanations.
* Do not show partial score.
* Do not allow going back.
* Do not allow changing a submitted answer.
* Do not pause the timer.
* If time runs out, automatically move forward.
* After the last question, go to results.

---

# 15. Accessibility and usability

Pay special attention to:

* Large, easy-to-tap buttons.
* Good contrast.
* Readable text on mobile.
* Visible focus states.
* Do not rely only on color to indicate selection.
* Inputs with clear labels or placeholders.
* Basic keyboard support:

  * Enter to submit short text answers.
  * Tab navigation.
* Avoid elements that are too small.

---

# 16. Responsive design

The app must be optimized for mobile.

On mobile:

* Content should use the screen well.
* Buttons must be large.
* The timer must always be visible.
* There should be no unnecessary scrolling during a normal question.
* The question and options must be comfortable to read.

On desktop:

* Center the experience in a card or max-width container.
* Do not stretch the content too much.
* Keep the app-like feel.

---

# 17. Example content

Create a demo stage with around 10 questions.

Example mix:

1. Multiple choice — Geography.
2. True/False — Sports.
3. Short text answer — History.
4. Image with multiple choice — Flags.
5. Multiple choice — Cinema.
6. True/False — Science.
7. Short text answer — General knowledge.
8. Image with multiple choice — Monuments or flags.
9. Multiple choice — Music.
10. True/False — Logic or curiosities.

Make sure every question has:

* category;
* question text;
* time limit;
* points;
* correct answer;
* explanation.

All example content must be written in Spanish.

---

# 18. Desired final result

At the end, I want an app that allows me to:

1. Open the web app.
2. See an attractive Spanish start screen.
3. Enter a demo stage.
4. Play question by question.
5. Feel tension because of the timer.
6. Answer different types of questions.
7. Reach a clear final screen.
8. See score, correct answers, wrong answers, and time.
9. Review answers.
10. Play again.

It must be fully functional without configuring any external service.

---

# 19. Code quality

The code must be:

* clean;
* typed;
* easy to read;
* organized by components;
* free of unnecessary duplication;
* ready to evolve later into an app with backend;
* but without building any backend now.

Do not create excessive abstractions.

Do not add out-of-scope features.

Prioritize making the demo playable, beautiful, and fluid.

---

# 20. Out of scope

Do not implement:

* login;
* registration;
* real users;
* rooms;
* invitation codes;
* multiplayer;
* rankings between players;
* real general leaderboard;
* admin panel;
* database;
* backend;
* Supabase;
* Firebase;
* notifications;
* Telegram;
* payments;
* exports;
* complex offline mode;
* audit logs;
* real image management;
* file uploads.

If any of these things seem necessary, simulate them visually or ignore them.

---

# 21. Important UX details

Pay special attention to:

* every button press should give immediate visual feedback;
* selected options must be clearly distinguishable;
* there should be no abrupt layout jumps;
* the timer should not flicker annoyingly;
* movement between questions should be quick;
* the final screen should feel rewarding;
* the experience should feel like a game, not a questionnaire;
* there should be a clear “sprint” feeling;
* the user should want to play again.

---

# 22. Deliverable

Return the complete project with all necessary files.

Include:

* folder structure;
* components;
* types;
* mock data;
* scoring logic;
* timer;
* screens;
* styles;
* instructions to run.

Do not overexplain: build the app.

The absolute priority is that the PoC is visual, fluid, and playable.

Project name: **The Flash PoC**.
