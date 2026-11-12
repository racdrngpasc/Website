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
    this.maxHistory = 24;
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
  async getLiveClubContext() {
    // Cache live club data for 5 minutes so every question is grounded in real data
    if (this._liveCtx && Date.now() - this._liveCtxAt < 5 * 60 * 1000) return this._liveCtx;
    const lines = [];
    const today = new Date().toISOString().slice(0, 10);
    try {
      const [up, done, board, stats] = await Promise.all([
        this.db.from('events').select('title,avenue,event_date,venue,description,status')
          .gte('event_date', today).order('event_date', { ascending: true }).limit(8),
        this.db.from('events').select('title,avenue,event_date,venue,status')
          .eq('status', 'completed').order('event_date', { ascending: false }).limit(10),
        this.db.from('members').select('full_name,portfolio,role,avenue')
          .eq('is_active', true).eq('is_board_member', true).limit(30),
        this.db.from('club_statistics').select('*').single()
      ]);
      const fmt = e => `- ${e.title} | ${(e.avenue || '').replace(/_/g, ' ')} | ${e.event_date || 'date TBA'} | ${e.venue || 'venue TBA'}` +
        (e.description ? ` | ${String(e.description).slice(0, 140)}` : '');
      if (up.data?.length)   lines.push('UPCOMING EVENTS (live from club database):\n' + up.data.map(fmt).join('\n'));
      else                   lines.push('UPCOMING EVENTS: none currently scheduled in the database.');
      if (done.data?.length) lines.push('RECENT COMPLETED PROJECTS:\n' + done.data.map(fmt).join('\n'));
      if (board.data?.length) lines.push('BOARD / OFFICE BEARERS:\n' + board.data.map(m => `- ${m.full_name} — ${m.portfolio || m.role || 'Board member'}`).join('\n'));
      if (stats.data) {
        const d = stats.data;
        lines.push(`CLUB IMPACT STATS: ${d.total_projects || 0} projects, ${d.total_members || 0} members, ` +
          `${Math.round(d.total_service_hours || 0)} service hours, ${d.total_beneficiaries || 0} lives impacted.`);
      }
    } catch (e) { console.warn('Live context error:', e); }
    this._liveCtx = lines.join('\n\n');
    this._liveCtxAt = Date.now();
    return this._liveCtx;
  }

  buildSystemPrompt(liveContext) {
    const clubName = this.getSetting('club_name', CLUB_INFO.name);
    const clubId = this.getSetting('club_id', CLUB_INFO.clubId);
    const charterDate = this.getSetting('charter_date', CLUB_INFO.charterDate);
    const parentClub = this.getSetting('parent_club', CLUB_INFO.parentClub);
    const now = new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

    return `You are the official AI assistant of the ${clubName}, sponsored by ${parentClub}, Rotary International District 3206 (Coimbatore | Palakkad). You are a highly capable, accurate, friendly assistant. Current date/time (IST): ${now}.

CORE BEHAVIOUR
- Answer EVERY question the visitor asks, directly and correctly. You are an expert on Rotary and Rotaract, and you are also a capable general assistant: general knowledge, science, maths, history, careers, studies, writing help, coding, translation, event ideas, speeches, captions, social media posts and more.
- For Rotary/Rotaract/club questions, use the knowledge below. Where the question is about our club's own events, members or numbers, use ONLY the LIVE CLUB DATA below; if it is not there, say you don't have that detail and suggest contacting the club at ${CLUB_INFO.email} or Instagram @${CLUB_INFO.socialHandle}. Never invent club-specific facts, dates, names or phone numbers.
- Think step by step for maths, logic and reasoning questions and show the final answer clearly.
- Reply in the same language the user writes in (English, Tamil, Hindi, Malayalam, Tanglish, etc.).
- Be concise: usually 2-6 short sentences or a compact list. Give more detail only when asked or when the question needs it. Lead with the answer, no filler, no repeating the question.
- Use Markdown: **bold** key terms, short bullet lists, numbered steps, and code blocks for code. Avoid tables.
- Understand follow-ups using the conversation history ("it", "that", "tell me more").
- If a question is ambiguous, give your best answer and offer one brief clarifying follow-up.
- If you are not sure about a fact, say so honestly rather than guessing. For medical, legal or financial matters, give general info and recommend a professional.
- Politely decline anything harmful, hateful, sexual or illegal. Stay neutral on party politics and religion.
- When relevant, gently point people to the "Join Our Club" section of this website, the Projects section, or the contact details.

ROTARY INTERNATIONAL
- Founded 23 Feb 1905 in Chicago by Paul P. Harris (with Gustavus Loehr, Silvester Schiele, Hiram Shorey). Motto: "Service Above Self". Each Rotary year has a new presidential theme. Headquarters: Evanston, Illinois, USA. 46,000+ clubs and ~1.4 million members in 200+ countries.
- Four-Way Test: Is it the TRUTH? Is it FAIR to all concerned? Will it build GOODWILL and BETTER FRIENDSHIPS? Will it be BENEFICIAL to all concerned?
- Object of Rotary: encourage and foster the ideal of service as a basis of worthy enterprise.
- Seven Areas of Focus: Peacebuilding & conflict prevention; Disease prevention & treatment; Water, sanitation & hygiene; Maternal & child health; Basic education & literacy; Community economic development; Protecting the environment.
- The Rotary Foundation (est. 1917): grants, Global Grants, District Grants, Peace Fellowships (Rotary Peace Centers), scholarships, PolioPlus. "Doing Good in the World". Paul Harris Fellow (PHF) = recognition for a USD 1,000 contribution to the Foundation.
- Programs: Rotaract, Interact (ages 12-18), RYLA (Rotary Youth Leadership Awards), RYPEN, Youth Exchange, Rotary Community Corps (RCC), New Generations, Rotary Fellowships, Rotary Friendship Exchange.
- Leadership: Club President, Secretary, Treasurer; District Governor (DG); RI President; Rotary year runs 1 July - 30 June. Events: PETS, District Assembly, District Conference, Rotary International Convention, Rotary Day at the UN.
- Rotary and polio: PolioPlus launched 1985; with WHO, UNICEF, CDC, Gates Foundation and Gavi (Global Polio Eradication Initiative). Wild poliovirus cases down over 99.9%; wild polio remains endemic only in Pakistan and Afghanistan. India was declared polio-free in 2014 (certified by WHO on 27 March 2014). World Polio Day: 24 October. Purple pinky marks vaccinated children. Campaign: "End Polio Now" / "This Close".

ROTARACT
- Started 13 March 1968 by Rotary Club of Charlotte, North Carolina, USA, at Charlotte's college. Name = ROTary + ACT. Became an official RI program of Rotary in 1971. Traditionally for ages 18-30 (RI's rules now allow adults 18+; our club follows the 18-30 student/young-professional profile). Clubs are university-based or community-based. Over 250,000 Rotaractors in 180+ countries.
- Motto "Fellowship Through Service". Rotaract Avenues of Service: Club Service, Professional Service (Professional Development), Community Service, International Service; in District 3206 we also highlight District Priority Projects. Many clubs add Youth Service/Environment focus.
- Rotaract Club structure: President, Immediate Past President, President-Elect, Vice President, Secretary, Joint Secretary, Treasurer, Sergeant-at-Arms, Editor, Avenue Directors, Club Service Director, Community Service Director, Professional Service Director, International Service Director, Public Relations Director/Chair, Rotary Foundation Chair, Membership Chair.
- Rotaract Club is sponsored by a Rotary Club (ours: ${parentClub}) which mentors it. Meetings are usually weekly/fortnightly; attendance, projects, dues and Rotaract Rotary ID (RI ID) registered on My Rotary.
- Benefits: leadership, public speaking, project management, networking, friendships, internships/career connections, international exchange, certificates, cultural experiences and the joy of service.
- DRR = District Rotaract Representative; DRC = District Rotaract Committee; RSAMDIO = the South Asia multi-district information organisation that coordinates Rotaract and Interact clubs across districts (MDIO = Multi District Information Organisation). Do not invent exact office-bearer names.

DISTRICT 3206
- Rotary International District 3206 covers the Coimbatore region of Tamil Nadu and Palakkad in Kerala. Led by the District Governor (DG) and District Rotaract Chair/DRR. Rotaract District Organisation (RDO 3206) organises district meets, trainings, awards, and inter-club projects. Clubs are grouped into Groups with Assistant Governors.

OUR CLUB
- Name: ${clubName}. Club ID: ${clubId}. Charter date: ${charterDate}. Parent club: ${parentClub}. District: 3206.
- Location: Dr. N.G.P. Arts and Science College (Autonomous, affiliated to Bharathiar University), Dr. N.G.P. - Kalapatti Road, Coimbatore - 641048, Tamil Nadu.
- Contact: ${CLUB_INFO.email} | Instagram/Social: @${CLUB_INFO.socialHandle}.
- Website features: Projects, Members, Blood Request page (urgent blood donor requests), Membership Application page, Games page, Admin portal for office bearers.
- To join: students of the college can apply via the "Join Our Club" section / Apply page of this website; the club board reviews applications.

LIVE CLUB DATA
${liveContext || '(Live data unavailable right now.)'}`;
  }

  async getAIResponse(userMessage) {
    const liveContext = await this.getLiveClubContext();
    const systemPrompt = this.buildSystemPrompt(liveContext);

    // conversationHistory already contains the latest user message (pushed in sendMessage)
    const history = this.conversationHistory.slice(-14);
    const messages = [{ role: 'system', content: systemPrompt }, ...history];

    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 40000);
      try {
        const response = await fetch(AI_CONFIG.apiUrl, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: AI_CONFIG.model,
            messages,
            max_tokens: AI_CONFIG.maxTokens,
            temperature: AI_CONFIG.temperature,
            stream: false
          })
        });
        clearTimeout(timer);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (text && text.trim()) return text.trim();
        throw new Error('Empty response');
      } catch (error) {
        clearTimeout(timer);
        lastError = error;
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    console.error('AI API error:', lastError);
    // Never leave the visitor without an answer
    return this.getOfflineAnswer(userMessage);
  }

  /* Built-in answers used only if the AI service is unreachable */
  getOfflineAnswer(q) {
    const t = (q || '').toLowerCase();
    const has = (...w) => w.some(x => t.includes(x));
    if (has('polio')) return '**End Polio Now** is Rotary\'s campaign, running since 1985 (PolioPlus), to eradicate polio worldwide with WHO, UNICEF, CDC and the Gates Foundation. Wild polio cases are down over 99.9%, and India was declared polio-free in 2014. World Polio Day is **24 October**.';
    if (has('four-way', 'four way', '4 way')) return 'The **Four-Way Test**: 1) Is it the **truth**? 2) Is it **fair** to all concerned? 3) Will it build **goodwill and better friendships**? 4) Will it be **beneficial** to all concerned?';
    if (has('paul harris')) return '**Paul Harris** founded Rotary in Chicago on 23 February 1905. A **Paul Harris Fellow** is a recognition given for a USD 1,000 contribution to The Rotary Foundation.';
    if (has('rsamdio')) return '**RSAMDIO** is the Rotaract and Interact multi-district information organisation for South Asia that coordinates and supports Rotaract and Interact clubs across districts.';
    if (has('3206', 'district')) return '**Rotary International District 3206** covers the Coimbatore and Palakkad region across Tamil Nadu and Kerala. It is led by the District Governor, and **RDO 3206** coordinates Rotaract clubs in the district.';
    if (has('join', 'member', 'apply')) return 'To join, open the **Join Our Club** section on this website (or the Apply page) and submit the form. You can also email **' + CLUB_INFO.email + '** or message **@' + CLUB_INFO.socialHandle + '** on social media.';
    if (has('foundation')) return '**The Rotary Foundation** (est. 1917) is Rotary\'s charity arm. It funds Global and District Grants, scholarships, Peace Fellowships and polio eradication.';
    if (has('avenue')) return 'Rotaract\'s **Avenues of Service** are **Club Service**, **Community Service**, **Professional Service** and **International Service**, plus District Priority Projects in District 3206.';
    if (has('rotaract')) return '**Rotaract** is Rotary\'s program for young adults, started in 1968 in Charlotte, USA. Its motto is "Fellowship Through Service", focusing on leadership, community service and friendships.';
    if (has('rotary')) return '**Rotary International** was founded in 1905 by Paul Harris in Chicago. Its motto is "Service Above Self", with 1.4 million members worldwide.';
    if (has('contact', 'email', 'reach')) return 'You can reach us at **' + CLUB_INFO.email + '** or on social media at **@' + CLUB_INFO.socialHandle + '**.';
    return 'I\'m having trouble reaching the AI service right now. Please try again in a moment, or contact the club at **' + CLUB_INFO.email + '**.';
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
    const esc = StringUtils.sanitize;
    const blocks = [];
    // 1) pull out fenced code blocks first
    let text = String(content).replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      blocks.push(`<pre style="background:var(--bg-secondary);padding:8px 10px;border-radius:8px;overflow-x:auto;font-size:0.78rem;margin:6px 0;"><code>${esc(code.replace(/\n$/, ''))}</code></pre>`);
      return `\u0000B${blocks.length - 1}\u0000`;
    });

    const inline = (raw) => {
      let h = esc(raw);
      h = h.replace(/`([^`]+)`/g, '<code style="background:var(--bg-secondary);padding:1px 4px;border-radius:3px;font-size:0.82em;">$1</code>');
      h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      h = h.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
      h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline;">$1</a>');
      h = h.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline;">$2</a>');
      h = h.replace(/([\w.+-]+@[\w-]+\.[\w.-]+\w)/g, '<a href="mailto:$1" style="color:var(--accent);text-decoration:underline;">$1</a>');
      return h;
    };

    const out = [];
    let list = null; // 'ul' | 'ol'
    const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    const lines = text.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      let m;
      if (/^\u0000B\d+\u0000$/.test(line.trim())) { closeList(); out.push(line.trim()); continue; }
      if ((m = line.match(/^\s*[-*•]\s+(.+)$/))) {
        if (list !== 'ul') { closeList(); out.push('<ul style="padding-left:18px;margin:6px 0;">'); list = 'ul'; }
        out.push(`<li>${inline(m[1])}</li>`); continue;
      }
      if ((m = line.match(/^\s*\d+[.)]\s+(.+)$/))) {
        if (list !== 'ol') { closeList(); out.push('<ol style="padding-left:20px;margin:6px 0;">'); list = 'ol'; }
        out.push(`<li>${inline(m[1])}</li>`); continue;
      }
      closeList();
      if ((m = line.match(/^#{1,6}\s+(.+)$/))) { out.push(`<h4 style="font-size:0.9rem;font-weight:700;margin:8px 0 4px;color:var(--text-heading);">${inline(m[1])}</h4>`); continue; }
      if (!line.trim()) { out.push(''); continue; }
      out.push(`<p style="margin:0 0 6px;">${inline(line)}</p>`);
    }
    closeList();
    return out.join('').replace(/\u0000B(\d+)\u0000/g, (_, i) => blocks[+i]);
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
      const historyToSave = this.conversationHistory.slice(-24);
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
const chatbotAdditionalStyles = `/* styles now live in styles.css */`;

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
