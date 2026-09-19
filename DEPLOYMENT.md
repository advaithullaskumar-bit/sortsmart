# SortSmart Vercel deployment checklist

1. Import this project into Vercel.
2. Add `GEMINI_API_KEY` as an Environment Variable for Preview and Production. Do not commit it or paste it into the repository.
3. Add `GEMINI_MODEL` with `gemini-3.6-flash` unless Google AI Studio shows a different available multimodal model for the account.
4. Deploy without changing the build command. The static interface is routed from `outputs/index.html`; `/api/classify` is a Vercel Node function.
5. Verify the deployed URL with one wet-waste image, one dry-waste image, one e-waste image, one battery image, and one ambiguous pile.
6. Confirm that an API failure produces an explicit human-review result rather than a guessed bin.

The impact numbers and leaderboard are demo data and must remain labeled as such until replaced with measured pilot data.
