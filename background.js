// background.js - 后台脚本

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("后台收到消息:", request);
  
  if (request.action === "bingSearchDetected") {
    // 收到 Bing 搜索请求
    console.log("开始处理 Bing 搜索:", request.query);
    
    // 向 SiliconFlow API 发送请求
    sendRequestToSiliconFlow(request.query, sender.tab.id);
    
    // 立即返回，异步处理
    return true;
  } else if (request.action === "getExtensionStatus") {
    // 返回插件启用状态
    chrome.storage.local.get(['extensionEnabled'], function(result) {
      sendResponse({enabled: result.extensionEnabled !== false});
    });
    // 异步响应需要返回 true
    return true;
  } else if (request.action === "toggleExtension") {
    // 切换插件启用状态
    chrome.storage.local.get(['extensionEnabled'], function(result) {
      const newStatus = !(result.extensionEnabled !== false);
      chrome.storage.local.set({extensionEnabled: newStatus}, function() {
        console.log("插件状态已更新为:", newStatus);
        
        // 通知所有标签页插件状态已更改
        chrome.tabs.query({}, function(tabs) {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: "extensionStatusChanged",
              enabled: newStatus
            }, () => {
              // 忽略错误，因为不是所有标签页都有 content script
            });
          });
        });
        
        sendResponse({status: "success", enabled: newStatus});
      });
    });
    // 异步响应需要返回 true
    return true;
  }
});

// 向 SiliconFlow API 发送请求
async function sendRequestToSiliconFlow(query, tabId) {
  try {
    console.log("向 SiliconFlow API 发送请求，查询:", query);
    
    // 获取配置
    const config = await new Promise(resolve => {
      chrome.storage.local.get(['model', 'maxTokens', 'promptPrefix', 'authToken'], function(result) {
        resolve({
          model: result.model || "Qwen/Qwen3-8B",
          maxTokens: result.maxTokens || 2048,
          promptPrefix: result.promptPrefix || "你是一个帮助搜集互联网信息的助手，接下来用户会输入搜索关键词，请查找你所知道的和这个关键词有关的内容并进行总结，提取关键信息。",
          authToken: result.authToken || ""
        });
      });
    });
    
    console.log("使用配置:", config);
    
    // 构造提示词
    const finalQuery = config.promptPrefix ? `${config.promptPrefix}\n\n${query}` : query;
    
    console.log("准备发送请求到: https://api.siliconflow.cn/v1/chat/completions");
    console.log("请求头部:", {
      'Authorization': `Bearer ${config.authToken.substring(0, 10)}...`, // 只显示令牌前10位以保护隐私
      'Content-Type': 'application/json'
    });
    console.log("请求体:", {
      model: config.model,
      max_tokens: config.maxTokens,
      messages: [
        {
          role: "user",
          content: finalQuery
        }
      ]
    });
    
    // 发送请求前记录时间
    const startTime = Date.now();
    console.log("开始发送请求，时间:", new Date(startTime).toISOString());
    
    // 检查网络连接
    console.log("检查网络连接状态...");
    if (!navigator.onLine) {
      throw new Error("浏览器处于离线状态，请检查网络连接");
    }
    console.log("浏览器在线状态: 正常");
    
    // 尝试解析URL以检查是否可达
    try {
      const url = new URL('https://api.siliconflow.cn/v1/chat/completions');
      console.log("目标服务器信息:", {
        hostname: url.hostname,
        protocol: url.protocol,
        port: url.port || (url.protocol === 'https:' ? '443' : '80')
      });
    } catch (urlError) {
      console.error("URL解析错误:", urlError);
      throw new Error("API地址格式错误: " + urlError.message);
    }
    
    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        messages: [
          {
            role: "user",
            content: finalQuery
          }
        ]
      })
      // 移除了 signal: AbortSignal.timeout(30000) 以取消超时限制
    });
    
    // 记录响应时间和状态
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log("收到响应，时间:", new Date(endTime).toISOString(), "耗时:", duration, "毫秒");
    console.log("响应状态:", response.status, response.statusText);
    
    // 记录响应头部信息（不包括敏感信息）
    const responseHeaders = {};
    for (const [key, value] of response.headers.entries()) {
      // 过滤掉可能包含敏感信息的头部
      if (!key.toLowerCase().includes('authorization') && 
          !key.toLowerCase().includes('set-cookie') &&
          !key.toLowerCase().includes('cookie')) {
        responseHeaders[key] = value;
      }
    }
    console.log("响应头部:", responseHeaders);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("API 错误响应内容:", errorText);
      throw new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}, message: ${errorText}`);
    }
    
    const contentType = response.headers.get('content-type');
    console.log("响应内容类型:", contentType);
    
    if (!contentType || !contentType.includes('application/json')) {
      const textResponse = await response.text();
      console.error("非JSON响应内容:", textResponse);
      throw new Error(`Expected JSON response but got ${contentType || 'unknown type'}`);
    }
    
    const data = await response.json();
    console.log("收到 SiliconFlow API 响应数据:", data);
    
    // 提取回复内容 (SiliconFlow API 的响应格式可能与之前不同)
    let aiResponse = "无法获取回复内容";
    if (data.choices && data.choices.length > 0) {
      if (data.choices[0].message) {
        // 标准聊天完成格式
        aiResponse = data.choices[0].message.content;
      } else if (data.choices[0].text) {
        // 文本完成格式
        aiResponse = data.choices[0].text;
      }
    }
    
    console.log("提取的AI回复内容:", aiResponse);
    
    // 将回复发送到内容脚本
    chrome.tabs.sendMessage(tabId, {
      action: "displayQwenResponse",
      response: aiResponse
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("发送回复到页面时出错:", chrome.runtime.lastError.message);
      } else {
        console.log("已将 AI 回复发送到页面");
      }
    });
  } catch (error) {
    console.error("向 SiliconFlow API 发送请求时出错:", error);
    console.error("错误堆栈:", error.stack);
    
    let errorMessage = "获取 AI 回复时出错: " + error.message;
    
    // 提供更具体的错误信息
    if (error.message.includes("Failed to fetch")) {
      errorMessage = "网络连接错误，请检查网络设置或稍后重试";
      console.error("网络连接错误详情:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    } else if (error.message.includes("timeout")) {
      errorMessage = "请求超时，请检查网络连接或稍后重试";
    } else if (error.message.includes("401")) {
      errorMessage = "认证失败，请检查 Authorization Token 设置";
    } else if (error.message.includes("403")) {
      errorMessage = "访问被拒绝，请检查您的权限设置";
    } else if (error.message.includes("429")) {
      errorMessage = "请求过于频繁，请稍后再试";
    } else if (error.message.includes("offline")) {
      errorMessage = "浏览器处于离线状态，请检查网络连接";
    }
    
    // 发送错误信息到内容脚本
    chrome.tabs.sendMessage(tabId, {
      action: "displayQwenResponse",
      response: errorMessage
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("发送错误信息到页面时出错:", chrome.runtime.lastError.message);
      } else {
        console.log("已将错误信息发送到页面");
      }
    });
  }
}

// 初始化插件启用状态和默认配置
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['extensionEnabled', 'model', 'maxTokens', 'promptPrefix', 'authToken'], function(result) {
    // 设置默认启用状态
    if (result.extensionEnabled === undefined) {
      chrome.storage.local.set({extensionEnabled: true}, function() {
        console.log("插件已默认启用");
      });
    }
    
    // 设置默认配置
    const defaultConfig = {
      model: "Qwen/Qwen3-8B",
      maxTokens: 2048,
      promptPrefix: "",
      authToken: ""
    };
    
    // 检查并设置缺失的配置项
    const configToSet = {};
    if (result.model === undefined) configToSet.model = defaultConfig.model;
    if (result.maxTokens === undefined) configToSet.maxTokens = defaultConfig.maxTokens;
    if (result.promptPrefix === undefined) configToSet.promptPrefix = defaultConfig.promptPrefix;
    if (result.authToken === undefined) configToSet.authToken = defaultConfig.authToken;
    
    if (Object.keys(configToSet).length > 0) {
      chrome.storage.local.set(configToSet, function() {
        console.log("默认配置已设置:", configToSet);
      });
    }
  });
});