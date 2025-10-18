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

  // 统一的聊天完成接口（带自动故障转移）
  async chatCompletion(messages, options = {}) {
    const providers = this.getProvidersToTry();

    for (const provider of providers) {
      try {
        console.log(`🤖 Trying AI provider: ${provider}`);
        const result = await this.callProvider(provider, messages, options);

        // 标记是否使用了fallback
        if (provider !== this.provider) {
          result.fallbackUsed = true;
          result.originalProvider = this.provider;
        }

        return result;

      } catch (error) {
        console.error(`❌ ${provider} failed:`, error.message);

        if (provider === providers[providers.length - 1]) {
          throw new Error(`All AI providers failed. Last error: ${error.message}`);
        }

        continue;
      }
    }
  }

  // 获取要尝试的提供商列表（当前优先，然后其他）
  getProvidersToTry() {
    const available = this.getAvailableProviders();
    const ordered = [this.provider];
    available.forEach(p => {
      if (p !== this.provider) {
        ordered.push(p);
      }
    });
    return ordered;
  }

  // 调用具体的provider（不修改实例状态）
  async callProvider(provider, messages, options) {
    if (!this.isProviderAvailable(provider)) {
      throw new Error(`Provider '${provider}' is not available`);
    }

    switch (provider) {
      case 'openai':
        return await this.openaiChatCompletion(messages, options);
      case 'gemini':
        return await this.geminiChatCompletion(messages, options);
      case 'claude':
        return await this.claudeChatCompletion(messages, options);
      case 'mistral':
        return await this.mistralChatCompletion(messages, options);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
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