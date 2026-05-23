# Nova Providers

Nova supports 12 LLM providers. Set the corresponding environment variable to enable each provider.

## Provider List

| # | Provider | Env Var | Base URL | Models |
|---|----------|---------|----------|--------|
| 1 | **DeepSeek** | `DEEPSEEK_API_KEY` | https://api.deepseek.com | deepseek-v4-flash, deepseek-v4-pro, deepseek-chat, deepseek-reasoner |
| 2 | **Anthropic** | `ANTHROPIC_API_KEY` | https://api.anthropic.com | claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5, etc. |
| 3 | **OpenAI** | `OPENAI_API_KEY` | https://api.openai.com/v1 | gpt-4o, gpt-4o-mini, o3-mini, o1, etc. |
| 4 | **Gemini** | `GEMINI_API_KEY` | https://generativelanguage.googleapis.com | gemini-2.5-pro, gemini-2.0-flash, etc. |
| 5 | **Ollama** | (none, local) | http://127.0.0.1:11434 | llama3.3, qwen2.5-coder, etc. |
| 6 | **Qwen** | `DASHSCOPE_API_KEY` | https://dashscope.aliyuncs.com | qwen-max, qwen-plus, qwen-turbo, qwq-32b |
| 7 | **Zhipu** | `ZHIPU_API_KEY` | https://open.bigmodel.cn | glm-4-plus, glm-4-flash, glm-z1-flash |
| 8 | **Kimi** | `MOONSHOT_API_KEY` | https://api.moonshot.cn/v1 | moonshot-v1-8k/32k/128k, kimi-latest |
| 9 | **MiniMax** | `MINIMAX_API_KEY` | https://api.minimax.chat/v1 | MiniMax-Text-01, abab6.5s-chat |
| 10 | **LM Studio** | `LMSTUDIO_API_KEY` | http://127.0.0.1:1234/v1 | lmstudio-model (loaded model) |
| 11 | **Grok** | `XAI_API_KEY` | https://api.x.ai/v1 | grok-3, grok-3-mini, grok-2 |
| 12 | **Custom** | `CUSTOM_API_KEY` + `CUSTOM_BASE_URL` | (configurable) | custom-model |

## Model String Format

```
<provider-id>/<model-id>
```

Examples:
- `deepseek/deepseek-chat`
- `anthropic/claude-sonnet-4-6`
- `openai/gpt-4o`
- `gemini/gemini-2.0-flash`
- `ollama/llama3.3`
- `qwen/qwen-max`
- `grok/grok-3`
- `custom/custom-model`

## Adding a New Provider

1. Create `packages/provider-<name>/src/index.ts`
2. Implement `ProviderPlugin` interface from `@nova/sdk`
3. Import and register in `packages/core/src/main.ts`
