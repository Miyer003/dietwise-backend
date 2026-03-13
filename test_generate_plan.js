const http = require('http');

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlYTM4OWFmMy0wNDliLTQ4NGUtOTdlOC0xY2I1MzRlNmU2MWEiLCJwaG9uZSI6IjE1NjE3NjEyNjgxIiwicm9sZSI6InVzZXIiLCJqdGkiOiIxNzczNDA0NDQxNzM4X2o2dTJ6ZzFpOWZnIiwiaWF0IjoxNzczNDA0NDQxLCJleHAiOjE3NzQwMDkyNDF9.Vb_r9-TJqQhSzQcX4ZNuKHJBHOTsSCTXf0dvF7Q8IIs";

const postData = JSON.stringify({
  calorieTarget: 2000,
  mealCount: 3,
  healthGoal: '维持',
  flavorPrefs: ['清淡', '少油'],
  heightCm: 175,
  weightKg: 65
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/v1/ai/generate-plan',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Length': Buffer.byteLength(postData)
  },
  timeout: 120000
};

console.log('开始请求AI生成食谱（可能需要60-90秒）...');
console.time('总耗时');

const req = http.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
    process.stdout.write('.');
  });
  
  res.on('end', () => {
    console.log('\n');
    console.timeEnd('总耗时');
    try {
      const json = JSON.parse(data);
      console.log('响应code:', json.code);
      console.log('响应message:', json.message);
      if (json.data) {
        console.log('食谱ID:', json.data.id);
        console.log('每日热量:', json.data.calorieTarget);
        console.log('天数:', json.data.days?.length);
        if (json.data.days && json.data.days.length > 0) {
          console.log('\n=== 第一天食谱预览 ===');
          const firstDay = json.data.days.filter(d => d.dayOfWeek === 1);
          firstDay.forEach(meal => {
            console.log(`\n${meal.mealType}:`);
            meal.dishes?.forEach(dish => {
              console.log(`  - ${dish.name} (${dish.quantity_g}g, ${dish.calories}kcal)`);
            });
          });
        }
      }
    } catch (e) {
      console.log('原始响应:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error(`请求错误: ${e.message}`);
});

req.on('timeout', () => {
  console.error('请求超时');
  req.destroy();
});

req.write(postData);
req.end();
