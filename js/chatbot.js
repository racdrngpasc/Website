/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   AI Chatbot - js/chatbot.js
   OpenRouter AI integration for Rotary/Rotaract knowledge
   ============================================================ */

'use strict';

class RotaractChatbot {
  constructor() {
    this.db = getSupabaseClient();
    this.isOpen = false;
    this.isTyping = false;
    this.conversationHistory = [];
    this.maxHistory = 20;
    this._settings = {};
    this._settingsLoaded = false;

    this.init();
  }

  /* ============================================================
     INITIALIZATION
     ============================================================ */
  async init() {
    await this.loadSettings();
    this.setupElements();
    this.setupEventListeners();
    this.loadChatHistory();
  }

  async loadSettings() {
    if (this._settingsLoaded) return;
    try {
      const { data } = await this.db
        .from('club_settings')
        .select('key, value');
      if (data) {
        data.forEach(s => { this._settings[s.key] = s.value; });
      }
      this._settingsLoaded = true;
    } catch (e) {
      console.warn('Chatbot settings load error:', e);
    }
  }

  getSetting(key, fallback = '') {
    return this._settings[key] || fallback;
  }

  /* ============================================================
     SETUP ELEMENTS
     ============================================================ */
  setupElements() {
    this.fab = document.getElementById('chatbot-fab');
    this.window = document.getElementById('chatbot-window');
    this.messagesContainer = document.getElementById('chatbot-messages');
    this.input = document.getElementById('chatbot-input');
    this.sendBtn = document.getElementById('chatbot-send-btn');
    this.closeBtn = document.getElementById('chatbot-close-btn');
    this.clearBtn = document.getElementById('chatbot-clear-btn');
    this.quickPrompts = document.querySelectorAll('.quick-prompt');
    this.badge = document.getElementById('chatbot-badge');
  }

  /* ============================================================
     SETUP EVENT LISTENERS
     ============================================================ */
  setupEventListeners() {
    // FAB toggle
    if (this.fab) {
      this.fab.addEventListener('click', () => this.toggleChat());
    }

    // Close button
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.closeChat());
    }

    // Clear button
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => this.clearChat());
    }

    // Send button
    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => this.sendMessage());
    }

    // Input enter key
    if (this.input) {
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      // Auto-resize input
      this.input.addEventListener('input', () => {
        this.input.style.height = 'auto';
        this.input.style.height = Math.min(this.input.scrollHeight, 100) + 'px';
      });
    }

    // Quick prompts
    if (this.quickPrompts) {
      this.quickPrompts.forEach(btn => {
        btn.addEventListener('click', () => {
          const prompt = btn.getAttribute('data-prompt');
          if (prompt && this.input) {
            this.input.value = prompt;
            this.sendMessage();
            // Hide quick prompts after use
            const container = document.getElementById('chatbot-quick-prompts');
            if (container) container.style.display = 'none';
          }
        });
      });
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (
        this.isOpen &&
        this.window &&
        this.fab &&
        !this.window.contains(e.target) &&
        !this.fab.contains(e.target)
      ) {
        this.closeChat();
      }
    });
  }

  /* ============================================================
     CHAT TOGGLE
     ============================================================ */
  toggleChat() {
    if (this.isOpen) {
      this.closeChat();
    } else {
      this.openChat();
    }
  }

  openChat() {
    this.isOpen = true;
    if (this.window) this.window.classList.add('active');
    if (this.fab) this.fab.classList.add('active');
    if (this.badge) this.badge.style.display = 'none';
    setTimeout(() => this.input?.focus(), 300);
    this.scrollToBottom();
  }

  closeChat() {
    this.isOpen = false;
    if (this.window) this.window.classList.remove('active');
    if (this.fab) this.fab.classList.remove('active');
  }

  /* ============================================================
     SEND MESSAGE
     ============================================================ */
  async sendMessage() {
    const message = this.input?.value?.trim();
    if (!message || this.isTyping) return;

    // Clear input
    if (this.input) {
      this.input.value = '';
      this.input.style.height = 'auto';
    }

    // Add user message to UI
    this.addMessage('user', message);

    // Add to history
    this.conversationHistory.push({
      role: 'user',
      content: message
    });

    // Trim history if too long
    if (this.conversationHistory.length > this.maxHistory) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistory);
    }

    // Show typing indicator
    this.showTyping();

    try {
      const response = await this.getAIResponse(message);
      this.hideTyping();

      if (response) {
        this.addMessage('bot', response);

        // Add to history
        this.conversationHistory.push({
          role: 'assistant',
          content: response
        });

        // Save chat history
        this.saveChatHistory();
      } else {
        this.addMessage('bot', 'I apologize, I could not process your request. Please try again.');
      }
    } catch (error) {
      console.error('Chatbot error:', error);
      this.hideTyping();
      this.addMessage(
        'bot',
        'I encountered an error while processing your request. Please check your connection and try again.'
      );
    }
  }

  /* ============================================================
     AI API CALL
     ============================================================ */
  async getAIResponse(userMessage) {
    const apiKey = AI_CONFIG.apiKey;
    const apiUrl = AI_CONFIG.apiUrl;
    const model = AI_CONFIG.model;
    const clubName = this.getSetting('club_name', CLUB_INFO.name);
    const clubId = this.getSetting('club_id', CLUB_INFO.clubId);
    const charterDate = this.getSetting('charter_date', CLUB_INFO.charterDate);
    const parentClub = this.getSetting('parent_club', CLUB_INFO.parentClub);

    const systemPrompt = `You are the official AI assistant for the ${clubName}, 
    parented by ${parentClub}. Club ID: ${clubId}. Charter Date: ${charterDate}. 
    Rotary International District 3206 (Coimbatore | Pallakkad).
    
    You are a comprehensive expert on:
    
    ROTARY INTERNATIONAL:
    - History: Founded February 23, 1905 by Paul P. Harris in Chicago
    - Motto: "Service Above Self"
    - Object of Rotary: Four-part object focusing on friendship, ethics, service, and international understanding
    - The Four-Way Test: Truth, Fairness, Goodwill & Friendships, Beneficial to all
    - Rotary Foundation: charitable arm funding scholarships, grants, peace programs
    - Paul Harris Fellow recognition
    - Major programs: End Polio Now, Global Grants, Peace Fellowships, RYLA, RYPEN
    - Areas of Focus: Peace, Disease Prevention, Water & Sanitation, Maternal Health, Education, Economic Development, Environment
    - Rotary clubs worldwide: 35,000+ clubs, 1.4 million members, 200+ countries
    
    ROTARACT:
    - Founded 1968 in Charlotte, North Carolina
    - Age group: 18-30 years
    - Currently 217,000+ members worldwide
    - Avenues of Service: Club Service, Community Service, Professional Service, International Service
    - How to join: Contact local club, attend meetings, apply for membership
    - Benefits: Leadership development, networking, community service, professional growth, international connections
    - Rotaract distinguishing pin and ID
    - RI ID system for Rotaractors
    
    ROTARY INTERNATIONAL DISTRICT 3206:
    - Covers: Coimbatore and Pallakkad regions
    - States: Tamil Nadu and Kerala, India
    - District Governor (DG) leads the district
    - District Priority Projects: specific initiatives prioritized by the district
    - District Conference, District Assembly, PETS (Presidents-Elect Training Seminar)
    - Groups 1-6 classification of clubs
    - RSAMDIO: Rotaract and Interact Multi District Interactive Organisation
    - District Rotaract Representative (DRR)
    - District Rotaract Committee (DRC)
    
    ROTARACT DISTRICT ORGANISATION 3206 (RDO 3206):
    - Official district-level body for Rotaract clubs
    - Organizes district-level Rotaract events
    - Coordinates between clubs and district administration
    - District Rotaract Meet (DRM)
    - Inter-Club activities and competitions
    
    RSAMDIO:
    - Rotaract and Interact Multi District Interactive Organisation
    - Brings together multiple Rotary districts' Rotaract and Interact clubs
    - Promotes fellowship, service, and collaboration across districts
    - Joint programs and events
    
    END POLIO NOW:
    - Rotary's commitment to eradicate polio worldwide since 1985
    - Partnership with WHO, UNICEF, CDC, Bill & Melinda Gates Foundation
    - National Immunization Days (NIDs)
    - Wild poliovirus cases reduced by 99.9%
    - Remaining endemic countries: Pakistan and Afghanistan
    - "This Close" campaign
    - World Polio Day: October 24
    - Purple pinky finger symbolizes vaccination
    
    OUR CLUB SPECIFICS:
    - Club Name: ${clubName}
    - Parent Club: ${parentClub}
    - Club ID: ${clubId}
    - Charter Date: ${charterDate}
    - RI District: 3206 (Coimbatore | Pallakkad)
    - Location: Dr. N.G.P. Arts and Science College, Coimbatore
    - Email: rac.drngpasc@gmail.com
    - Social Media: @rotaractdrngpasc
    - Avenues: Club Service, Community Service, Professional Service, International Service, District Priority Projects
    
    GUIDELINES:
    - Always be helpful, accurate, and encouraging
    - Keep responses concise but comprehensive (2-4 paragraphs max unless more detail is needed)
    - Use professional yet friendly language
    - If asked about something completely unrelated to Rotary/Rotaract, politely say you specialize in Rotary and Rotaract topics
    - Format responses clearly with proper punctuation
    - When mentioning our club, use the full name: ${clubName}
    - Never make up facts about Rotary; if uncertain, say so`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.conversationHistory.slice(-10), // Last 10 messages for context
      { role: 'user', content: userMessage }
    ];

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.href,
          'X-Title': `${clubName} AI Assistant`
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: AI_CONFIG.maxTokens,
          temperature: AI_CONFIG.temperature,
          stream: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (error) {
      console.error('AI API error:', error);
      throw error;
    }
  }

  /* ============================================================
     ADD MESSAGE TO UI
     ============================================================ */
  addMessage(role, content) {
    if (!this.messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `chatbot-message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'chatbot-avatar-sm';

    if (role === 'bot') {
      avatar.innerHTML = '<i data-lucide="bot"></i>';
    } else {
      avatar.innerHTML = '<i data-lucide="user"></i>';
    }

    const bubble = document.createElement('div');
    bubble.className = 'chatbot-bubble';

    // Process content - handle markdown-like formatting
    const formattedContent = this.formatMessage(content);

    // For bot messages, allow HTML formatting
    if (role === 'bot') {
      bubble.innerHTML = formattedContent;
    } else {
      // For user messages, use text content for security
      bubble.innerHTML = `<p>${StringUtils.sanitize(content)}</p>`;
    }

    // Timestamp
    const timestamp = document.createElement('div');
    timestamp.style.cssText = `
      font-size: 0.62rem;
      color: ${role === 'user' ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)'};
      margin-top: 4px;
      text-align: ${role === 'user' ? 'right' : 'left'};
    `;
    timestamp.textContent = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });

    bubble.appendChild(timestamp);

    if (role === 'bot') {
      messageDiv.appendChild(avatar);
      messageDiv.appendChild(bubble);
    } else {
      messageDiv.appendChild(bubble);
      messageDiv.appendChild(avatar);
    }

    this.messagesContainer.appendChild(messageDiv);
    lucide.createIcons();
    this.scrollToBottom();

    // Animate in
    messageDiv.style.opacity = '0';
    messageDiv.style.transform = 'translateY(10px)';
    requestAnimationFrame(() => {
      messageDiv.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      messageDiv.style.opacity = '1';
      messageDiv.style.transform = 'translateY(0)';
    });
  }

  /* ============================================================
     FORMAT MESSAGE (Basic Markdown Support)
     ============================================================ */
  formatMessage(content) {
    if (!content) return '';

    let formatted = StringUtils.sanitize(content);

    // Bold: **text** or __text__
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');

    // Code: `text`
    formatted = formatted.replace(/`(.*?)`/g, '<code style="background:var(--bg-secondary);padding:1px 4px;border-radius:3px;font-size:0.82em;">$1</code>');

    // Line breaks
    formatted = formatted.replace(/\n\n/g, '</p><p>');
    formatted = formatted.replace(/\n/g, '<br>');

    // Bullet points: - item or • item
    formatted = formatted.replace(/^[-•] (.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul style="padding-left:16px;margin:8px 0;">$1</ul>');

    // Numbered lists
    formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Headers: # Header
    formatted = formatted.replace(/^# (.+)$/gm, '<h3 style="font-size:0.95rem;font-weight:700;margin:8px 0 4px;color:var(--text-heading);">$1</h3>');
    formatted = formatted.replace(/^## (.+)$/gm, '<h4 style="font-size:0.88rem;font-weight:700;margin:6px 0 4px;color:var(--text-heading);">$1</h4>');

    // Wrap in paragraph if not already
    if (!formatted.startsWith('<')) {
      formatted = `<p>${formatted}</p>`;
    }

    return formatted;
  }

  /* ============================================================
     TYPING INDICATOR
     ============================================================ */
  showTyping() {
    this.isTyping = true;
    if (!this.messagesContainer) return;

    const typingDiv = document.createElement('div');
    typingDiv.className = 'chatbot-message bot';
    typingDiv.id = 'chatbot-typing';

    typingDiv.innerHTML = `
      <div class="chatbot-avatar-sm">
        <i data-lucide="bot"></i>
      </div>
      <div class="chatbot-bubble">
        <div class="chatbot-thinking">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;

    this.messagesContainer.appendChild(typingDiv);
    lucide.createIcons();
    this.scrollToBottom();
  }

  hideTyping() {
    this.isTyping = false;
    const typingEl = document.getElementById('chatbot-typing');
    if (typingEl) typingEl.remove();
  }

  /* ============================================================
     SCROLL TO BOTTOM
     ============================================================ */
  scrollToBottom() {
    if (this.messagesContainer) {
      requestAnimationFrame(() => {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      });
    }
  }

  /* ============================================================
     CLEAR CHAT
     ============================================================ */
  clearChat() {
    if (!this.messagesContainer) return;

    this.conversationHistory = [];
    Storage.remove('chatbot_history');

    this.messagesContainer.innerHTML = '';

    // Add welcome message back
    this.addWelcomeMessage();

    // Show quick prompts again
    const quickPromptsEl = document.getElementById('chatbot-quick-prompts');
    if (quickPromptsEl) quickPromptsEl.style.display = 'flex';
  }

  addWelcomeMessage() {
    const clubName = this.getSetting('club_name', CLUB_INFO.name);

    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'chatbot-message bot';

    welcomeDiv.innerHTML = `
      <div class="chatbot-avatar-sm">
        <i data-lucide="bot"></i>
      </div>
      <div class="chatbot-bubble">
        <p>Hello! I am the Rotaract AI Assistant for <strong>${StringUtils.sanitize(clubName)}</strong>.</p>
        <p>I can answer all your questions about Rotary International, Rotaract, 
        Rotary International District 3206, Rotaract District Organisation 3206, 
        RSAMDIO, End Polio Now, and everything related to our club.</p>
        <p>How can I assist you today?</p>
      </div>
    `;

    this.messagesContainer.appendChild(welcomeDiv);
    lucide.createIcons();
  }

  /* ============================================================
     SAVE / LOAD CHAT HISTORY
     ============================================================ */
  saveChatHistory() {
    try {
      const historyToSave = this.conversationHistory.slice(-20);
      Storage.set('chatbot_history', historyToSave, 24 * 60 * 60 * 1000); // 24 hours
    } catch (e) {
      console.warn('Save chat history error:', e);
    }
  }

  loadChatHistory() {
    try {
      const saved = Storage.get('chatbot_history');
      if (saved && Array.isArray(saved) && saved.length > 0) {
        this.conversationHistory = saved;

        // Render saved messages
        if (this.messagesContainer) {
          // Clear default welcome if there's history
          const existingMessages = this.messagesContainer.querySelectorAll('.chatbot-message');
          if (existingMessages.length <= 1 && saved.length > 0) {
            // Keep welcome message, add history after
            saved.forEach(msg => {
              if (msg.role !== 'system') {
                this.addMessage(msg.role === 'user' ? 'user' : 'bot', msg.content);
              }
            });

            // Hide quick prompts if there's history
            const quickPromptsEl = document.getElementById('chatbot-quick-prompts');
            if (quickPromptsEl && saved.length > 0) {
              quickPromptsEl.style.display = 'none';
            }
          }
        }
      }
    } catch (e) {
      console.warn('Load chat history error:', e);
    }
  }

  /* ============================================================
     SUGGESTED TOPICS GENERATOR
     ============================================================ */
  getSuggestedTopics() {
    return [
      { text: 'What is Rotaract?', icon: 'help-circle' },
      { text: 'Tell me about RI District 3206', icon: 'map-pin' },
      { text: 'What is End Polio Now?', icon: 'shield' },
      { text: 'How to join Rotaract?', icon: 'user-plus' },
      { text: 'What is RSAMDIO?', icon: 'network' },
      { text: 'Benefits of Rotaract membership', icon: 'star' },
      { text: 'What is the Rotary Foundation?', icon: 'award' },
      { text: 'Tell me about the Four-Way Test', icon: 'check-circle' },
      { text: 'What is Paul Harris Fellow?', icon: 'award' },
      { text: 'Avenues of service in Rotaract', icon: 'layers' }
    ];
  }

  /* ============================================================
     FEEDBACK SYSTEM
     ============================================================ */
  addFeedbackButtons(messageEl) {
    if (!messageEl) return;

    const feedbackDiv = document.createElement('div');
    feedbackDiv.style.cssText = `
      display: flex;
      gap: 6px;
      margin-top: 6px;
    `;

    feedbackDiv.innerHTML = `
      <button onclick="chatbot.submitFeedback(this, 'helpful')"
              style="display:flex;align-items:center;gap:4px;padding:2px 8px;
                     border-radius:var(--border-radius-full);background:var(--bg-secondary);
                     border:1px solid var(--border-color);cursor:pointer;
                     font-size:0.65rem;color:var(--text-muted);transition:var(--transition);"
              onmouseover="this.style.background='var(--success-light)';this.style.color='var(--success)'"
              onmouseout="this.style.background='var(--bg-secondary)';this.style.color='var(--text-muted)'">
        <i data-lucide="thumbs-up" style="width:10px;height:10px;"></i>
        Helpful
      </button>
      <button onclick="chatbot.submitFeedback(this, 'not-helpful')"
              style="display:flex;align-items:center;gap:4px;padding:2px 8px;
                     border-radius:var(--border-radius-full);background:var(--bg-secondary);
                     border:1px solid var(--border-color);cursor:pointer;
                     font-size:0.65rem;color:var(--text-muted);transition:var(--transition);"
              onmouseover="this.style.background='var(--danger-light)';this.style.color='var(--danger)'"
              onmouseout="this.style.background='var(--bg-secondary)';this.style.color='var(--text-muted)'">
        <i data-lucide="thumbs-down" style="width:10px;height:10px;"></i>
        Not Helpful
      </button>
    `;

    const bubble = messageEl.querySelector('.chatbot-bubble');
    if (bubble) {
      bubble.appendChild(feedbackDiv);
      lucide.createIcons();
    }
  }

  submitFeedback(btn, type) {
    const feedbackDiv = btn.parentElement;
    if (feedbackDiv) {
      feedbackDiv.innerHTML = `
        <span style="font-size:0.65rem;color:var(--text-muted);">
          ${type === 'helpful' ? 'Thank you for your feedback!' : 'We will improve!'}
        </span>
      `;
    }
  }
}

/* ============================================================
   CHATBOT ADDITIONAL STYLES
   ============================================================ */
const chatbotAdditionalStyles = `
  /* Chatbot message animations */
  .chatbot-message {
    opacity: 0;
    animation: chatMsgIn 0.3s ease forwards;
  }

  @keyframes chatMsgIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Bubble hover effect for bot messages */
  .chatbot-message.bot .chatbot-bubble:hover {
    box-shadow: var(--neu-shadow);
    transition: var(--transition);
  }

  /* Code blocks in chatbot */
  .chatbot-bubble code {
    background: var(--bg-secondary);
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 0.82em;
    font-family: monospace;
  }

  /* Lists in chatbot */
  .chatbot-bubble ul,
  .chatbot-bubble ol {
    padding-left: 16px;
    margin: 6px 0;
  }

  .chatbot-bubble li {
    margin-bottom: 4px;
    font-size: 0.82rem;
    line-height: 1.5;
  }

  /* Chatbot fab pulse animation when new message */
  .chatbot-fab.has-message {
    animation: fabPulse 2s ease-in-out 3;
  }

  @keyframes fabPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.15); }
  }

  /* Chatbot window slide animation */
  .chatbot-window {
    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
                opacity 0.3s ease,
                visibility 0.3s ease;
  }

  /* Mobile chatbot adjustments */
  @media (max-width: 480px) {
    .chatbot-window {
      width: calc(100vw - 24px);
      right: 12px;
      bottom: 80px;
      border-radius: var(--border-radius-lg);
    }

    .chatbot-fab {
      right: 16px;
      bottom: 16px;
      width: 52px;
      height: 52px;
    }
  }

  /* Typing animation for chatbot */
  .chatbot-thinking {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 2px;
  }

  .chatbot-thinking span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-muted);
    display: inline-block;
    animation: thinkingDot 1.4s ease-in-out infinite;
  }

  .chatbot-thinking span:nth-child(1) { animation-delay: 0s; }
  .chatbot-thinking span:nth-child(2) { animation-delay: 0.2s; }
  .chatbot-thinking span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes thinkingDot {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
    30% { transform: translateY(-6px); opacity: 1; }
  }

  /* Chatbot messages scrollbar */
  .chatbot-messages::-webkit-scrollbar {
    width: 3px;
  }

  .chatbot-messages::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 2px;
  }

  /* Quick prompt hover */
  .quick-prompt {
    transition: var(--transition-fast);
    white-space: nowrap;
  }

  .quick-prompt:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(var(--accent-rgb), 0.2);
  }
`;

/* ============================================================
   INJECT CHATBOT STYLES
   ============================================================ */
(function injectChatbotStyles() {
  if (!document.getElementById('chatbot-additional-styles')) {
    const style = document.createElement('style');
    style.id = 'chatbot-additional-styles';
    style.textContent = chatbotAdditionalStyles;
    document.head.appendChild(style);
  }
})();

/* ============================================================
   GLOBAL INSTANCE
   ============================================================ */
let chatbot;

document.addEventListener('DOMContentLoaded', () => {
  // Only initialize chatbot if elements exist
  const fabEl = document.getElementById('chatbot-fab');
  if (fabEl) {
    chatbot = new RotaractChatbot();
    window.chatbot = chatbot;
  }
});