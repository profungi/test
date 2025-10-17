const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const { Mistral } = require('@mistralai/mistralai');
const config = require('../config');

class AIService {
  constructor() {
    this.provider = config.apis.ai.provider;
    this.initializeClients();
  }

  initializeClients() {
    const aiConfig = config.apis.ai;

    // 初始化OpenAI客户端
    if (aiConfig.openai.key) {
      this.openaiClient = new OpenAI({
        apiKey: aiConfig.openai.key
      });
    }

    // 初始化Gemini客户端
    if (aiConfig.gemini.key) {
      this.geminiClient = new GoogleGenerativeAI(aiConfig.gemini.key);
    }

    // 初始化Claude客户端
    if (aiConfig.claude.key) {
      this.claudeClient = new Anthropic({
        apiKey: aiConfig.claude.key
      });
    }

    // 初始化Mistral客户端
    if (aiConfig.mistral.key) {
      this.mistralClient = new Mistral({
        apiKey: aiConfig.mistral.key
      });
    }
  }

  // 获取当前AI提供商配置
  getCurrentConfig() {
    return config.apis.ai[this.provider];
  }

  // 检查当前提供商是否可用
  isProviderAvailable(provider = this.provider) {
    const aiConfig = config.apis.ai[provider];
    return aiConfig && aiConfig.key;
  }

  // 获取可用的AI提供商列表
  getAvailableProviders() {
    const available = [];
    if (config.apis.ai.openai.key) available.push('openai');
    if (config.apis.ai.gemini.key) available.push('gemini');
    if (config.apis.ai.claude.key) available.push('claude');
    if (config.apis.ai.mistral.key) available.push('mistral');
    return available;
  }

  // 切换AI提供商
  switchProvider(provider) {
    if (!this.isProviderAvailable(provider)) {
      throw new Error(`AI provider '${provider}' is not available or not configured`);
    }
    this.provider = provider;
    console.log(`Switched to AI provider: ${provider}`);
  }

  // 统一的聊天完成接口
  async chatCompletion(messages, options = {}) {
    const currentConfig = this.getCurrentConfig();

    if (!this.isProviderAvailable()) {
      throw new Error(`Current AI provider '${this.provider}' is not available`);
    }

    // 防止递归故障转移
    const skipFallback = options._skipFallback || false;

    try {
      switch (this.provider) {
        case 'openai':
          return await this.openaiChatCompletion(messages, options);

        case 'gemini':
          return await this.geminiChatCompletion(messages, options);

        case 'claude':
          return await this.claudeChatCompletion(messages, options);

        case 'mistral':
          return await this.mistralChatCompletion(messages, options);

        default:
          throw new Error(`Unsupported AI provider: ${this.provider}`);
      }
    } catch (error) {
      console.error(`❌ ${this.provider} API error:`, error.message);

      // 如果当前提供商失败且没有禁用故障转移，尝试切换到备用提供商
      if (!skipFallback) {
        const fallbackResult = await this.tryFallbackProvider(messages, options);
        if (fallbackResult) {
          return fallbackResult;
        }
      }

      throw error;
    }
  }

  // OpenAI聊天完成
  async openaiChatCompletion(messages, options) {
    const config = this.getCurrentConfig();
    
    const response = await this.openaiClient.chat.completions.create({
      model: options.model || config.model,
      messages: messages,
      temperature: options.temperature || 0.1,
      max_tokens: options.maxTokens || config.maxTokens
    });
    
    return {
      content: response.choices[0].message.content,
      provider: 'openai',
      model: response.model,
      usage: response.usage
    };
  }

  // Gemini聊天完成
  async geminiChatCompletion(messages, options) {
    const config = this.getCurrentConfig();
    const model = this.geminiClient.getGenerativeModel({ 
      model: options.model || config.model 
    });
    
    // 将messages格式转换为Gemini格式
    const prompt = this.convertMessagesToGeminiFormat(messages);
    
    const result = await model.generateContent({
      contents: [{
        parts: [{ text: prompt }]
      }]
    });
    
    const response = await result.response;
    
    return {
      content: response.text(),
      provider: 'gemini',
      model: config.model,
      usage: response.usageMetadata || {}
    };
  }

  // Claude聊天完成
  async claudeChatCompletion(messages, options) {
    const config = this.getCurrentConfig();

    // 将messages格式转换为Claude格式
    const { system, messages: claudeMessages } = this.convertMessagesToClaudeFormat(messages);

    const response = await this.claudeClient.messages.create({
      model: options.model || config.model,
      max_tokens: options.maxTokens || config.maxTokens,
      temperature: options.temperature || 0.1,
      system: system,
      messages: claudeMessages
    });

    return {
      content: response.content[0].text,
      provider: 'claude',
      model: response.model,
      usage: response.usage
    };
  }

  // Mistral聊天完成
  async mistralChatCompletion(messages, options) {
    const config = this.getCurrentConfig();

    const response = await this.mistralClient.chat.complete({
      model: options.model || config.model,
      messages: messages,
      temperature: options.temperature || 0.1,
      maxTokens: options.maxTokens || config.maxTokens
    });

    return {
      content: response.choices[0].message.content,
      provider: 'mistral',
      model: response.model,
      usage: response.usage
    };
  }

  // 尝试备用提供商
  async tryFallbackProvider(messages, options) {
    const availableProviders = this.getAvailableProviders();
    const otherProviders = availableProviders.filter(p => p !== this.provider);

    if (otherProviders.length === 0) {
      console.warn('⚠️  No fallback providers available');
      return null;
    }

    console.log(`🔄 Attempting fallback to alternative providers: ${otherProviders.join(', ')}`);

    for (const fallbackProvider of otherProviders) {
      try {
        console.log(`🔄 Trying fallback provider: ${fallbackProvider}`);
        const originalProvider = this.provider;
        this.switchProvider(fallbackProvider);

        // 防止递归故障转移
        const result = await this.chatCompletion(messages, { ...options, _skipFallback: true });

        // 恢复原始提供商设置
        this.provider = originalProvider;

        console.log(`✅ Fallback successful using ${fallbackProvider}`);
        return {
          ...result,
          fallbackUsed: true,
          originalProvider: originalProvider
        };

      } catch (fallbackError) {
        console.warn(`❌ Fallback provider ${fallbackProvider} also failed:`, fallbackError.message);
        // 恢复原始提供商
        this.provider = this.provider; // 确保不会停留在失败的提供商上
        continue;
      }
    }

    console.error('❌ All fallback providers exhausted');
    return null;
  }

  // 将messages转换为Gemini格式
  convertMessagesToGeminiFormat(messages) {
    let prompt = '';
    
    for (const message of messages) {
      if (message.role === 'system') {
        prompt += `System: ${message.content}\n\n`;
      } else if (message.role === 'user') {
        prompt += `User: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n\n`;
      }
    }
    
    return prompt.trim();
  }

  // 将messages转换为Claude格式
  convertMessagesToClaudeFormat(messages) {
    let system = '';
    const claudeMessages = [];
    
    for (const message of messages) {
      if (message.role === 'system') {
        system += message.content + '\n\n';
      } else if (message.role === 'user' || message.role === 'assistant') {
        claudeMessages.push({
          role: message.role,
          content: message.content
        });
      }
    }
    
    return {
      system: system.trim(),
      messages: claudeMessages
    };
  }

  // 获取提供商状态信息
  async getProviderStatus() {
    const available = this.getAvailableProviders();
    const current = this.provider;
    
    const status = {
      current: current,
      available: available,
      providers: {}
    };
    
    for (const provider of available) {
      status.providers[provider] = {
        configured: this.isProviderAvailable(provider),
        model: config.apis.ai[provider].model
      };
    }
    
    return status;
  }
}

module.exports = AIService;