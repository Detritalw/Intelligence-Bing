// popup.js - 弹出页面脚本

document.addEventListener('DOMContentLoaded', function() {
  const statusDiv = document.getElementById('status');
  const toggleButton = document.getElementById('toggle');
  const saveConfigButton = document.getElementById('saveConfig');
  const testConnectionButton = document.getElementById('testConnection');
  const testResultDiv = document.getElementById('testResult');
  const modelSelect = document.getElementById('model');
  const maxTokensInput = document.getElementById('maxTokens');
  const promptPrefixTextarea = document.getElementById('promptPrefix');
  const authTokenInput = document.getElementById('authToken');
  
  // 获取插件状态和配置
  chrome.runtime.sendMessage({action: "getExtensionStatus"}, function(response) {
    if (response && response.enabled) {
      statusDiv.textContent = '插件已启用';
      statusDiv.className = 'enabled';
      toggleButton.textContent = '禁用插件';
    } else {
      statusDiv.textContent = '插件已禁用';
      statusDiv.className = 'disabled';
      toggleButton.textContent = '启用插件';
    }
  });
  
  // 获取配置
  chrome.storage.local.get(['model', 'maxTokens', 'promptPrefix', 'authToken'], function(result) {
    if (result.model) {
      modelSelect.value = result.model;
    }
    
    if (result.maxTokens) {
      maxTokensInput.value = result.maxTokens;
    }
    
    if (result.promptPrefix) {
      promptPrefixTextarea.value = result.promptPrefix;
    }
    
    if (result.authToken) {
      authTokenInput.value = result.authToken;
    }
  });
  
  // 切换插件状态
  toggleButton.addEventListener('click', function() {
    chrome.runtime.sendMessage({action: "toggleExtension"}, function(response) {
      if (response && response.status === "success") {
        if (response.enabled) {
          statusDiv.textContent = '插件已启用';
          statusDiv.className = 'enabled';
          toggleButton.textContent = '禁用插件';
        } else {
          statusDiv.textContent = '插件已禁用';
          statusDiv.className = 'disabled';
          toggleButton.textContent = '启用插件';
        }
      }
    });
  });
  
  // 保存配置
  saveConfigButton.addEventListener('click', function() {
    const config = {
      model: modelSelect.value,
      maxTokens: parseInt(maxTokensInput.value),
      promptPrefix: promptPrefixTextarea.value,
      authToken: authTokenInput.value
    };
    
    chrome.storage.local.set(config, function() {
      alert('配置已保存');
    });
  });
  
  // 测试 API 连接
  testConnectionButton.addEventListener('click', function() {
    testResultDiv.style.display = 'none';
    testResultDiv.className = 'test-result';
    testResultDiv.textContent = '测试中...';
    testResultDiv.style.display = 'block';
    
    // 检查浏览器在线状态
    if (!navigator.onLine) {
      testResultDiv.className = 'test-result test-error';
      testResultDiv.textContent = '浏览器处于离线状态，请检查网络连接';
      return;
    }
    
    // 获取当前配置
    chrome.storage.local.get(['model', 'authToken'], function(result) {
      const model = result.model || "Qwen/Qwen3-8B";
      const authToken = result.authToken || "";
      
      console.log("测试连接配置:", { model, authToken: `${authToken.substring(0, 10)}...` });
      
      // 发送测试请求
      fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "user",
              content: "你好"
            }
          ]
        })
        // 移除了 signal: AbortSignal.timeout(30000) 以取消超时限制
      })
      .then(response => {
        console.log("测试连接响应:", {
          status: response.status,
          statusText: response.statusText,
          headers: [...response.headers.entries()]
        });
        
        if (response.ok) {
          testResultDiv.className = 'test-result test-success';
          testResultDiv.textContent = '连接成功！';
          console.log("API连接测试成功");
        } else {
          response.text().then(errorText => {
            testResultDiv.className = 'test-result test-error';
            testResultDiv.textContent = `连接失败: ${response.status} ${response.statusText} - ${errorText}`;
            console.error("API连接测试失败:", response.status, response.statusText, errorText);
          }).catch(err => {
            testResultDiv.className = 'test-result test-error';
            testResultDiv.textContent = `连接失败: ${response.status} ${response.statusText}`;
            console.error("API连接测试失败:", response.status, response.statusText);
          });
        }
      })
      .catch(error => {
        console.error("API连接测试出现异常:", error);
        
        let errorMessage = error.message;
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          errorMessage = '请求超时，请检查网络连接';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = '网络连接失败，请检查网络设置';
        }
        
        testResultDiv.className = 'test-result test-error';
        testResultDiv.textContent = `连接失败: ${errorMessage}`;
      });
    });
  });
});