client<llm> MindBridgeModel {
  provider openai-generic
  options {
    base_url "https://api.openai.com/v1"
    model "gpt-5-mini"
  }
}

retry_policy GenerationRetry {
  max_retries 2
  strategy {
    type exponential_backoff
    delay_ms 300
    multiplier 1.5
    max_delay_ms 3000
  }
}
