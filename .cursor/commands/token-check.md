# token-check

# Command: Token & Cost Estimation
- **Action**: Before you perform the task I am about to describe, analyze the current context (files included, project rules, and previous chat history).
- **Task**: Provide a structured estimate of the token usage for this specific request.
- **Breakdown**:
    1. **Input Tokens**: Estimate prompt + attached files + rules context.
    2. **Thinking Tokens**: Estimate based on your current reasoning effort (e.g., GPT-5.2 xHigh vs Claude Opus).
    3. **Output Tokens**: Estimate the length of the expected code change.
- **Cost Analysis**: Provide a rough dollar estimate based on current model rates (e.g., $15/1M tokens for Opus).
- **Safety**: If the total estimate exceeds 50,000 tokens, stop and ask for my confirmation before proceeding.