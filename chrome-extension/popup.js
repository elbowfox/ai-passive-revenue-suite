const FREE_LIMIT = 10;

async function getUsage() {
  const data = await chrome.storage.local.get(['usage', 'usageDate']);
  const today = new Date().toDateString();
  if (data.usageDate !== today) {
    await chrome.storage.local.set({ usage: 0, usageDate: today });
    return 0;
  }
  return data.usage || 0;
}

async function incrementUsage() {
  const usage = await getUsage();
  await chrome.storage.local.set({ usage: usage + 1, usageDate: new Date().toDateString() });
}

function updateUsageDisplay(usage) {
  document.getElementById('usage').innerHTML = usage >= FREE_LIMIT 
    ? `<span class="premium">Limit reached. Upgrade for unlimited access.</span>`
    : `Usage: ${usage} / ${FREE_LIMIT} free today. Upgrade for unlimited.`;
}

async function callAI(prompt, content) {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) {
    return "Please set your AI API key in the extension options (or connect to our premium backend).";
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes web content concisely and extracts actionable insights.' },
          { role: 'user', content: `${prompt}\n\nContent:\n${content.substring(0, 12000)}` }
        ],
        max_tokens: 600
      })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Error generating response.';
  } catch (e) {
    return 'API error: ' + e.message;
  }
}

async function getPageContent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.body.innerText
  });
  return results[0]?.result || '';
}

document.addEventListener('DOMContentLoaded', async () => {
  const usage = await getUsage();
  updateUsageDisplay(usage);

  const handleAction = async (prompt) => {
    const usage = await getUsage();
    if (usage >= FREE_LIMIT) {
      document.getElementById('output').textContent = 'Daily free limit reached. Click Upgrade for unlimited summaries and premium features.';
      return;
    }
    document.getElementById('output').textContent = 'Analyzing page...';
    const content = await getPageContent();
    if (!content) {
      document.getElementById('output').textContent = 'Could not read page content.';
      return;
    }
    const result = await callAI(prompt, content);
    document.getElementById('output').textContent = result;
    await incrementUsage();
    updateUsageDisplay(await getUsage());
  };

  document.getElementById('summarize').addEventListener('click', () => 
    handleAction('Provide a clear, concise summary of this webpage in 3-5 sentences. Focus on the main points.')
  );
  document.getElementById('keypoints').addEventListener('click', () => 
    handleAction('Extract the 5-8 most important key points or takeaways from this page as a bulleted list.')
  );
  document.getElementById('social').addEventListener('click', () => 
    handleAction('Generate 2 short social media posts (one for X/Twitter, one for LinkedIn) based on the key insights of this page. Make them engaging.')
  );

  document.getElementById('upgrade').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://your-domain.com/upgrade' });
  });
});
