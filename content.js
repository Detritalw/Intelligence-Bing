// content.js - 在 Bing 页面上运行

let extensionEnabled = true;
let markdownit = null;

// 动态加载 markdown-it 库
function loadMarkdownIt() {
  return new Promise((resolve, reject) => {
    // 如果已经加载过，直接返回
    if (markdownit) {
      resolve(markdownit);
      return;
    }
    
    // 创建 script 标签动态加载 markdown-it
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/markdown-it@13.0.1/dist/markdown-it.min.js';
    script.onload = () => {
      if (window.markdownit) {
        markdownit = window.markdownit({
          html: false,        // 禁用 HTML 标签
          xhtmlOut: false,    // 使用 '/' 来关闭单标签 (比如 <br />)
          breaks: true,       // 转换 '\n' 为 <br>
          linkify: true,      // 自动转换 URL 为链接
          typographer: true,  // 启用替换符号，比如 (c) → ©
          quotes: '""\'\''    // 引号替换对
        });
        resolve(markdownit);
      } else {
        reject(new Error('markdown-it 加载失败'));
      }
    };
    script.onerror = () => {
      reject(new Error('markdown-it 加载失败'));
    };
    document.head.appendChild(script);
  });
}

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
      <h3>AI 回复</h3>
      <div class="qwen-buttons">
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
  
  const buttonStyle = `
    background: #0078d4;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
  `;
  
  container.querySelector('#close-qwen-response').style.cssText = buttonStyle;
  
  container.querySelector('.qwen-content').style.cssText = `
    background-color: #F2F8FF;
    color: black;
  `;
  
  // 添加关闭按钮功能
  container.querySelector('#close-qwen-response').addEventListener('click', function() {
    console.log("用户点击关闭按钮");
    container.remove();
  });
  
  // 尝试将容器添加到必应右侧边栏
  try {
    insertContainerInSidebar(container);
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

// 在必应右侧边栏插入容器
function insertContainerInSidebar(container) {
  // 查找必应右侧边栏 - 更全面的选择器
  const sidebar = document.querySelector('#b_context') || 
                 document.querySelector('.b_context') ||
                 document.querySelector('#b_sidebar') ||
                 document.querySelector('.b_sidebar') ||
                 document.querySelector('#rhs') ||  // Google样式右侧栏
                 document.querySelector('.rhs');    // Google样式右侧栏
  
  if (sidebar) {
    console.log("找到右侧边栏，将内容插入到右侧边栏顶部");
    // 如果找到右侧边栏，将容器插入到顶部
    if (sidebar.firstChild) {
      sidebar.insertBefore(container, sidebar.firstChild);
    } else {
      sidebar.appendChild(container);
    }
    return;
  }
  
  // 如果没有找到右侧边栏，尝试在主内容区域找到合适的位置
  const relatedSearches = document.querySelector('#b_content #relatedSearches');
  const resultsContainer = document.querySelector('#b_content #b_results');
  const mainContent = document.querySelector('#b_content');
  
  if (relatedSearches && resultsContainer) {
    console.log("在相关搜索和结果之间插入内容");
    // 插入到相关搜索和结果之间
    resultsContainer.parentNode.insertBefore(container, resultsContainer);
    return;
  } else if (mainContent) {
    console.log("在主内容区域插入内容");
    // 插入到主内容区域的开头
    if (mainContent.firstChild) {
      mainContent.insertBefore(container, mainContent.firstChild);
    } else {
      mainContent.appendChild(container);
    }
    return;
  }
  
  // 最后的备选方案：添加到body开头
  console.log("使用备选方案，将内容添加到页面顶部");
  if (document.body.firstChild) {
    document.body.insertBefore(container, document.body.firstChild);
  } else {
    document.body.appendChild(container);
  }
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
  
  // 根据响应内容调整显示样式
  const contentElement = container.querySelector('.qwen-content');
  if (response.includes("获取 AI 回复时出错") || response.includes("网络连接错误") || response.includes("认证失败")) {
    contentElement.style.color = "#d32f2f";
    contentElement.style.fontWeight = "bold";
    // 错误信息直接显示，不进行 Markdown 解析
    contentElement.innerHTML = response;
  } else {
    // 对正常回复进行 Markdown 解析
    renderMarkdown(response).then(html => {
      contentElement.innerHTML = html;
    }).catch(error => {
      console.error("Markdown 渲染出错:", error);
      // 如果渲染出错，直接显示原始文本
      contentElement.innerHTML = response;
    });
  }
  
  console.log("Qwen AI 回复已显示在页面上");
}

// Markdown 渲染函数
function renderMarkdown(markdownText) {
  return new Promise((resolve, reject) => {
    loadMarkdownIt().then(md => {
      try {
        const html = md.render(markdownText);
        resolve(html);
      } catch (error) {
        reject(error);
      }
    }).catch(error => {
      // 如果 markdown-it 加载失败，使用简单的渲染方式
      console.warn("markdown-it 加载失败，使用简单渲染:", error);
      resolve(simpleMarkdownRender(markdownText));
    });
  });
}

// 简单的 Markdown 渲染作为备选方案
function simpleMarkdownRender(markdownText) {
  let html = markdownText;
  
  // 处理代码块
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  
  // 处理行内代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // 处理粗体
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // 处理斜体
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // 处理链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  // 处理无序列表
  html = html.replace(/^\s*-\s(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  
  // 处理有序列表
  html = html.replace(/^\s*([\d]+)\.\s(.+)$/gm, '<li data-line="$1">$2</li>');
  html = html.replace(/(<li data-line="\d">.*<\/li>)/gs, '<ol>$1</ol>');
  html = html.replace(/ data-line="\d+"/g, '');
  
  // 处理标题
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  
  // 处理段落
  html = html.replace(/^\s*(\w[^<>]*)$/gm, '<p>$1</p>');
  
  // 处理换行
  html = html.replace(/\n/g, '<br>');
  
  return html;
}