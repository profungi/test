#!/usr/bin/env node

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
  if (!process.env.GEMINI_API_KEY) {
    console.log('❌ GEMINI_API_KEY 未设置');
    return;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // 测试不同的模型名称（2024年11月更新）
  // 注意：gemini-1.5-* 模型已于2024年9月退役
  const models = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
    'models/gemini-2.5-flash',
    'models/gemini-2.5-pro'
  ];

  console.log('🔍 测试可用的 Gemini 模型...\n');

  for (const modelName of models) {
    try {
      console.log(`测试模型: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Translate to Chinese: Hello');
      const response = await result.response;
      const text = response.text();
      console.log(`✅ 成功: ${modelName}`);
      console.log(`   响应: ${text}\n`);

      console.log(`\n🎉 找到可用模型: ${modelName}`);
      console.log(`请将代码中的模型名称改为: "${modelName}"`);
      return modelName;
    } catch (error) {
      console.log(`❌ 失败: ${error.message.substring(0, 150)}...\n`);
    }
  }

  console.log('❌ 所有模型都不可用');
}

testGemini().catch(console.error);
