// background.js - 后台脚本
let originalPageUrl = null;
let qwenTabId = null;

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("后台收到消息:", request);
  
  if (request.action === "bingSearchDetected") {
    // 收到 Bing 搜索请求
    console.log("开始处理 Bing 搜索:", request.query);
    
    // 构造 Qwen AI 搜索 URL
    const qwenUrl = `https://chat.qwen.ai/?q=${encodeURIComponent(request.query)}`;
    console.log("构造 Qwen 搜索 URL:", qwenUrl);
    
    // 保存原始页面 URL
    originalPageUrl = `https://www.bing.com/search?q=${encodeURIComponent(request.query)}`;
    
    // 在隐藏窗口中打开 Qwen AI 页面
    chrome.windows.create({
      url: qwenUrl,
      focused: false,
      state: 'minimized'
    }, (window) => {
      if (chrome.runtime.lastError) {
        console.error("创建窗口时出错:", chrome.runtime.lastError.message);
        return;
      }
      
      // 保存标签页 ID 以便后续通信
      qwenTabId = window.tabs[0].id;
      console.log("已在隐藏窗口中打开 Qwen 页面，标签页 ID:", qwenTabId);
      
      // 等待页面加载完成后提取内容
      chrome.tabs.onUpdated.addListener(function listen(tabId, info) {
        if (tabId === qwenTabId && info.status === 'complete') {
          console.log("Qwen 页面加载完成，准备提取内容");
          
          // 移除监听器，避免重复执行
          chrome.tabs.onUpdated.removeListener(listen);
          
          // 延迟一小段时间确保页面完全渲染
          setTimeout(() => {
            // 注入内容脚本提取回复
            chrome.scripting.executeScript({
              target: { tabId: qwenTabId },
              func: () => {
                // 等待并提取 Qwen 的回复
                return new Promise((resolve) => {
                  let attempts = 0;
                  const maxAttempts = 30; // 最多等待30秒
                  
                  function checkResponse() {
                    attempts++;
                    // 针对 chat.qwen.ai 网站的特定结构进行优化
                    const responseElement = document.querySelector('.svelte-1c06zsf p') || 
                                          document.querySelector('.svelte-1c06zsf') ||
                                          document.querySelector('[class*="answer"]') || 
                                          document.querySelector('[class*="response"]');
                    
                    if (responseElement && responseElement.textContent.trim()) {
                      resolve(responseElement.textContent.trim());
                    } else if (attempts < maxAttempts) {
                      setTimeout(checkResponse, 1000);
                    } else {
                      // 如果没有找到特定的回答元素，尝试获取页面主要内容
                      const bodyText = document.body.textContent.trim();
                      resolve(bodyText || "未能提取到有效回复内容");
                    }
                  }
                  
                  checkResponse();
                });
              }
            }, (results) => {
              if (chrome.runtime.lastError) {
                console.error("执行脚本时出错:", chrome.runtime.lastError.message);
                // 发送错误信息到 content script
                chrome.tabs.sendMessage(sender.tab.id, {
                  action: "displayQwenResponse",
                  response: "提取回复时发生错误: " + chrome.runtime.lastError.message
                });
                return;
              }
              
              const response = results[0]?.result || "未能获取回复内容";
              console.log("提取到的回复内容:", response);
              
              // 检查是否是验证页面
              if (response.includes("访问验证") && response.includes("拖动到最右边")) {
                console.log("检测到验证页面");
                // 发送原始页面 URL 以便用户可以打开完成验证
                chrome.tabs.sendMessage(sender.tab.id, {
                  action: "displayQwenResponse",
                  response: response
                }, (response) => {
                  if (chrome.runtime.lastError) {
                    console.error("发送回复到页面时出错:", chrome.runtime.lastError.message);
                  } else {
                    console.log("已将验证页面信息发送到页面");
                  }
                });
              } else {
                // 将回复发送回 content script
                chrome.tabs.sendMessage(sender.tab.id, {
                  action: "displayQwenResponse",
                  response: response
                }, (response) => {
                  if (chrome.runtime.lastError) {
                    console.error("发送回复到页面时出错:", chrome.runtime.lastError.message);
                  } else {
                    console.log("已将回复发送到页面");
                  }
                });
              }
              
              // 关闭隐藏窗口
              chrome.windows.remove(window.id, () => {
                if (chrome.runtime.lastError) {
                  console.error("关闭窗口时出错:", chrome.runtime.lastError.message);
                } else {
                  console.log("已关闭隐藏窗口");
                }
              });
            });
          }, 2000); // 等待2秒确保页面加载完成
        }
      });
    });
    
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
  } else if (request.action === "openOriginalPage") {
    // 打开原始页面
    if (originalPageUrl) {
      chrome.tabs.create({ url: 'https://chat.qwen.ai' }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error("打开原始页面时出错:", chrome.runtime.lastError.message);
          sendResponse({ status: "error", message: chrome.runtime.lastError.message });
        } else {
          console.log("已打开原始页面: https://chat.qwen.ai");
          sendResponse({ status: "success" });
        }
      });
    } else {
      console.log("没有可用的原始页面 URL");
      sendResponse({ status: "error", message: "没有可用的原始页面 URL" });
    }
    // 异步响应需要返回 true
    return true;
  }
});

// 初始化插件启用状态
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['extensionEnabled'], function(result) {
    if (result.extensionEnabled === undefined) {
      // 默认启用插件
      chrome.storage.local.set({extensionEnabled: true}, function() {
        console.log("插件已默认启用");
      });
    }
  });
});

// 在 Qwen AI 上执行搜索
async function performQwenSearch(searchQuery, tabId) {
  try {
    console.log("开始在 Qwen AI 上搜索:", searchQuery);
    
    // 创建一个隐藏窗口来打开 Qwen AI 页面
    const window = await chrome.windows.create({
      url: 'https://chat.qwen.ai',
      focused: false,
      width: 800,
      height: 600,
      left: 0,
      top: 0,
      type: 'popup'
    });
    
    const qwenTab = window.tabs[0];
    console.log("已创建隐藏窗口和 Qwen AI 标签页:", qwenTab.id);
    
    // 等待页面加载完成
    console.log("等待页面加载...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 在 Qwen AI 页面上执行脚本，输入搜索内容并点击搜索按钮
    chrome.scripting.executeScript({
      target: { tabId: qwenTab.id },
      func: (query) => {
        return new Promise((resolve) => {
          console.log("开始在 Qwen AI 页面上执行操作，搜索内容:", query);
          
          // 等待页面元素加载
          let attempts = 0;
          const maxAttempts = 15; // 最多尝试15次（30秒）
          
          const checkElements = setInterval(() => {
            attempts++;
            console.log(`尝试查找页面元素，第 ${attempts} 次尝试`);
            
            // 查找搜索按钮和输入框
            // 根据 Qwen.html 的结构，查找可能的元素
            const searchButton = document.querySelector('[class*="websearch_button"]') || 
                                document.querySelector('[data-testid="websearch_button"]') ||
                                document.querySelector('button[class*="search"]') ||
                                document.querySelector('._search_') ||
                                Array.from(document.querySelectorAll('button')).find(btn => 
                                  btn.textContent && (btn.textContent.includes('搜索') || btn.textContent.includes('Search')));
            
            const inputField = document.querySelector('[class*="chat-input"]') || 
                              document.querySelector('[data-testid="chat-input"]') ||
                              document.querySelector('textarea[class*="input"]') ||
                              document.querySelector('.chat-input') ||
                              document.querySelector('textarea');
            
            const sendButton = document.querySelector('[class*="send-message-button"]') || 
                              document.querySelector('[data-testid="send-message-button"]') ||
                              document.querySelector('button[type="submit"]') ||
                              document.querySelector('.send-button') ||
                              Array.from(document.querySelectorAll('button')).find(btn => 
                                btn.textContent && (btn.textContent.includes('发送') || btn.textContent.includes('Send')));
            
            console.log("查找到的元素:", { searchButton, inputField, sendButton });
            
            if (searchButton && inputField && sendButton) {
              clearInterval(checkElements);
              console.log("找到所有必需元素，开始执行操作");
              
              // 点击搜索按钮
              console.log("点击搜索按钮");
              searchButton.click();
              
              // 等待搜索界面出现
              setTimeout(() => {
                console.log("输入搜索内容:", query);
                // 输入搜索内容
                inputField.value = query;
                
                // 触发输入事件
                const inputEvent = new Event('input', { bubbles: true });
                inputField.dispatchEvent(inputEvent);
                
                const changeEvent = new Event('change', { bubbles: true });
                inputField.dispatchEvent(changeEvent);
                
                // 创建并触发 React 事件（如果适用）
                try {
                  const reactEvent = new Event('change', { bubbles: true });
                  Object.defineProperty(reactEvent, 'target', {
                    writable: false,
                    value: inputField
                  });
                  inputField.dispatchEvent(reactEvent);
                } catch (e) {
                  console.log('无法触发 React 事件');
                }
                
                // 点击发送按钮
                setTimeout(() => {
                  console.log("点击发送按钮");
                  sendButton.click();
                  resolve("Search executed successfully");
                }, 1000);
              }, 2000);
            } else if (attempts >= maxAttempts) {
              clearInterval(checkElements);
              console.log("超时，无法找到所需元素");
              resolve("Timeout waiting for elements");
            }
          }, 2000);
        });
      },
      args: [searchQuery]
    }, async (results) => {
      console.log("Qwen 搜索执行结果:", results);
      
      // 等待 AI 回复
      console.log("等待 AI 回复...");
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // 获取 AI 回复内容
      chrome.scripting.executeScript({
        target: { tabId: qwenTab.id },
        func: () => {
          console.log("开始提取 AI 回复内容");
          
          // 尝试多种方式获取回复内容
          // 方式1: 查找可能包含回复内容的容器
          const responseContainers = document.querySelectorAll('.response-content-container');
          
          console.log("找到的消息容器数量:", responseContainers.length);
          
          // 方式2: 查找特定的回复内容容器
          const responseContentContainers = document.querySelectorAll('.response-content-container');
          
          console.log("找到的回复内容容器数量:", responseContentContainers.length);
          
          // 优先使用特定的回复内容容器
          if (responseContentContainers.length > 0) {
            const lastContainer = responseContentContainers[responseContentContainers.length - 1];
            const responseText = lastContainer.innerText || lastContainer.textContent;
            console.log("从回复内容容器提取到的回复内容:", responseText);
            return responseText;
          }
          
          // 如果没有特定容器，使用消息容器
          if (responseContainers.length > 0) {
            const lastResponse = responseContainers[responseContainers.length - 1];
            const responseText = lastResponse.innerText || lastResponse.textContent;
            console.log("从消息容器提取到的回复内容:", responseText);
            return responseText;
          }
          
          // 如果找不到特定的消息元素，尝试获取页面上的任何文本内容
          const pageText = document.body.innerText.substring(0, 1000);
          console.log("未找到特定消息元素，返回页面文本:", pageText);
          return pageText;
        }
      }, (responseResults) => {
        let aiResponse = "未能获取到 AI 回复";
        console.log("AI 回复提取结果:", responseResults);
        
        if (responseResults && responseResults[0] && responseResults[0].result) {
          aiResponse = responseResults[0].result;
        }
        
        console.log("最终回复内容:", aiResponse);
        
        // 关闭 Qwen AI 窗口
        setTimeout(() => {
          console.log("关闭 Qwen AI 窗口");
          chrome.windows.remove(window.id);
        }, 3000);
        
        // 将结果发送回 Bing 页面
        console.log("将回复发送到 Bing 页面");
        chrome.tabs.sendMessage(tabId, {
          action: "displayQwenResponse",
          response: aiResponse
        }, (response) => {
          // 忽略可能的错误，因为标签页可能已经关闭
          if (chrome.runtime.lastError) {
            console.log("发送消息时出错（可能是标签页已关闭）:", chrome.runtime.lastError.message);
          } else {
            console.log("成功发送回复到 Bing 页面");
          }
        });
      });
    });
  } catch (error) {
    console.error("执行 Qwen 搜索时出错:", error);
    
    // 发送错误信息到 Bing 页面
    chrome.tabs.sendMessage(tabId, {
      action: "displayQwenResponse",
      response: "获取 AI 回复时出错: " + error.message
    }, (response) => {
      // 忽略可能的错误
      if (chrome.runtime.lastError) {
        console.log("发送错误消息时出错:", chrome.runtime.lastError.message);
      }
    });
  }
}