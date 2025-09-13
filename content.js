// content.js - 在 Bing 页面上运行

let extensionEnabled = true;

// 检测 Bing 搜索内容
function getBingSearchQuery() {
  // 从 URL 中获取搜索关键词
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get('q');
  console.log("检测到 Bing 搜索查询:", query);
  return query;
}

// 发送消息到后台脚本
function sendSearchQueryToBackground(query) {
  if (!extensionEnabled) {
    console.log("插件已禁用，不发送搜索查询");
    return;
  }
  
  console.log("发送搜索查询到后台脚本:", query);
  // 不需要等待响应，避免消息通道关闭的问题
  chrome.runtime.sendMessage({
    action: "bingSearchDetected",
    query: query
  });
}

// 监听页面加载完成
function handlePageLoad() {
  console.log("页面加载完成，检查插件状态");
  
  // 检查插件是否启用
  chrome.storage.local.get(['extensionEnabled'], function(result) {
    extensionEnabled = result.extensionEnabled !== false;
    console.log("插件启用状态:", extensionEnabled);
    
    // 检查是否是搜索结果页面
    if (window.location.href.includes('q=') && extensionEnabled) {
      const searchQuery = getBingSearchQuery();
      if (searchQuery) {
        console.log('检测到 Bing 搜索:', searchQuery);
        // 在发送请求前显示加载状态
        displayQwenLoading();
        sendSearchQueryToBackground(searchQuery);
      }
    }
  });
}

// 页面加载完成后执行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', handlePageLoad);
} else {
  handlePageLoad();
}

// 监听来自后台脚本的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("收到消息:", request);
  
  if (request.action === "displayQwenResponse") {
    if (extensionEnabled) {
      console.log("显示 Qwen AI 回复");
      displayQwenResponse(request.response);
    }
    sendResponse({status: "success"});
    return true; // 异步响应需要返回 true
  } else if (request.action === "extensionStatusChanged") {
    extensionEnabled = request.enabled;
    console.log("插件状态已更改:", extensionEnabled);
    
    // 如果插件被禁用，移除已显示的响应
    if (!extensionEnabled) {
      const existingContainer = document.getElementById('qwen-ai-response');
      if (existingContainer) {
        existingContainer.remove();
      }
    }
    sendResponse({status: "success"});
  }
  return true;
});

// 在 Bing 页面上显示加载状态
function displayQwenLoading() {
  console.log("正在显示 Qwen AI 加载状态");
  
  // 如果已经存在容器，先移除它
  const existingContainer = document.getElementById('qwen-ai-response');
  if (existingContainer) {
    existingContainer.remove();
  }
  
  // 创建容器元素
  const container = document.createElement('div');
  container.id = 'qwen-ai-response';
  container.innerHTML = `
    <div class="qwen-header">
      <h3>Qwen AI 回复</h3>
      <div class="qwen-buttons">
        <button id="open-original-page" style="display: none;">打开原页面</button>
        <button id="close-qwen-response">关闭</button>
      </div>
    </div>
    <div class="qwen-content">加载中...</div>
  `;
  
  // 添加样式
  container.style.cssText = `
    width: 100%;
    background: #f0f8ff;
    border: 1px solid #0078d4;
    border-radius: 4px;
    margin: 10px 0;
    padding: 15px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    box-sizing: border-box;
  `;
  
  container.querySelector('.qwen-header').style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  `;
  
  container.querySelector('.qwen-buttons').style.cssText = `
    display: flex;
    gap: 10px;
  `;
  
  const buttonStyle = `
    background: #0078d4;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
  `;
  
  container.querySelector('#open-original-page').style.cssText = buttonStyle;
  container.querySelector('#close-qwen-response').style.cssText = buttonStyle;
  
  container.querySelector('.qwen-content').style.cssText = `
    max-height: 200px;
    overflow-y: auto;
    background: white;
    padding: 10px;
    border-radius: 3px;
    border: 1px solid #ccc;
  `;
  
  // 添加关闭按钮功能
  container.querySelector('#close-qwen-response').addEventListener('click', function() {
    console.log("用户点击关闭按钮");
    container.remove();
  });
  
  // 添加打开原页面按钮功能
  container.querySelector('#open-original-page').addEventListener('click', function() {
    console.log("用户点击打开原页面按钮");
    chrome.runtime.sendMessage({action: "openOriginalPage"}, function(response) {
      if (chrome.runtime.lastError) {
        console.error("打开原页面时出错:", chrome.runtime.lastError.message);
      } else {
        console.log("已请求打开原页面");
      }
    });
  });
  
  // 尝试多种方式将容器添加到页面上
  try {
    // 首选位置：在主菜单和搜索结果之间插入
    const header = document.querySelector('#b_header');
    const results = document.querySelector('#b_results');
    
    if (header && results && header.parentNode && header.parentNode === results.parentNode) {
      // 插入到主菜单和搜索结果之间
      header.parentNode.insertBefore(container, results);
    } else if (header && header.parentNode) {
      // 如果只有header存在，则插入到header之后
      header.parentNode.insertBefore(container, header.nextSibling);
    } else {
      // 如果找不到特定元素，则插入到页面顶部
      const insertionPoint = document.querySelector('#b_content') || 
                            document.querySelector('#b_contentarea') || 
                            document.body;
      if (insertionPoint.firstChild) {
        insertionPoint.insertBefore(container, insertionPoint.firstChild);
      } else {
        insertionPoint.appendChild(container);
      }
    }
  } catch (e) {
    console.error("插入节点时出错:", e);
    // 最后的备选方案：添加到body开头
    if (document.body.firstChild) {
      document.body.insertBefore(container, document.body.firstChild);
    } else {
      document.body.appendChild(container);
    }
  }
  
  console.log("Qwen AI 加载状态已显示在页面上");
}

// 在 Bing 页面上显示 Qwen AI 的回复
function displayQwenResponse(response) {
  console.log("正在显示 Qwen AI 回复:", response);
  
  // 查找现有的容器元素
  const container = document.getElementById('qwen-ai-response');
  if (!container) {
    console.log("未找到 Qwen AI 容器");
    return;
  }
  
  // 检查是否是验证页面内容
  if (response.includes("访问验证") && response.includes("拖动到最右边")) {
    console.log("检测到验证页面内容，显示提示信息");
    
    // 显示"打开原页面"按钮
    const openButton = container.querySelector('#open-original-page');
    if (openButton) {
      openButton.style.display = 'block';
    }
    
    // 更新内容，提示用户需要完成验证
    const contentElement = container.querySelector('.qwen-content');
    contentElement.innerHTML = `
      <div>
        <p>Qwen AI 要求完成验证后才能继续访问。</p>
        <p>请点击"打开原页面"按钮，在新标签页中完成验证。</p>
      </div>
    `;
    
    console.log("已更新验证提示信息");
  } else {
    // 更新内容
    container.querySelector('.qwen-content').innerHTML = response;
    
    // 显示"打开原页面"按钮
    const openButton = container.querySelector('#open-original-page');
    if (openButton) {
      openButton.style.display = 'block';
    }
  }
  
  console.log("Qwen AI 回复已显示在页面上");
}