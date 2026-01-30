# Agentic Test-Driven Development (TDD)
- **Goal**: Implement requested features using a "Prover-First" autonomous loop.
- **Workflow**:
    1. **Plan**: Identify logic requirements and edge cases.
    2. **Red**: Create a new `.test.ts` file. Do NOT touch production code yet.
    3. **First Run**: Run `npm test`. Confirm the new test fails.
    4. **Implementation**: Write the minimal code needed to pass.
    5. **The Loop (YOLO Mode)**: 
        - Auto-execute `npm test`. 
        - If terminal shows **FAIL**, read the error output. 
        - Apply a fix IMMEDIATELY without asking for permission.
        - Repeat until terminal shows **PASS**.
- **Exit Condition**: Only stop when the terminal is green.
- **Summary**: Present the final code and the successful test result to the user.