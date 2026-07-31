/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Configuration File - js/config.js
   Central configuration, constants, and role definitions
   ============================================================ */

'use strict';

/* ============================================================
   SUPABASE CONFIGURATION
   ============================================================ */
const SUPABASE_URL = 'https://itaewvrngvowimjgfawa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0YWV3dnJuZ3Zvd2ltamdmYXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2OTA5ODQsImV4cCI6MjEwMDI2Njk4NH0.GrMILDmJEEbCLXXzUf5qw-pTqIW7NRydYkrMz70NUHY';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0YWV3dnJuZ3Zvd2ltamdmYXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY5MDk4NCwiZXhwIjoyMTAwMjY2OTg0fQ.E58oS5r0fWWJDixshdOPcnc6HUg2yc77xjsWXoFBfg0';

/* ============================================================
   EMAILJS CONFIGURATION
   ============================================================ */
const EMAILJS_CONFIG = {
  publicKey: 'hvjW9Ox9zAKHp6Lux',
  privateKey: '-fY4AMC4H7c32sP0UaV8U',
  serviceId: 'service_fzw72uo',
  templateId: 'template_6efavqr'
};

/* ============================================================
   AI CHATBOT CONFIGURATION
   ============================================================ */
const AI_CONFIG = {
  apiKey: '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',
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'openai/gpt-4o-mini',
  maxTokens: 1024,
  temperature: 0.7,
  systemPrompt: `You are the official AI assistant for the Rotaract Club of Dr. N.G.P Arts & Science College,
  parented by Rotary Club of Coimbatore Meridian. Club ID: 217835. Charter Date: 11.02.2020.
  Rotary International District 3206 (Coimbatore | Pallakkad).

  You are a comprehensive expert on:
  - Rotary International: Founded 1905 by Paul P. Harris, motto "Service Above Self"
  - Rotaract: Founded 1968, age 18-30, 217,000+ members worldwide
  - Avenues of Service: Club, Community, Professional, International Service
  - RI District 3206: Coimbatore and Pallakkad region
  - Rotaract District Organisation 3206 (RDO 3206)
  - RSAMDIO: Rotaract and Interact Multi District Interactive Organisation
  - End Polio Now: Rotary's global polio eradication campaign since 1985
  - The Four-Way Test: Truth, Fairness, Goodwill, Beneficial to all
  - Rotary Foundation: Scholarships, grants, peace programs
  - Paul Harris Fellow recognition
  - RYLA, RYPEN leadership programs
  - District Priority Projects
  - Our Club: Rotaract Club of Dr. N.G.P Arts & Science College
  - Club Email: rac.drngpasc@gmail.com
  - Social: @rotaractdrngpasc
  - Location: Dr. N.G.P. Arts and Science College, Coimbatore

  Always be helpful, professional, and encouraging.
  Keep responses concise but comprehensive.
  If asked about unrelated topics, politely redirect to Rotary/Rotaract.`
};

/* ============================================================
   CLUB INFORMATION
   ============================================================ */
const CLUB_INFO = {
  name: 'Rotaract Club of Dr. N.G.P Arts & Science College',
  parentClub: 'Rotary Club of Coimbatore Meridian',
  clubId: '217835',
  charterDate: '11.02.2020',
  district: 'Rotary International District 3206',
  districtRegion: 'Coimbatore | Pallakkad',
  email: 'rac.drngpasc@gmail.com',
  socialHandle: 'rotaractdrngpasc',
  address: {
    line1: 'Dr. N.G.P. Arts and Science College',
    line2: 'Autonomous and Affiliated to Bharathiar University',
    line3: 'Dr.N.G.P. - Kalapatti Road',
    line4: 'Coimbatore - 641048. Tamil Nadu.'
  },
  mapEmbedUrl: 'https://maps.google.com/maps?q=Dr.+N.G.P.+Arts+and+Science+College,+Dr.N.G.P.+Kalapatti+Road,+Coimbatore+641048&output=embed',
  logos: {
    colour: 'https://res.cloudinary.com/qxbjvkq6/image/upload/v1784713317/ngp_logo_colourAsset_2_2x-8_lu8zgf.png',
    white: 'https://res.cloudinary.com/qxbjvkq6/image/upload/v1784713318/ngp_logo_whiteAsset_4_2x-8_rgwwq1.png',
    black: 'https://res.cloudinary.com/qxbjvkq6/image/upload/v1784713317/ngp_logo_blackAsset_3_2x-8_l4l8fi.png'
  },
  reportLogoStrip: {
    url: 'https://res.cloudinary.com/qxbjvkq6/image/upload/v1784713317/ngp_colour_nlpsyt.png',
    height: '0.42',
    width: '4.53'
  },
  dppLogoStrip: {
    url: 'https://res.cloudinary.com/qxbjvkq6/image/upload/v1784713318/ngp_logo_dpp_colourAsset_4_2x-8_exk9kk.png',
    height: '0.42',
    width: '5.55'
  },
  whatsappBloodRequest: {
    number1: '9789903206',
    number2: '9789953206'
  }
};

/* ============================================================
   ROLE DEFINITIONS
   ============================================================ */
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADVISOR: 'advisor',
  PRESIDENT: 'president',
  IMMEDIATE_PAST_PRESIDENT: 'immediate_past_president',
  VICE_PRESIDENT: 'vice_president',
  SECRETARY_ADMINISTRATION: 'secretary_administration',
  SECRETARY_COMMUNICATION: 'secretary_communication',
  TREASURER: 'treasurer',
  DISTRICT_PRIORITY_CHAIR: 'district_priority_chair',
  BLOOD_DONATION_CHAIR: 'blood_donation_chair',
  CLUB_EDITOR: 'club_editor',
  YOUNG_LEADERS_CONTACT: 'young_leaders_contact',
  PUBLIC_IMAGE_CHAIR: 'public_image_chair',
  MEMBERSHIP_CHAIR: 'membership_chair',
  AVENUE_DIRECTOR_CLUB_SERVICE: 'avenue_director_club_service',
  AVENUE_DIRECTOR_COMMUNITY_SERVICE: 'avenue_director_community_service',
  AVENUE_DIRECTOR_PROFESSIONAL_SERVICE: 'avenue_director_professional_service',
  AVENUE_DIRECTOR_INTERNATIONAL_SERVICE: 'avenue_director_international_service',
  SERGEANT_AT_ARMS: 'sergeant_at_arms',
  MEMBER: 'member'
};

/* ============================================================
   ROLE DISPLAY NAMES
   ============================================================ */
const ROLE_DISPLAY_NAMES = {
  super_admin: 'Super Administrator',
  advisor: 'Advisor',
  president: 'President',
  immediate_past_president: 'Immediate Past President',
  vice_president: 'Vice President',
  secretary_administration: 'Secretary Administration',
  secretary_communication: 'Secretary Communication',
  treasurer: 'Treasurer',
  district_priority_chair: 'District Priority Projects Chair',
  blood_donation_chair: 'Blood Donation Chair',
  club_editor: 'Club Editor',
  young_leaders_contact: 'Young Leaders Contact',
  public_image_chair: 'Public Image Chair',
  membership_chair: 'Membership Chair',
  avenue_director_club_service: 'Avenue Director - Club Service',
  avenue_director_community_service: 'Avenue Director - Community Service',
  avenue_director_professional_service: 'Avenue Director - Professional Service',
  avenue_director_international_service: 'Avenue Director - International Service',
  sergeant_at_arms: 'Sergeant at Arms',
  member: 'Member'
};

/* ============================================================
   ROLE HIERARCHY
   ============================================================ */
const ROLE_HIERARCHY = {
  super_admin: 100,
  advisor: 95,
  president: 90,
  immediate_past_president: 85,
  vice_president: 80,
  secretary_administration: 75,
  secretary_communication: 74,
  treasurer: 65,
  district_priority_chair: 60,
  blood_donation_chair: 55,
  club_editor: 55,
  young_leaders_contact: 55,
  public_image_chair: 55,
  membership_chair: 55,
  avenue_director_club_service: 50,
  avenue_director_community_service: 50,
  avenue_director_professional_service: 50,
  avenue_director_international_service: 50,
  sergeant_at_arms: 45,
  member: 10
};

/* ============================================================
   PERMISSIONS
   ============================================================ */
const PERMISSIONS = {
  MANAGE_ADMINS: ['super_admin'],
  MANAGE_SETTINGS: ['super_admin', 'advisor'],
  VIEW_ADMIN_PANEL: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'vice_president', 'secretary_administration', 'secretary_communication',
    'treasurer', 'district_priority_chair', 'blood_donation_chair',
    'club_editor', 'young_leaders_contact', 'public_image_chair',
    'membership_chair', 'avenue_director_club_service',
    'avenue_director_community_service', 'avenue_director_professional_service',
    'avenue_director_international_service', 'sergeant_at_arms'
  ],
  CREATE_EVENT: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'vice_president', 'secretary_administration', 'secretary_communication',
    'avenue_director_club_service', 'avenue_director_community_service',
    'avenue_director_professional_service', 'avenue_director_international_service',
    'district_priority_chair'
  ],
  APPROVE_EVENT: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'vice_president', 'secretary_administration', 'secretary_communication'
  ],
  EDIT_ANY_EVENT: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'vice_president', 'secretary_administration', 'secretary_communication'
  ],
  DELETE_EVENT: [
    'super_admin', 'advisor', 'president', 'immediate_past_president'
  ],
  SUBMIT_REPORT: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'vice_president', 'secretary_administration', 'secretary_communication',
    'avenue_director_club_service', 'avenue_director_community_service',
    'avenue_director_professional_service', 'avenue_director_international_service',
    'district_priority_chair'
  ],
  APPROVE_REPORT: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'vice_president', 'secretary_administration', 'secretary_communication'
  ],
  DOWNLOAD_AVENUE_REPORT: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'vice_president', 'secretary_administration', 'secretary_communication',
    'avenue_director_club_service', 'avenue_director_community_service',
    'avenue_director_professional_service', 'avenue_director_international_service',
    'district_priority_chair'
  ],
  DOWNLOAD_MONTHLY_REPORT: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'vice_president', 'secretary_administration', 'secretary_communication'
  ],
  CREATE_MEETING: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'vice_president', 'secretary_administration', 'secretary_communication',
    'sergeant_at_arms'
  ],
  MANAGE_MEETING: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'vice_president', 'secretary_administration', 'secretary_communication'
  ],
  VIEW_MEETING_ATTENDANCE: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'vice_president', 'secretary_administration', 'secretary_communication'
  ],
  GENERATE_MINUTES: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'vice_president', 'secretary_administration', 'secretary_communication',
    'sergeant_at_arms'
  ],
  VIEW_TREASURY: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'vice_president', 'secretary_administration', 'secretary_communication',
    'treasurer'
  ],
  MANAGE_TREASURY: [
    'super_admin', 'advisor', 'president', 'treasurer'
  ],
  DOWNLOAD_TREASURY: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'treasurer', 'secretary_administration', 'secretary_communication'
  ],
  VIEW_MEMBERS: 'all',
  MANAGE_MEMBERS: [
    'super_admin', 'advisor', 'president', 'secretary_administration',
    'membership_chair'
  ],
  VIEW_MEMBER_DETAILS: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'vice_president', 'secretary_administration', 'secretary_communication',
    'membership_chair'
  ],
  MANAGE_NEWSLETTERS: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'vice_president', 'secretary_administration', 'secretary_communication',
    'club_editor', 'public_image_chair'
  ],
  REVIEW_APPLICATIONS: [
    'super_admin', 'advisor', 'president', 'secretary_administration',
    'membership_chair'
  ],
  MANAGE_BLOOD_REQUESTS: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'vice_president', 'secretary_administration', 'secretary_communication',
    'blood_donation_chair'
  ],
  MANAGE_PAST_LEADERS: [
    'super_admin', 'advisor', 'president', 'secretary_administration'
  ],
  SEND_NOTIFICATIONS: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'vice_president', 'secretary_administration', 'secretary_communication'
  ],
  SEND_BULK_EMAIL: [
    'super_admin', 'advisor', 'president', 'immediate_past_president',
    'vice_president', 'secretary_administration', 'secretary_communication'
  ],
  ACCESS_GAMES: 'all',
  VIEW_LOGS: ['super_admin', 'advisor', 'president']
};

/* ============================================================
   AVENUE DEFINITIONS
   ============================================================ */
const AVENUES = {
  club_service: {
    key: 'club_service',
    label: 'Club Service',
    shortLabel: 'Club Service',
    icon: 'users-2',
    color: '#4A90D9',
    bgColor: 'rgba(74, 144, 217, 0.15)',
    directorRole: 'avenue_director_club_service'
  },
  community_service: {
    key: 'community_service',
    label: 'Community Service',
    shortLabel: 'Community',
    icon: 'heart-handshake',
    color: '#48BB78',
    bgColor: 'rgba(72, 187, 120, 0.15)',
    directorRole: 'avenue_director_community_service'
  },
  professional_service: {
    key: 'professional_service',
    label: 'Professional Service',
    shortLabel: 'Professional',
    icon: 'briefcase',
    color: '#9F7AEA',
    bgColor: 'rgba(159, 122, 234, 0.15)',
    directorRole: 'avenue_director_professional_service'
  },
  international_service: {
    key: 'international_service',
    label: 'International Service',
    shortLabel: 'International',
    icon: 'globe-2',
    color: '#F6AD55',
    bgColor: 'rgba(246, 173, 85, 0.15)',
    directorRole: 'avenue_director_international_service'
  },
  district_priority_projects: {
    key: 'district_priority_projects',
    label: 'District Priority Projects',
    shortLabel: 'DPP',
    icon: 'star',
    color: '#FC8181',
    bgColor: 'rgba(252, 129, 129, 0.15)',
    directorRole: 'district_priority_chair'
  }
};

/* ============================================================
   ROLE TO AVENUE MAP
   ============================================================ */
const ROLE_TO_AVENUE = {
  avenue_director_club_service: 'club_service',
  avenue_director_community_service: 'community_service',
  avenue_director_professional_service: 'professional_service',
  avenue_director_international_service: 'international_service',
  district_priority_chair: 'district_priority_projects'
};

/* ============================================================
   STORAGE BUCKET NAMES
   ============================================================ */
const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  EVENTS: 'events',
  REPORTS: 'reports',
  NEWSLETTERS: 'newsletters',
  MEETINGS: 'meetings',
  LOGOS: 'logos',
  TREASURY: 'treasury',
  APPLICATIONS: 'applications',
  BLOOD_REQUESTS: 'blood_requests',
  GAME_ASSETS: 'game_assets'
};

/* ============================================================
   FILE SIZE LIMITS (bytes)
   ============================================================ */
const FILE_LIMITS = {
  AVATAR: 5 * 1024 * 1024,
  EVENT_PHOTO: 4 * 1024 * 1024,
  EVENT_TOTAL: 50 * 1024 * 1024,
  REPORT_PHOTO: 4 * 1024 * 1024,
  REPORT_TOTAL: 50 * 1024 * 1024,
  NEWSLETTER: 10 * 1024 * 1024,
  MEETING_PHOTO: 4 * 1024 * 1024,
  TREASURY_DOC: 10 * 1024 * 1024,
  APPLICATION_PHOTO: 5 * 1024 * 1024
};

/* ============================================================
   MAX PHOTOS
   ============================================================ */
const MAX_PHOTOS = {
  EVENT: 3,
  REPORT: 5,
  MEETING: 5
};

/* ============================================================
   BLOOD GROUPS
   ============================================================ */
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/* ============================================================
   ROTARY GROUPS
   ============================================================ */
const ROTARY_GROUPS = ['1', '2', '3', '4', '5', '6'];

/* ============================================================
   COLLABORATION TYPES
   ============================================================ */
const COLLABORATION_TYPES = {
  none: 'None',
  rotaract: 'Rotaract',
  interact: 'Interact',
  rotary: 'Rotary',
  ngo: 'NGO',
  others: 'Others'
};

/* ============================================================
   MEETING TYPES
   ============================================================ */
const MEETING_TYPES = {
  board_meeting: 'Board Meeting',
  general_body_meeting: 'General Body Meeting',
  special_meeting: 'Special Meeting',
  emergency_meeting: 'Emergency Meeting'
};

/* ============================================================
   EVENT STATUS
   ============================================================ */
const EVENT_STATUS = {
  draft: { label: 'Draft', color: '#718096', bg: 'rgba(113,128,150,0.15)' },
  pending_approval: { label: 'Pending Approval', color: '#D69E2E', bg: 'rgba(214,158,46,0.15)' },
  approved: { label: 'Approved', color: '#38A169', bg: 'rgba(56,161,105,0.15)' },
  rejected: { label: 'Rejected', color: '#E53E3E', bg: 'rgba(229,62,62,0.15)' },
  completed: { label: 'Completed', color: '#0055FF', bg: 'rgba(0,85,255,0.12)' },
  cancelled: { label: 'Cancelled', color: '#FC8181', bg: 'rgba(252,129,129,0.15)' }
};

/* ============================================================
   TRANSACTION CATEGORIES
   ============================================================ */
const TRANSACTION_CATEGORIES = [
  'Membership Fees',
  'Donations',
  'Sponsorship',
  'Event Registration',
  'Grant',
  'Fundraising',
  'Bank Interest',
  'Miscellaneous Income',
  'Event Expenses',
  'Venue Charges',
  'Food and Refreshments',
  'Transportation',
  'Stationery and Printing',
  'Awards and Trophies',
  'Digital Tools / Subscriptions',
  'District Fees',
  'RI Fees',
  'Charitable Donation',
  'Medical Supplies',
  'Photography',
  'Marketing and Promotion',
  'Miscellaneous Expense'
];

/* ============================================================
   ROTARY YEARS
   ============================================================ */
const ROTARY_YEARS = [
  '2019-20', '2020-21', '2021-22',
  '2022-23', '2023-24', '2024-25'
];

/* ============================================================
   GAMES CONFIG
   ============================================================ */
const GAMES_CONFIG = [
  { id: 'snake', name: 'Snake Game', description: 'Classic snake — eat food, grow longer!', icon: 'zap', category: 'classic', difficulty: 'Medium' },
  { id: 'memory', name: 'Memory Match', description: 'Match pairs of Rotaract-themed cards!', icon: 'brain', category: 'puzzle', difficulty: 'Easy' },
  { id: 'tetris', name: 'Block Builder', description: 'Stack and clear blocks!', icon: 'layers', category: 'classic', difficulty: 'Hard' },
  { id: 'quiz', name: 'Rotaract Quiz', description: 'Test your Rotary & Rotaract knowledge!', icon: 'help-circle', category: 'educational', difficulty: 'Medium' },
  { id: 'flappy', name: 'Flappy Rotaract', description: 'Fly through obstacles!', icon: 'navigation', category: 'action', difficulty: 'Hard' },
  { id: 'wordle', name: 'Rotaract Wordle', description: 'Guess the Rotary-themed word!', icon: 'type', category: 'word', difficulty: 'Medium' },
  { id: 'pong', name: 'Ping Pong', description: 'Classic two-player pong!', icon: 'circle', category: 'classic', difficulty: 'Easy' },
  { id: '2048', name: '2048 Challenge', description: 'Merge tiles to reach 2048!', icon: 'grid', category: 'puzzle', difficulty: 'Hard' },
  { id: 'tictactoe', name: 'Tic Tac Toe', description: 'Classic three in a row!', icon: 'hash', category: 'classic', difficulty: 'Easy' },
  { id: 'typing', name: 'Speed Typing', description: 'Type Rotaract quotes fast!', icon: 'keyboard', category: 'skill', difficulty: 'Medium' },
  { id: 'minesweeper', name: 'Minesweeper', description: 'Find all mines safely!', icon: 'crosshair', category: 'puzzle', difficulty: 'Hard' },
  { id: 'breakout', name: 'Breakout', description: 'Break all bricks with the ball!', icon: 'disc', category: 'action', difficulty: 'Medium' }
];

/* ============================================================
   QUIZ QUESTIONS
   ============================================================ */
const QUIZ_QUESTIONS = [
  { question: 'When was Rotaract founded?', options: ['1968', '1985', '1905', '1950'], answer: 0, explanation: 'Rotaract was founded in 1968 in Charlotte, North Carolina, USA.' },
  { question: 'What is the age range for Rotaract membership?', options: ['18-30', '16-25', '18-35', '21-35'], answer: 0, explanation: 'Rotaract is open to young adults between 18 and 30 years of age.' },
  { question: 'What is the motto of Rotary International?', options: ['Service Above Self', 'Together We Serve', 'One Rotary', 'Give to Live'], answer: 0, explanation: 'The Rotary motto is "Service Above Self".' },
  { question: 'When was Rotary International founded?', options: ['1905', '1910', '1915', '1900'], answer: 0, explanation: 'Rotary International was founded on 23 February 1905 by Paul P. Harris in Chicago.' },
  { question: 'What does "End Polio Now" refer to?', options: ["Rotary's global campaign to eradicate polio", 'A health awareness day', 'A medical conference', 'A government initiative'], answer: 0, explanation: "End Polio Now is Rotary's decades-long global campaign to eradicate poliomyelitis worldwide." },
  { question: 'What is Rotary International District 3206?', options: ['Coimbatore and Pallakkad region', 'Chennai and Pondicherry region', 'Mumbai and Pune region', 'Bangalore and Mysore region'], answer: 0, explanation: 'RI District 3206 covers the Coimbatore and Pallakkad regions.' },
  { question: 'What is the club ID of Rotaract Club of Dr. N.G.P Arts & Science College?', options: ['217835', '218735', '217385', '218375'], answer: 0, explanation: 'The club ID is 217835.' },
  { question: 'What are the avenues of service in Rotaract?', options: ['Club, Community, Professional, International Service', 'Local, Regional, National, International Service', 'Health, Education, Environment, Peace Service', 'Youth, Adult, Senior, Community Service'], answer: 0, explanation: 'The four main avenues of service are Club Service, Community Service, Professional Service, and International Service.' },
  { question: 'What is the Rotary Foundation?', options: ['The charitable arm of Rotary International', 'The youth wing of Rotary', "The women's division of Rotary", 'The financial department of Rotary'], answer: 0, explanation: 'The Rotary Foundation is the charitable arm of Rotary International that funds programs and scholarships.' },
  { question: 'What is a Paul Harris Fellow?', options: ['A recognition for significant contributions to Rotary Foundation', 'A Rotary club president', 'A Rotaract member who completes all projects', 'A district governor title'], answer: 0, explanation: 'Paul Harris Fellow is a recognition given to individuals who contribute $1,000 or more to The Rotary Foundation.' },
  { question: 'What does RYLA stand for?', options: ['Rotary Youth Leadership Awards', 'Rotaract Young Leaders Association', 'Rotary Youth Learning Academy', 'Regional Youth Leadership Assembly'], answer: 0, explanation: 'RYLA stands for Rotary Youth Leadership Awards, a leadership development program.' },
  { question: 'What is the Four-Way Test of Rotary?', options: ['Truth, Fairness, Goodwill, Beneficial to all', 'Service, Fellowship, Leadership, Ethics', 'Integrity, Trust, Service, Community', 'Peace, Health, Education, Environment'], answer: 0, explanation: 'The Four-Way Test asks: Is it the Truth? Is it Fair? Will it build Goodwill? Will it be Beneficial to all?' },
  { question: 'What is the charter date of Rotaract Club of Dr. N.G.P Arts & Science College?', options: ['11.02.2020', '11.02.2019', '11.02.2021', '02.11.2020'], answer: 0, explanation: 'The club was chartered on 11th February 2020.' },
  { question: 'Which club parents Rotaract Club of Dr. N.G.P Arts & Science College?', options: ['Rotary Club of Coimbatore Meridian', 'Rotary Club of Coimbatore', 'Rotary Club of Coimbatore Central', 'Rotary Club of Coimbatore North'], answer: 0, explanation: 'The club is parented by the Rotary Club of Coimbatore Meridian.' },
  { question: 'What is RSAMDIO?', options: ['Rotaract and Interact Multi District Interactive Organisation', 'Rotary Senior Advisory and Management District International Office', 'Rotaract Special Activities and Member Development International Organisation', 'Regional Students Association for Member Development and International Outreach'], answer: 0, explanation: 'RSAMDIO stands for Rotaract and Interact Multi District Interactive Organisation.' }
];

/* ============================================================
   TYPING QUOTES
   ============================================================ */
const TYPING_QUOTES = [
  'Service Above Self is the motto of Rotary International.',
  'Rotaract empowers young people to develop leadership skills.',
  'Together we can make a difference in our communities.',
  'The Rotary Foundation helps us do good in the world.',
  'End Polio Now is our commitment to a polio-free world.',
  'Fellowship, integrity, and service define a true Rotaractor.',
  'Leadership, character, and community service go hand in hand.',
  'Rotaract Club of Dr. N.G.P Arts and Science College serves with pride.',
  'Building goodwill and better friendships through service.',
  'Rotary International District 3206 connects Coimbatore and Pallakkad.'
];

/* ============================================================
   NOTIFICATION TYPES
   ============================================================ */
const NOTIFICATION_TYPES = {
  EVENT_APPROVED: 'event_approved',
  EVENT_CREATED: 'event_created',
  REPORT_SUBMITTED: 'report_submitted',
  REPORT_APPROVED: 'report_approved',
  MEETING_SCHEDULED: 'meeting_scheduled',
  MEETING_MINUTES_READY: 'meeting_minutes_ready',
  BIRTHDAY_WISH: 'birthday_wish',
  BLOOD_REQUEST: 'blood_request',
  MEMBERSHIP_APPLICATION: 'membership_application',
  MONTHLY_STATEMENT: 'monthly_statement',
  SYSTEM: 'system'
};

/* ============================================================
   DATE UTILITIES
   ============================================================ */
const DateUtils = {
  format(date, format = 'long') {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const options = {
      long: { day: 'numeric', month: 'long', year: 'numeric' },
      short: { day: '2-digit', month: 'short', year: 'numeric' },
      numeric: { day: '2-digit', month: '2-digit', year: 'numeric' }
    };
    return d.toLocaleDateString('en-IN', options[format] || options.long);
  },

  formatTime(time) {
    if (!time) return '';
    try {
      const [hours, minutes] = time.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) return time;
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch (e) {
      return time;
    }
  },

  daysUntil(date) {
    if (!date) return 0;
    const now = new Date();
    const target = new Date(date);
    now.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  },

  isToday(date) {
    if (!date) return false;
    const today = new Date();
    const d = new Date(date);
    return d.toDateString() === today.toDateString();
  },

  getCurrentRotaryYear() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    if (month >= 7) {
      return `${year}-${String(year + 1).slice(2)}`;
    } else {
      return `${year - 1}-${String(year).slice(2)}`;
    }
  },

  getMonthName(month) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[(month - 1)] || '';
  },

  calcDuration(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    try {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      return (eh * 60 + em) - (sh * 60 + sm);
    } catch (e) {
      return 0;
    }
  },

  getICSString(event) {
    if (!event) return '';
    try {
      const startDate = new Date(`${event.event_date}T${event.start_time}`);
      const endDate = event.end_time
        ? new Date(`${event.event_date}T${event.end_time}`)
        : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

      const formatICSDate = (d) =>
        d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

      return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Rotaract Club DRNGPASC//EN',
        'BEGIN:VEVENT',
        `DTSTART:${formatICSDate(startDate)}`,
        `DTEND:${formatICSDate(endDate)}`,
        `SUMMARY:${(event.title || '').replace(/,/g, '\\,')}`,
        `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n').replace(/,/g, '\\,')}`,
        `LOCATION:${(event.venue || '').replace(/,/g, '\\,')}`,
        'ORGANIZER:mailto:rac.drngpasc@gmail.com',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');
    } catch (e) {
      return '';
    }
  }
};

/* ============================================================
   STRING UTILITIES
   ============================================================ */
const StringUtils = {
  truncate(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength).trim() + '...';
  },

  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  snakeToTitle(str) {
    if (!str) return '';
    return str.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  },

  sanitize(str) {
    if (str === null || str === undefined) return '';
    const s = String(str);
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(s));
    return div.innerHTML;
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(num);
  },

  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }
};

/* ============================================================
   VALIDATION UTILITIES
   ============================================================ */
const Validate = {
  email(email) {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  phone(phone) {
    if (!phone) return false;
    return /^(\+91|91|0)?[6-9]\d{9}$/.test(phone.replace(/\s/g, ''));
  },

  required(str) {
    return str !== null && str !== undefined && str.toString().trim().length > 0;
  },

  futureDate(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  },

  fileSize(file, maxBytes) {
    return file && file.size <= maxBytes;
  },

  imageType(file) {
    if (!file) return false;
    return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type);
  }
};

/* ============================================================
   LOCAL STORAGE HELPERS
   ============================================================ */
const Storage = {
  set(key, value, expiryMs = null) {
    const item = {
      value,
      timestamp: Date.now(),
      expiry: expiryMs ? Date.now() + expiryMs : null
    };
    try {
      localStorage.setItem(`rac_${key}`, JSON.stringify(item));
    } catch (e) {
      console.warn('LocalStorage set failed:', e);
    }
  },

  get(key) {
    try {
      const raw = localStorage.getItem(`rac_${key}`);
      if (!raw) return null;
      const item = JSON.parse(raw);
      if (item.expiry && Date.now() > item.expiry) {
        this.remove(key);
        return null;
      }
      return item.value;
    } catch (e) {
      return null;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(`rac_${key}`);
    } catch (e) {}
  },

  clearAll() {
    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith('rac_'))
        .forEach(key => localStorage.removeItem(key));
    } catch (e) {}
  }
};

/* ============================================================
   DEBOUNCE & THROTTLE
   ============================================================ */
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function throttle(func, limit = 100) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/* ============================================================
   SUPABASE CLIENT — SINGLE INSTANCE
   ============================================================ */
let supabaseClient = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    try {
      supabaseClient = supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
          },
          global: {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
          },
          realtime: {
            params: {
              eventsPerSecond: 10
            }
          }
        }
      );
    } catch (e) {
      console.error('Supabase client creation failed:', e);
    }
  }
  return supabaseClient;
}

/* ============================================================
   PERMISSION CHECKER
   ============================================================ */
const PermissionChecker = {
  can(role, permission) {
    if (!role || !permission) return false;
    const allowed = PERMISSIONS[permission];
    if (!allowed) return false;
    if (allowed === 'all') return true;
    return Array.isArray(allowed) && allowed.includes(role);
  },

  canAccessAvenue(role, avenue) {
    if (!role || !avenue) return false;
    const fullAccessRoles = [
      'super_admin', 'advisor', 'president', 'immediate_past_president',
      'vice_president', 'secretary_administration', 'secretary_communication'
    ];
    if (fullAccessRoles.includes(role)) return true;
    const roleAvenue = ROLE_TO_AVENUE[role];
    return roleAvenue === avenue;
  },

  getAccessibleAvenues(role) {
    if (!role) return [];
    const fullAccessRoles = [
      'super_admin', 'advisor', 'president', 'immediate_past_president',
      'vice_president', 'secretary_administration', 'secretary_communication'
    ];
    if (fullAccessRoles.includes(role)) {
      return Object.keys(AVENUES);
    }
    const roleAvenue = ROLE_TO_AVENUE[role];
    return roleAvenue ? [roleAvenue] : [];
  },

  hasLevel(role, minLevel) {
    return (ROLE_HIERARCHY[role] || 0) >= minLevel;
  },

  isHigherThan(role, compareRole) {
    return (ROLE_HIERARCHY[role] || 0) > (ROLE_HIERARCHY[compareRole] || 0);
  }
};

/* ============================================================
   IMAGE UTILITIES
   ============================================================ */
const ImageUtils = {
  async compress(file, maxWidth = 1280, maxHeight = 960, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No file provided'));
        return;
      }

      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas toBlob failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  },

  generateFilename(prefix = 'photo', extension = 'jpg') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 8);
    return `${prefix}_${timestamp}_${random}.${extension}`;
  },

  getPublicUrl(bucket, path) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    try {
      const db = getSupabaseClient();
      if (!db) return '';
      const { data } = db.storage.from(bucket).getPublicUrl(path);
      return data?.publicUrl || '';
    } catch (e) {
      return '';
    }
  }
};

/* ============================================================
   MAKE EVERYTHING GLOBAL
   ============================================================ */
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
window.SUPABASE_SERVICE_KEY = SUPABASE_SERVICE_KEY;
window.EMAILJS_CONFIG = EMAILJS_CONFIG;
window.AI_CONFIG = AI_CONFIG;
window.CLUB_INFO = CLUB_INFO;
window.ROLES = ROLES;
window.ROLE_DISPLAY_NAMES = ROLE_DISPLAY_NAMES;
window.ROLE_HIERARCHY = ROLE_HIERARCHY;
window.PERMISSIONS = PERMISSIONS;
window.AVENUES = AVENUES;
window.ROLE_TO_AVENUE = ROLE_TO_AVENUE;
window.STORAGE_BUCKETS = STORAGE_BUCKETS;
window.FILE_LIMITS = FILE_LIMITS;
window.MAX_PHOTOS = MAX_PHOTOS;
window.BLOOD_GROUPS = BLOOD_GROUPS;
window.ROTARY_GROUPS = ROTARY_GROUPS;
window.COLLABORATION_TYPES = COLLABORATION_TYPES;
window.MEETING_TYPES = MEETING_TYPES;
window.EVENT_STATUS = EVENT_STATUS;
window.TRANSACTION_CATEGORIES = TRANSACTION_CATEGORIES;
window.ROTARY_YEARS = ROTARY_YEARS;
window.GAMES_CONFIG = GAMES_CONFIG;
window.QUIZ_QUESTIONS = QUIZ_QUESTIONS;
window.TYPING_QUOTES = TYPING_QUOTES;
window.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
window.DateUtils = DateUtils;
window.StringUtils = StringUtils;
window.Validate = Validate;
window.Storage = Storage;
window.debounce = debounce;
window.throttle = throttle;
window.getSupabaseClient = getSupabaseClient;
window.PermissionChecker = PermissionChecker;
window.ImageUtils = ImageUtils;

/* ============================================================
   INITIALIZE EMAILJS
   ============================================================ */
(function initEmailJS() {
  if (typeof emailjs !== 'undefined') {
    try {
      emailjs.init(EMAILJS_CONFIG.publicKey);
    } catch (e) {
      console.warn('EmailJS init failed:', e);
    }
  }
})();

/* ============================================================
   CONSOLE BRANDING
   ============================================================ */
console.log(
  '%c Rotaract Club of Dr. N.G.P Arts & Science College ',
  'background:#0055FF;color:#FFFFFF;font-weight:700;font-size:13px;padding:8px 16px;border-radius:4px;'
);
console.log(
  '%c Club ID: 217835 | RI District 3206 | Charter: 11.02.2020 ',
  'color:#0055FF;font-weight:500;font-size:11px;'
);