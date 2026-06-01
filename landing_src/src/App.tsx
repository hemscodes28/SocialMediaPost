import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface FeatureItem {
  icon: ReactNode;
  title: string;
  description: string;
  bg: string;
  glow: string;
  details: string;
  badge?: string;
}
import { 
  Sparkles, 
  CalendarDays, 
  Users, 
  LayoutDashboard, 
  SendHorizontal, 
  ArrowRight, 
  ChevronDown, 
  Rocket, 
  Menu, 
  X 
} from 'lucide-react';

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const FacebookLogo = () => (
  <svg viewBox="0 0 24 24" className="w-10 h-10 relative z-10 transition-colors duration-300">
    <circle cx="12" cy="12" r="10" className="fill-[#1877f2] group-hover:fill-white transition-colors duration-300" />
    <path
      d="M13.5 17.5v-5.5h1.8l.3-2.1h-2.1V8.6c0-.6.2-.8.8-.8h1.2V5.9c-.2 0-.9-.1-1.7-.1-1.7 0-2.9 1-2.9 3v1.6H9.3v2.1h1.6v5.5h2.6z"
      className="fill-white group-hover:fill-[#1877f2] transition-colors duration-300"
    />
  </svg>
);

const YoutubeLogo = () => (
  <svg viewBox="0 0 24 24" className="w-11 h-10 relative z-10 transition-colors duration-300">
    <path
      d="M21.543 6.498C22 8.24 22 12 22 12s0 3.76-.457 5.502c-.254.985-.997 1.76-1.938 2.022C17.896 20 12 20 12 20s-5.893 0-7.605-.476c-.945-.266-1.687-1.04-1.938-2.022C2 15.76 2 12 2 12s0-3.76.457-5.502c.254-.985.997-1.76 1.938-2.022C6.107 4 12 4 12 4s5.896 0 7.605.476c.945.266 1.687 1.04 1.938 2.022z"
      className="fill-[#ff0000] group-hover:fill-white transition-colors duration-300"
    />
    <polygon
      points="10 8.5 16 12 10 15.5"
      className="fill-white group-hover:fill-[#ff0000] transition-colors duration-300"
    />
  </svg>
);

// Brand logos with names, svgl.app URLs, and custom brand gradients for the marquee
const logos = [
  { name: 'Instagram', src: './instagram (1).png', gradient: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' },
  { name: 'Facebook', src: '', gradient: 'linear-gradient(135deg, #1877f2 0%, #0056b3 100%)' },
  { name: 'LinkedIn', src: 'https://svgl.app/library/linkedin.svg', gradient: 'linear-gradient(135deg, #0a66c2 0%, #004182 100%)' },
  { name: 'X', src: 'https://svgl.app/library/x.svg', gradient: 'linear-gradient(135deg, #000000 0%, #333333 100%)' },
  { name: 'Threads', src: './threads.png', gradient: 'linear-gradient(135deg, #101010 0%, #000000 100%)' },
  { name: 'Pinterest', src: 'https://svgl.app/library/pinterest.svg', gradient: 'linear-gradient(135deg, #e60023 0%, #ad0018 100%)' },
  { name: 'Twitter', src: 'https://svgl.app/library/twitter.svg', gradient: 'linear-gradient(135deg, #1d9bf0 0%, #0d8bd0 100%)' },
  { name: 'TikTok', src: './tik-tok.png', gradient: 'linear-gradient(135deg, #010101 0%, #25f4ee 100%)' },
  { name: 'YouTube', src: '', gradient: 'linear-gradient(135deg, #ff0000 0%, #cc0000 100%)' }
];


export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [activeFeature, setActiveFeature] = useState<number | null>(null);

  const handleNavigation = (dest: string) => {
    window.location.href = dest;
  };

  const handleScroll = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const features: FeatureItem[] = [
    {
      icon: <Sparkles className="w-6 h-6 text-indigo-600" />,
      title: "AI Magic Captions",
      description: "Upload your media and let AI craft engaging, hashtag-rich captions tailored for Instagram and LinkedIn culture.",
      bg: "rgba(79,70,229,0.08)",
      glow: "rgba(79,70,229,0.15)",
      details: "Our AI Caption Generator is powered by GPT-4o — the most advanced multimodal AI from OpenAI. Simply upload your image or type a topic, choose your tone (professional, fun, inspirational, etc.), and click Generate. The AI analyzes your image visually, understands your context, and writes platform-perfect captions complete with relevant hashtags.\n\n✦ Supports Instagram, LinkedIn, and Threads\n✦ Generates all 3 platform captions simultaneously\n✦ Understands image content via computer vision\n✦ Customizable tone selection\n✦ Extracts and formats hashtags automatically"
    },
    {
      icon: <CalendarDays className="w-6 h-6 text-emerald-600" />,
      title: "Smart Scheduling",
      description: "Queue posts for the perfect moment. Our persistent scheduler ensures your content goes live exactly when planned.",
      bg: "rgba(16,185,129,0.08)",
      glow: "rgba(16,185,129,0.15)",
      details: "Post Pilot.ai's Smart Scheduler uses APScheduler with SQLite persistence — meaning your scheduled posts survive server restarts and won't be lost. Pick any future date and time, and your post will be published automatically even if you're offline.\n\n✦ Set exact date and time for future publishing\n✦ Schedules survive server restarts (SQLite persistence)\n✦ Supports all platforms: Instagram, LinkedIn, Threads\n✦ View and manage all pending jobs from your dashboard\n✦ Failed jobs are logged with error details for review"
    },
    {
      icon: <Users className="w-6 h-6 text-blue-600" />,
      title: "Multi-Account Control",
      description: "Connect multiple Instagram, LinkedIn, and Threads profiles. Switch targets instantly when creating or publishing content.",
      bg: "rgba(37,99,235,0.08)",
      glow: "rgba(37,99,235,0.15)",
      details: "Manage all your social media identities from one place. Post Pilot.ai lets you connect and switch between multiple accounts per platform, so you can publish personal and brand content without logging in and out.\n\n✦ Multiple Instagram business/creator accounts\n✦ Multiple LinkedIn personal profiles\n✦ Multiple Threads accounts\n✦ Select target account per post in the composer\n✦ Each account is securely stored with OAuth tokens"
    },
    {
      icon: <InstagramIcon className="w-6 h-6 text-pink-600" />,
      title: "Instagram Publishing",
      description: "Single images and carousels with cloud-hosted media. Real-time previews before you hit publish.",
      bg: "rgba(225,48,108,0.08)",
      glow: "rgba(225,48,108,0.15)",
      details: "Connect your Instagram Business or Creator account via Meta OAuth and publish directly from the dashboard. Supports both single photo posts and multi-image carousel posts. Images are auto-uploaded to cloud hosting before publishing.\n\n✦ Single image posts with AI captions\n✦ Carousel posts (up to 10 images)\n✦ Real-time post preview before publishing\n✦ Auto cloud hosting via Catbox/ImgBB/Imgur\n✦ Long-lived token auto-refresh (60-day tokens)"
    },
    {
      icon: <LinkedinIcon className="w-6 h-6 text-sky-700" />,
      title: "LinkedIn Publishing",
      description: "Share professional updates with text or rich image posts. Manage member accounts from one command center.",
      bg: "rgba(10,102,194,0.08)",
      glow: "rgba(10,102,194,0.15)",
      details: "Connect LinkedIn personal profiles via OAuth and publish professional content directly. Post Pilot.ai uses the official LinkedIn REST API v2 for secure, reliable publishing to your professional network.\n\n✦ Text-only posts and image posts\n✦ AI generates structured LinkedIn content: hook, body, CTA, hashtags\n✦ Multiple member accounts supported\n✦ Secure OAuth 2.0 token management\n✦ Instant publish or schedule for later"
    },
    {
      icon: <LayoutDashboard className="w-6 h-6 text-amber-600" />,
      title: "Profile Dashboard",
      description: "Track published, scheduled, and failed posts. View connected accounts and posting history at a glance.",
      bg: "rgba(245,158,11,0.08)",
      glow: "rgba(245,158,11,0.15)",
      details: "Your central command center for everything. The Profile Dashboard gives you a bird's-eye view of your entire social media activity — connected accounts, post history, and scheduled jobs — all in one beautiful interface.\n\n✦ Summary stats: total posts, platforms, schedules\n✦ Complete post history with thumbnails and captions\n✦ Connected accounts status for all platforms\n✦ Scheduled jobs with countdown timers\n✦ One-click retry for failed posts"
    },
    {
      icon: <img src="./threads (1).png" className="w-6 h-6 object-contain" alt="Threads Icon" />,
      title: "Threads Publishing",
      description: "Publish directly to Meta Threads. Connect your account via OAuth and post text, images, and media with full AI caption support.",
      bg: "rgba(0,0,0,0.05)",
      glow: "rgba(0,0,0,0.12)",
      details: "Post Pilot.ai now supports Meta Threads — the fast-growing text and media platform by Meta. Connect your Threads account and publish alongside Instagram and LinkedIn in one unified workflow.\n\n✦ OAuth-based secure account connection\n✦ Post text, images, and media to Threads\n✦ AI generates Threads-specific captions: short, punchy, conversational\n✦ Schedule Threads posts for automatic publishing\n✦ Multi-account Threads support\n✦ Real-time post preview in Threads format"
    },
    {
      icon: <span className="text-2xl">🤖</span>,
      title: "AI Caption Assistant",
      description: "Advanced AI that reads your image, understands your topic, and generates platform-specific captions with tone control for all 3 platforms at once.",
      bg: "rgba(139,92,246,0.08)",
      glow: "rgba(139,92,246,0.15)",
      details: "The AI Caption Assistant is an upgrade over basic caption generation. It uses GPT-4o's vision capability to read and understand your uploaded image, then combines that with your typed topic to produce deeply relevant, creative captions for all platforms simultaneously.\n\n✦ Image vision: AI sees and describes your photo\n✦ Topic-aware: combine image + typed topic for richer results\n✦ Generates Instagram, LinkedIn & Threads captions in one click\n✦ Tone selector: Professional, Fun, Inspirational, Motivational\n✦ Separate hashtag extraction per platform\n✦ No more generic captions — every output is unique"
    },
    {
      icon: <span className="text-2xl">📋</span>,
      title: "1000+ Post Templates",
      description: "Choose from a growing library of ready-made post templates for every niche, platform, and occasion. Customize and publish in seconds.",
      bg: "rgba(245,158,11,0.08)",
      glow: "rgba(245,158,11,0.15)",
      details: "Skip the blank page. Post Pilot.ai includes a growing library of 1000+ professionally crafted post templates across every category and platform. Pick a template, fill in your details, and post in seconds.\n\n✦ 1000+ templates across all niches\n✦ Categories: Business, Lifestyle, Fitness, Food, Tech, Travel & more\n✦ Platform-specific: separate templates for Instagram, LinkedIn, Threads\n✦ Customizable: edit any template before posting\n✦ AI-enhanced: apply AI Magic to refine any template\n✦ New templates added regularly"
    }
  ];

  const steps = [
    { num: 1, title: "Create Account", desc: "Sign up free and access your personal command center." },
    { num: 2, title: "Connect Accounts", desc: "Link Instagram, LinkedIn, and Threads profiles securely via OAuth." },
    { num: 3, title: "Create Content", desc: "Upload media, use AI Magic for captions, preview posts live." },
    { num: 4, title: "Publish or Schedule", desc: "Post instantly or queue for the perfect time slot." }
  ];

  const faqs = [
    {
      q: "Is Post Pilot.ai free to start?",
      a: "Yes — create an account and explore the full dashboard. Connect your social accounts and start publishing right away."
    },
    {
      q: "Which platforms are supported?",
      a: "Instagram (single image and carousel), LinkedIn (text and image posts), and now Threads (text and media posts). More platforms coming soon!"
    },
    {
      q: "How does AI caption generation work?",
      a: "Upload your media in Create & Post, then click AI Magic. Our AI (GPT-4o) analyzes your image visually, combines it with your topic, and generates platform-appropriate captions with relevant hashtags for Instagram, LinkedIn, and Threads simultaneously."
    },
    {
      q: "Can I schedule posts in advance?",
      a: "Absolutely. Use the Schedule button when creating content, pick your date and time, and our persistent scheduler handles the rest — even surviving server restarts."
    },
    {
      q: "What is Threads integration?",
      a: "Post Pilot.ai now supports Meta Threads. Connect your Threads account via OAuth and publish text, images, and media with full AI caption support and scheduling."
    },
    {
      q: "What are the 1000+ templates?",
      a: "A growing library of professionally crafted post templates across every niche and platform. Pick a template, customize it, apply AI Magic if needed, and publish in seconds."
    }
  ];

  const stats = [
    { value: "3+", label: "Platforms Supported" },
    { value: "1000+", label: "Post Templates" },
    { value: "GPT-4o", label: "AI Engine" },
    { value: "24/7", label: "Smart Scheduler" }
  ];

  return (
    <main className="min-h-screen bg-[#f9fafb] font-sans antialiased text-[#0f172a] overflow-x-hidden">
      
      {/* 1. Header Sticky Nav */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/50 bg-white/70 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/static/landing.html" className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-600 bg-clip-text text-transparent transition-transform hover:scale-[1.02]">
            <SendHorizontal className="w-6 h-6 text-blue-600" />
            <span className="font-display">Post Pilot.ai</span>
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8">
            <button onClick={() => handleScroll('features')} className="text-[14px] font-semibold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer">Features</button>
            <button onClick={() => handleScroll('platforms')} className="text-[14px] font-semibold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer">Platforms</button>
            <button onClick={() => handleScroll('how-it-works')} className="text-[14px] font-semibold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer">How It Works</button>
            <button onClick={() => handleScroll('faq')} className="text-[14px] font-semibold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer">FAQ</button>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            <button 
              onClick={() => handleNavigation('/static/login.html')}
              className="text-[14px] font-semibold text-slate-700 hover:text-slate-950 px-4 py-2 transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button 
              onClick={() => handleNavigation('/static/signup.html')}
              className="bg-blue-600 text-white text-[14px] font-semibold px-5 py-2.5 rounded-full shadow-[0_4px_12px_rgba(37,99,235,0.15)] hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Get Started
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-slate-200 bg-white px-6 py-4 flex flex-col gap-4 shadow-inner"
            >
              <button onClick={() => handleScroll('features')} className="text-left text-[15px] font-semibold text-slate-600 py-2">Features</button>
              <button onClick={() => handleScroll('platforms')} className="text-left text-[15px] font-semibold text-slate-600 py-2">Platforms</button>
              <button onClick={() => handleScroll('how-it-works')} className="text-left text-[15px] font-semibold text-slate-600 py-2">How It Works</button>
              <button onClick={() => handleScroll('faq')} className="text-left text-[15px] font-semibold text-slate-600 py-2">FAQ</button>
              <div className="h-px bg-slate-100 my-1" />
              <button 
                onClick={() => handleNavigation('/static/login.html')}
                className="text-left text-[15px] font-semibold text-slate-700 py-2"
              >
                Sign In
              </button>
              <button 
                onClick={() => handleNavigation('/static/signup.html')}
                className="bg-blue-600 text-white text-center text-[15px] font-semibold py-3 rounded-full shadow-[0_4px_12px_rgba(37,99,235,0.15)]"
              >
                Get Started
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="py-12 px-4 md:px-8 max-w-[1400px] mx-auto flex flex-col gap-24">
        
        {/* 2. Main Hero Container (White with shades and Blue border) */}
        <section className="relative w-full rounded-[48px] bg-white border border-blue-200/80 shadow-[0_40px_100px_-20px_rgba(37,99,235,0.08)] overflow-hidden h-[620px] flex flex-col">
          
          {/* Underlying video layer (Restore full opacity animation) */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none opacity-100">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover scale-105"
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260505_101331_74f9b798-3f00-4e86-8a01-377aa16ffeaa.mp4"
            />
          </div>

          {/* Hero Content */}
          <div className="relative z-20 flex-1 px-8 md:px-20 pt-16 md:pt-20 flex flex-col items-start justify-start text-slate-900">
            
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-[700px] flex flex-col gap-6 items-start"
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide text-blue-600">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI-Powered Social Automation</span>
              </div>

              {/* Headline using Outfit (font-display) */}
              <h1 className="font-display text-[40px] sm:text-[52px] md:text-[62px] font-extrabold leading-[1.08] tracking-tight text-slate-900">
                Command Your <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-800 bg-clip-text text-transparent">Social Presence</span> From One Place
              </h1>

              {/* Subheadline using Poppins (font-poppins) as requested */}
              <p className="font-poppins text-[15px] sm:text-[17px] leading-relaxed text-slate-700 max-w-[620px]">
                Create stunning posts, generate platform-perfect captions with AI, publish instantly or schedule ahead — across Instagram and LinkedIn with enterprise-grade reliability.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4 mt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleNavigation('/static/signup.html')}
                  className="bg-blue-600 text-white text-[15px] font-bold px-8 py-4 rounded-full shadow-[0_6px_20px_rgba(37,99,235,0.15)] hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-2"
                >
                  <span>Start Free</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleNavigation('/static/login.html')}
                  className="bg-slate-100 text-slate-800 border border-slate-200/80 text-[15px] font-bold px-8 py-4 rounded-full hover:bg-slate-200 transition-colors cursor-pointer flex items-center gap-2"
                >
                  <span>Sign In</span>
                </motion.button>
              </div>
            </motion.div>
          </div>

          {/* Floating Bottom Navbar inside Hero Container */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 w-[95%] sm:w-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="flex items-center bg-white/90 backdrop-blur-2xl px-6 py-4 rounded-[28px] shadow-xl border border-slate-200/50 gap-6 sm:gap-8"
            >
              <div className="w-10 h-10 bg-blue-600 shadow-md rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                ✦
              </div>

              <div className="flex items-center gap-4 sm:gap-8 pr-2">
                {/* 3+ Platforms */}
                <div className="flex flex-col items-start">
                  <div className="text-lg sm:text-xl font-extrabold font-display text-slate-900 leading-none">3+</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">platforms</div>
                </div>

                <div className="w-px h-8 bg-slate-200 shrink-0" />

                {/* 10 per post */}
                <div className="flex flex-col items-start">
                  <div className="text-lg sm:text-xl font-extrabold font-display text-slate-900 leading-none">10</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">per post</div>
                </div>

                <div className="w-px h-8 bg-slate-200 shrink-0" />

                {/* 24/7 smart scheduler */}
                <div className="flex flex-col items-start">
                  <div className="text-lg sm:text-xl font-extrabold font-display text-slate-900 leading-none">24/7</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">smart scheduler</div>
                </div>
              </div>
            </motion.div>
          </div>

        </section>

        {/* 3. Seamless Marquee Logo Scroller */}
        <section className="w-full overflow-hidden mask-gradient relative py-4">
          <div className="animate-marquee gap-8">
            {[...logos, ...logos].map((logo, index) => (
              <div
                key={`${logo.name}-${index}`}
                className="group relative h-24 w-40 shrink-0 flex items-center justify-center rounded-full bg-white border border-slate-200/60 shadow-sm hover:border-indigo-200 transition-all overflow-hidden cursor-pointer"
              >
                <div
                  style={{ backgroundImage: logo.gradient }}
                  className="absolute inset-0 opacity-0 scale-150 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500 ease-out rounded-full z-0"
                />
                
                {logo.name === 'Facebook' ? (
                  <FacebookLogo />
                ) : logo.name === 'YouTube' ? (
                  <YoutubeLogo />
                ) : (
                  <img
                    src={logo.src}
                    alt={logo.name}
                    className={`h-10 w-24 object-contain relative z-10 transition-all duration-300 ${
                      logo.name === 'Threads' || logo.name === 'TikTok'
                        ? '' 
                        : 'group-hover:brightness-0 group-hover:invert'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 4. Features Section */}
        <section id="features" className="scroll-mt-24">
          <div className="text-center max-w-[800px] mx-auto flex flex-col items-center gap-4 mb-16">
            <div className="inline-flex items-center bg-blue-50 border border-blue-100 px-3 py-1 rounded-full text-xs font-semibold tracking-wide text-blue-600">
              Everything You Need
            </div>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
              Built for Creators, Teams &amp; Brands
            </h2>
            <p className="text-slate-500 leading-relaxed max-w-[620px]">
              Post Pilot.ai combines intelligent content tools with multi-account publishing — the same polished experience you get inside the dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feat, idx) => (
              <motion.article 
                key={idx}
                whileHover={{ y: -6 }}
                transition={{ duration: 0.3 }}
                className="relative overflow-hidden bg-white rounded-3xl border border-slate-200/60 p-8 shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] hover:border-slate-300/80 transition-all group cursor-pointer"
              >
                {/* Glowing light spot */}
                <div 
                  style={{ backgroundColor: feat.glow }} 
                  className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" 
                />

                <div 
                  style={{ backgroundColor: feat.bg }}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 duration-300"
                >
                  {feat.icon}
                </div>

                <h3 className="font-display text-lg font-bold text-slate-900 mb-2.5">
                  {feat.title}
                </h3>
                
                <p className="text-sm text-slate-500 leading-relaxed mb-6">
                  {feat.description}
                </p>

                <button
                  onClick={() => setActiveFeature(idx)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors group-hover:gap-2.5 cursor-pointer"
                >
                  <span>Learn more</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </button>

                {'badge' in feat && feat.badge && (
                  <span className="absolute top-4 right-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                    {feat.badge as string}
                  </span>
                )}
              </motion.article>
            ))}
          </div>
        </section>

        {/* 5. Platforms Section */}
        <section id="platforms" className="scroll-mt-24 bg-slate-50 rounded-[40px] p-8 md:p-16 border border-slate-200/40">
          <div className="text-center max-w-[800px] mx-auto flex flex-col items-center gap-4 mb-12">
            <div className="inline-flex items-center bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full text-xs font-semibold tracking-wide text-indigo-600">
              Integrated Platforms
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Publish Where Your Audience Lives
            </h2>
            <p className="text-slate-500 leading-relaxed max-w-[620px]">
              Seamlessly connect and post to the platforms that matter most for your brand.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mt-4">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500/10 to-rose-500/10 border border-pink-200/60 px-5 py-2.5 rounded-full text-sm font-semibold text-rose-700">
                <InstagramIcon className="w-4 h-4 text-rose-500" />
                <span>Instagram — Feed &amp; Carousel</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500/10 to-sky-500/10 border border-blue-200/60 px-5 py-2.5 rounded-full text-sm font-semibold text-blue-700">
                <LinkedinIcon className="w-4 h-4 text-blue-600" />
                <span>LinkedIn — Text &amp; Image Posts</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-slate-950/[0.04] border border-slate-200 px-5 py-2.5 rounded-full text-sm font-semibold text-slate-800">
                <img src="./threads (1).png" className="w-4 h-4 object-contain" alt="Threads logo" />
                <span>Threads — Text &amp; Media</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
            <div className="bg-white rounded-3xl p-8 border border-slate-200/60 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
                  <InstagramIcon className="w-5.5 h-5.5 text-pink-600" />
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900">Instagram Workflow</h3>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                Connect via Meta/Facebook Login, link Business or Creator accounts, upload media, generate AI captions, preview your post, then publish or schedule — including multi-image carousels.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-slate-200/60 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <LinkedinIcon className="w-5.5 h-5.5 text-blue-600" />
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900">LinkedIn Workflow</h3>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                OAuth-connect professional profiles, craft thought-leadership copy with AI assistance, attach images when needed, and publish to selected member accounts instantly.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-slate-200/60 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                  <img src="./threads (1).png" className="w-5.5 h-5.5 object-contain" alt="Threads" />
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900">Threads Workflow</h3>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                Connect your Threads account via secure OAuth, compose text-based updates or upload images, generate optimized captions with AI assistance, and schedule or publish instantly.
              </p>
            </div>
          </div>
        </section>

        {/* 6. Stats Band Section */}
        <section className="bg-slate-900 text-white rounded-[40px] p-10 md:p-16 relative overflow-hidden border border-slate-800">
          {/* Subtle decoration grids */}
          <div className="absolute inset-0 pointer-events-none z-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" />
          
          <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 text-center">
            {stats.map((stat, idx) => (
              <div key={idx} className="flex flex-col gap-2">
                <div className="text-4px sm:text-[44px] font-extrabold font-display bg-gradient-to-r from-blue-400 to-indigo-200 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-xs md:text-sm text-slate-400 font-semibold tracking-wide uppercase">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 7. How It Works Section */}
        <section id="how-it-works" className="scroll-mt-24">
          <div className="text-center max-w-[800px] mx-auto flex flex-col items-center gap-4 mb-16">
            <div className="inline-flex items-center bg-blue-50 border border-blue-100 px-3 py-1 rounded-full text-xs font-semibold tracking-wide text-blue-600">
              Simple Workflow
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              From Idea to Published in Four Steps
            </h2>
            <p className="text-slate-500 leading-relaxed max-w-[620px]">
              No complex setup. Connect, create, and command your social feed in minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, idx) => (
              <div key={idx} className="relative flex flex-col items-start gap-4 p-6 bg-white border border-slate-200/50 rounded-3xl shadow-sm">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shadow-md shadow-blue-200">
                  {step.num}
                </div>
                <h3 className="font-display font-bold text-slate-900 text-base mt-2">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 8. FAQ Accordion Section */}
        <section id="faq" className="scroll-mt-24 max-w-[800px] mx-auto w-full">
          <div className="text-center flex flex-col items-center gap-4 mb-12">
            <div className="inline-flex items-center bg-blue-50 border border-blue-100 px-3 py-1 rounded-full text-xs font-semibold tracking-wide text-blue-600">
              FAQ
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Common Questions
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            {faqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div 
                  key={idx} 
                  className="bg-white border border-slate-200/70 rounded-2xl shadow-sm overflow-hidden transition-all hover:border-slate-300"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full px-6 py-5 text-left flex items-center justify-between font-bold text-slate-900 text-[15px] sm:text-base cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                      >
                        <div className="px-6 pb-5 pt-1 text-sm text-slate-500 leading-relaxed border-t border-slate-100">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

        {/* 9. CTA Section */}
        <section className="bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-950 text-white rounded-[48px] p-8 md:p-16 text-center relative overflow-hidden shadow-2xl border border-indigo-900">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

          <div className="relative z-10 max-w-[700px] mx-auto flex flex-col items-center gap-6">
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
              Ready to Pilot Your Social Strategy?
            </h2>
            <p className="text-indigo-200 text-sm sm:text-base max-w-[560px] leading-relaxed">
              Join Post Pilot.ai today and experience the same elegant dashboard your team will love — from first post to full automation.
            </p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleNavigation('/static/signup.html')}
              className="mt-4 bg-white text-blue-900 text-[15px] font-extrabold px-8 py-4 rounded-full shadow-lg hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2"
            >
              <span>Create Free Account</span>
              <Rocket className="w-4 h-4 text-blue-600" />
            </motion.button>
          </div>
        </section>

      </div>

      {/* 10. Footer Section */}
      <footer className="border-t border-slate-200 bg-white mt-20">
        <div className="max-w-[1400px] mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <a href="/static/landing.html" className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
            <SendHorizontal className="w-5 h-5 text-blue-600" />
            <span className="font-display">Post Pilot.ai</span>
          </a>

          <div className="flex flex-wrap justify-center gap-6 text-[13px] font-semibold text-slate-500">
            <button onClick={() => handleScroll('features')} className="hover:text-blue-600 transition-colors cursor-pointer">Features</button>
            <a href="/privacy.html" className="hover:text-blue-600 transition-colors">Privacy</a>
            <a href="/terms.html" className="hover:text-blue-600 transition-colors">Terms</a>
            <a href="/delete-data.html" className="hover:text-blue-600 transition-colors">Delete Data</a>
            <a href="/static/login.html" className="hover:text-blue-600 transition-colors">Sign In</a>
            <a href="/static/signup.html" className="hover:text-blue-600 transition-colors">Sign Up</a>
          </div>

          <p className="text-xs text-slate-400">
            &copy; 2026 Post Pilot.ai. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Feature Detail Popup Modal */}
      {activeFeature !== null && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={() => setActiveFeature(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveFeature(null)}
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>

            <div className="flex items-center gap-4 mb-5">
              <div
                style={{ backgroundColor: features[activeFeature].bg }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
              >
                {features[activeFeature].icon}
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900">{features[activeFeature].title}</h3>
                {'badge' in features[activeFeature] && (features[activeFeature] as any).badge && (
                  <span className="inline-block mt-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {(features[activeFeature] as any).badge}
                  </span>
                )}
              </div>
            </div>

            <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 rounded-2xl p-5 border border-slate-100">
              {(features[activeFeature] as any).details}
            </div>

            <button
              onClick={() => setActiveFeature(null)}
              className="mt-6 w-full bg-blue-600 text-white font-bold py-3 rounded-2xl hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Got it!
            </button>
          </motion.div>
        </div>
      )}

    </main>
  );
}
