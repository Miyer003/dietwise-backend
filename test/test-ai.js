// 测试 AI API 密钥是否有效
const axios = require('axios');

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || 'sk-938c5c31354f42b281f36d5d45b1c62a';
const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY || 'sk-kimi-jzSWaHVhEe8aVmTA99PM3lKPtWbdtniLdDFCc2yqw9gMfaqNJlrpaHjRWlYzEhj9';

async function testDashscope() {
  console.log('=== 测试 Dashscope API ===');
  console.log('API Key:', DASHSCOPE_API_KEY.slice(0, 10) + '...');
  
  try {
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        model: 'qwen-turbo',
        input: {
          messages: [{ role: 'user', content: '你好' }]
        },
        parameters: {
          result_format: 'message',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    
    console.log('✅ Dashscope API 测试成功！');
    console.log('响应:', response.data.output?.choices?.[0]?.message?.content?.slice(0, 50) + '...');
    return true;
  } catch (error) {
    console.log('❌ Dashscope API 测试失败');
    console.log('状态码:', error.response?.status);
    console.log('错误信息:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testMoonshot() {
  console.log('\n=== 测试 Moonshot API ===');
  console.log('API Key:', MOONSHOT_API_KEY.slice(0, 10) + '...');
  
  try {
    const response = await axios.post(
      'https://api.moonshot.cn/v1/chat/completions',
      {
        model: 'moonshot-v1-8k',
        messages: [{ role: 'user', content: '你好' }],
      },
      {
        headers: {
          Authorization: `Bearer ${MOONSHOT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    
    console.log('✅ Moonshot API 测试成功！');
    console.log('响应:', response.data.choices?.[0]?.message?.content?.slice(0, 50) + '...');
    return true;
  } catch (error) {
    console.log('❌ Moonshot API 测试失败');
    console.log('状态码:', error.response?.status);
    console.log('错误信息:', error.response?.data?.error?.message || error.message);
    return false;
  }
}

async function main() {
  await testDashscope();
  await testMoonshot();
}

main().catch(console.error);
