// popup.js - 弹出页面脚本

document.addEventListener('DOMContentLoaded', function() {
  const toggleButton = document.getElementById('toggle-extension');
  
  // 检查插件状态
  chrome.storage.local.get(['extensionEnabled'], function(result) {
    const isEnabled = result.extensionEnabled !== false; // 默认启用
    console.log("获取插件状态:", isEnabled);
    updateToggleButton(isEnabled);
  });
  
  // 切换插件状态
  toggleButton.addEventListener('click', function() {
    chrome.storage.local.get(['extensionEnabled'], function(result) {
      const isEnabled = result.extensionEnabled !== false;
      const newState = !isEnabled;
      
      console.log("切换插件状态:", newState);
      
      chrome.storage.local.set({extensionEnabled: newState}, function() {
        updateToggleButton(newState);
        
        // 通知 content script 状态变化
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "extensionStatusChanged",
            enabled: newState
          });
        });
      });
    });
  });
  
  function updateToggleButton(enabled) {
    toggleButton.textContent = enabled ? '禁用插件' : '启用插件';
    console.log("更新切换按钮文本:", toggleButton.textContent);
  }
});

// 发送测试消息
function sendTestMessage() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {action: "test"}, function(response) {
      console.log("测试消息响应:", response);
    });
  });
}