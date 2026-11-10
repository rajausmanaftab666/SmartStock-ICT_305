# Definition of Done

A story is done only when every item below is true.

1. Every acceptance criterion is met and checked by someone other than the author.
2. The code reached `main` through a pull request with one approving review.
3. CI passes: server typecheck, schema and seed build, all server tests and the client build.
4. New or changed API behaviour has automated tests.
5. Role permissions are checked on the server for every new route.
6. No secrets, `.env` files or real personal data are committed.
7. New screens work with a keyboard alone and every field has a visible label.
8. Docs are updated if commands or environment variables changed.
9. From Sprint 1, the change is deployed to staging and checked there.
10. The issue is closed and its card is in Done on the project board.
