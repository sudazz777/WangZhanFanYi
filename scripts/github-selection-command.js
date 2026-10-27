  async function translateSelection() {
    if (busy) return;
    let text;
    try {text=selectedText();} catch(error) {window.alert(error.message);return;}
    if(!text){window.alert('请先在 README 或讨论正文中选中文字，再使用篡改猴菜单。');return;}
    if(!window.confirm('将以下选中文字发送至 Google 翻译；不上传整页，译文仅通过浏览器对话框显示。\n\n原文预览：\n'+text.slice(0,240)+(text.length>240?'…':'')+'\n\n是否继续？'))return;
    const id=++requestId;busy=true;
    try {
      const result=await request(text);
      if(id===requestId)window.alert('译文：\n\n'+result);
    }catch{
      if(id===requestId)window.alert('在线翻译失败，请检查 Google 翻译连接后重试。');
    }finally{if(id===requestId)busy=false;}
  }
