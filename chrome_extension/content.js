// 内容抓取与预处理
function extractContent() {
  const article = new Readability(document.cloneNode(true)).parse();
  return {
    content: article.textContent.substring(0, 5000),
    hash: CryptoJS.MD5(article.textContent).toString().substr(0,8)
  };
}

// 通信处理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_CONTENT') {
    sendResponse(extractContent());
  }
});