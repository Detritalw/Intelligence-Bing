// qwen-iframe.js - 在 Qwen AI iframe 中运行

console.log("Qwen iframe 脚本已加载");

// 监听来自父页面的消息
window.addEventListener('message', function(event) {
  // 确保消息来自可信源
  if (event.origin !== 'https://cn.bing.com' && event.origin !== 'http://localhost:3000') {
    return;
  }
  
  console.log("Qwen iframe 收到来自父页面的消息:", event.data);
  
  // 处理来自父页面的消息
  if (event.data.action === 'performSearch') {
    // 执行搜索操作
    performSearch(event.data.query);
  }
});

// 在 Qwen AI 页面上执行搜索
function performSearch(searchQuery) {
  console.log("开始在 Qwen AI 页面上执行搜索:", searchQuery);
  
  // 等待页面元素加载
  let attempts = 0;
  const maxAttempts = 50; // 最多尝试50次（100秒）
  
  const checkElements = setInterval(() => {
    attempts++;
    console.log(`尝试查找页面元素，第 ${attempts} 次尝试`);
    
    // 查找搜索按钮和输入框
    const searchButton = document.querySelector('.websearch_button') ||
                        document.querySelector('[data-testid="websearch_button"]') ||
                        document.querySelector('button[data-testid*="search"]') ||
                        Array.from(document.querySelectorAll('button')).find(btn => 
                          btn.textContent && (btn.textContent.includes('搜索') || btn.textContent.includes('Search'))) ||
                        document.querySelector('button');
    
    const inputField = document.querySelector('#chat-input') ||
                      document.querySelector('[data-testid="chat-input"]') ||
                      document.querySelector('textarea[data-testid*="input"]') ||
                      document.querySelector('textarea[class*="input"]') ||
                      document.querySelector('.chat-input') ||
                      document.querySelector('textarea');
    
    const sendButton = document.querySelector('#send-message-button') ||
                      document.querySelector('[data-testid="send-message-button"]') ||
                      document.querySelector('button[type="submit"]') ||
                      document.querySelector('.send-button') ||
                      Array.from(document.querySelectorAll('button')).find(btn => 
                        btn.textContent && (btn.textContent.includes('发送') || btn.textContent.includes('Send'))) ||
                      document.querySelector('button:last-child');
    
    console.log("查找到的元素:", { searchButton, inputField, sendButton });
    
    // 检查是否找到关键元素
    if (inputField && (searchButton || sendButton)) {
      clearInterval(checkElements);
      console.log("找到必需元素，开始执行操作");
      
      // 如果有搜索按钮，先点击搜索按钮
      if (searchButton) {
        console.log("点击搜索按钮");
        searchButton.click();
        
        // 等待搜索界面出现
        setTimeout(() => {
          performSearchInInterface(inputField, sendButton, searchQuery);
        }, 2000);
      } else {
        // 直接在输入框中输入内容
        performSearchInInterface(inputField, sendButton, searchQuery);
      }
    } else if (attempts >= maxAttempts) {
      clearInterval(checkElements);
      console.log("超时，无法找到所需元素");
      
      // 通知父页面搜索失败
      window.parent.postMessage({
        action: 'searchFailed',
        reason: 'Timeout waiting for elements',
        query: searchQuery
      }, '*');
    }
  }, 2000);
}

// 在搜索界面中执行搜索
function performSearchInInterface(inputField, sendButton, searchQuery) {
  console.log("在搜索界面中执行搜索:", searchQuery);
  
  // 输入搜索内容
  inputField.value = searchQuery;
  
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
  
  // 点击发送按钮或按回车
  setTimeout(() => {
    if (sendButton) {
      console.log("点击发送按钮");
      sendButton.click();
    } else {
      console.log("未找到发送按钮，尝试按回车键");
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      });
      inputField.dispatchEvent(enterEvent);
    }
    
    // 通知父页面搜索已完成
    window.parent.postMessage({
      action: 'searchCompleted',
      query: searchQuery
    }, '*');
  }, 1000);
}

// 页面加载完成后尝试自动执行搜索（如果URL中包含查询参数）
window.addEventListener('load', function() {
  console.log("Qwen iframe 页面加载完成");
});