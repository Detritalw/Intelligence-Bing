// diagnostic.js - 网络诊断工具

document.addEventListener('DOMContentLoaded', function() {
  const networkResult = document.getElementById('networkResult');
  const dnsResult = document.getElementById('dnsResult');
  const apiResult = document.getElementById('apiResult');
  const fullResult = document.getElementById('fullResult');
  
  // 检查网络状态
  document.getElementById('checkNetwork').addEventListener('click', function() {
    networkResult.innerHTML = '';
    networkResult.className = 'result info';
    
    const isOnline = navigator.onLine;
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    
    networkResult.innerHTML = `浏览器在线状态: ${isOnline ? '在线' : '离线'}\n`;
    networkResult.innerHTML += `用户代理: ${userAgent}\n`;
    networkResult.innerHTML += `平台: ${platform}\n`;
  });
  
  // 检查 DNS 解析
  document.getElementById('checkDNS').addEventListener('click', function() {
    dnsResult.innerHTML = '正在检查 DNS 解析...';
    dnsResult.className = 'result info';
    
    // 使用 Image 对象尝试解析域名（这是一个变通方法）
    const img = new Image();
    const startTime = Date.now();
    
    img.onload = function() {
      const endTime = Date.now();
      dnsResult.innerHTML = `DNS 解析成功\n解析耗时: ${endTime - startTime} 毫秒`;
      dnsResult.className = 'result success';
    };
    
    img.onerror = function() {
      // 即使图片不存在，DNS 解析也可能成功
      const endTime = Date.now();
      dnsResult.innerHTML = `DNS 解析测试完成\n解析耗时: ${endTime - startTime} 毫秒`;
      dnsResult.className = 'result success';
    };
    
    // 尝试加载一个不存在的图片来触发 DNS 解析
    img.src = `https://api.siliconflow.cn/nonexistent_${Date.now()}.png`;
  });
  
  // 测试 API 连接
  document.getElementById('checkAPI').addEventListener('click', function() {
    apiResult.innerHTML = '正在测试 API 连接...';
    apiResult.className = 'result info';
    
    // 获取配置
    chrome.storage.local.get(['authToken'], function(result) {
      const authToken = result.authToken || "";
      
      // 发送测试请求
      fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "Qwen/Qwen3-8B",
          messages: [
            {
              role: "user",
              content: "网络诊断测试"
            }
          ]
        })
        // 移除了 signal: AbortSignal.timeout(30000) 以取消超时限制
      })
      .then(response => {
        if (response.ok) {
          apiResult.innerHTML = `API 连接成功\n状态码: ${response.status} ${response.statusText}`;
          apiResult.className = 'result success';
        } else {
          response.text().then(text => {
            apiResult.innerHTML = `API 连接失败\n状态码: ${response.status} ${response.statusText}\n响应内容: ${text}`;
            apiResult.className = 'result error';
          }).catch(() => {
            apiResult.innerHTML = `API 连接失败\n状态码: ${response.status} ${response.statusText}`;
            apiResult.className = 'result error';
          });
        }
      })
      .catch(error => {
        let errorMessage = error.message;
        if (error.name === 'AbortError') {
          errorMessage = '请求超时（30秒）';
        }
        
        apiResult.innerHTML = `API 连接失败\n错误信息: ${errorMessage}`;
        apiResult.className = 'result error';
      });
    });
  });
  
  // 运行完整诊断
  document.getElementById('fullDiagnostic').addEventListener('click', function() {
    fullResult.innerHTML = '正在运行完整诊断...';
    fullResult.className = 'result info';
    
    const results = [];
    
    // 检查网络状态
    const isOnline = navigator.onLine;
    results.push(`浏览器在线状态: ${isOnline ? '在线' : '离线'}`);
    
    if (!isOnline) {
      results.push('诊断终止：浏览器处于离线状态');
      fullResult.innerHTML = results.join('\n');
      fullResult.className = 'result error';
      return;
    }
    
    // 获取配置
    chrome.storage.local.get(['authToken'], function(result) {
      const authToken = result.authToken || "";
      results.push(`使用认证令牌: ${authToken.substring(0, 10)}...`);
      
      // 测试 API 连接
      fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "Qwen/Qwen3-8B",
          messages: [
            {
              role: "user",
              content: "网络诊断测试"
            }
          ]
        })
        // 移除了 signal: AbortSignal.timeout(30000) 以取消超时限制
      })
      .then(response => {
        if (response.ok) {
          results.push(`API 连接成功\n状态码: ${response.status} ${response.statusText}`);
          fullResult.innerHTML = results.join('\n');
          fullResult.className = 'result success';
        } else {
          response.text().then(text => {
            results.push(`API 连接失败\n状态码: ${response.status} ${response.statusText}\n响应内容: ${text}`);
            fullResult.innerHTML = results.join('\n');
            fullResult.className = 'result error';
          }).catch(() => {
            results.push(`API 连接失败\n状态码: ${response.status} ${response.statusText}`);
            fullResult.innerHTML = results.join('\n');
            fullResult.className = 'result error';
          });
        }
      })
      .catch(error => {
        let errorMessage = error.message;
        if (error.name === 'AbortError') {
          errorMessage = '请求超时（30秒）';
        }
        
        results.push(`API 连接失败\n错误信息: ${errorMessage}`);
        fullResult.innerHTML = results.join('\n');
        fullResult.className = 'result error';
      });
    });
  });
});