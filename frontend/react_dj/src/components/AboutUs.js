import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Music, Users, Brain, Sparkles, ArrowRight, 
  Mic, Share, Calendar, Zap, MessageCircle, Shield
} from 'lucide-react';
import styles from '../styles/about.module.css';

const content = {
  en: {
    hero: {
      title: "AI-Powered Intelligent Music Experience",
      subtitle: "AICO AI DJ perfectly combines artificial intelligence with music to create a unique social music experience. Make every moment have the perfect soundtrack, and fill every occasion with vitality."
    },
    values: [
      {
        icon: <Brain />,
        title: "Intelligent Recommendations",
        text: "Using advanced AI algorithms to deeply understand your music taste and recommend the most suitable music for each scenario, making music selection effortless and natural."
      },
      {
        icon: <Users />,
        title: "Social Interaction",
        text: "Create or join virtual music rooms, share music with friends, and build perfect playlists together, making music a new way of social interaction."
      },
      {
        icon: <Sparkles />,
        title: "Scene Customization",
        text: "Whether it's work focus, party celebration, or meditation, we can customize the most suitable music atmosphere for you."
      }
    ],
    features: {
      title: "Advanced Features",
      list: [
        {
          icon: <Mic />,
          title: "Voice Control",
          text: "Control your music experience with natural voice commands"
        },
        {
          icon: <Share />,
          title: "Cross-platform Sync",
          text: "Seamlessly sync your playlists across all devices"
        },
        {
          icon: <Calendar />,
          title: "Smart Scheduling",
          text: "Schedule different music moods for different times"
        },
        {
          icon: <Zap />,
          title: "Real-time Analysis",
          text: "Get instant insights about your music preferences"
        },
        {
          icon: <MessageCircle />,
          title: "Live Chat",
          text: "Chat with other music lovers in real-time"
        },
        {
          icon: <Shield />,
          title: "Privacy Protection",
          text: "Your music preferences are securely protected"
        }
      ]
    },
    mission: {
      title: "Our Mission",
      text: "We believe music has a unique power to connect hearts, inspire creativity, and create beautiful moments. AICO AI DJ is committed to using innovative technology to help everyone easily get a perfect music experience, truly integrating music into every moment of life."
    },
    testimonials: {
      title: "What Users Say",
      list: [
        {
          text: "AICO AI DJ has completely changed how I discover and enjoy music. The AI recommendations are incredibly accurate!",
          author: "Sarah Chen",
          role: "Music Enthusiast"
        },
        {
          text: "The social features make sharing music with friends so much fun. It's like having a party DJ in your pocket.",
          author: "Michael Zhang",
          role: "Party Host"
        },
        {
          text: "Perfect for my work environment. Creates the right atmosphere for different times of the day.",
          author: "David Liu",
          role: "Office Manager"
        }
      ]
    },
    cta: "Start Experience"
  },
  zh: {
    hero: {
      title: "AI驱动的智能音乐体验",
      subtitle: "AICO AI DJ 将人工智能与音乐完美融合，为您打造独特的社交音乐体验。让每一刻都拥有完美配乐，让每一个场合都充满活力。"
    },
    values: [
      {
        icon: <Brain />,
        title: "智能推荐",
        text: "运用先进的AI算法，深入理解您的音乐品味，为每个场景推荐最适合的音乐，让音乐选择变得轻松自然。"
      },
      {
        icon: <Users />,
        title: "社交互动",
        text: "创建或加入虚拟音乐房间，与朋友们一起分享音乐，共同打造完美播放列表，让音乐成为社交新方式。"
      },
      {
        icon: <Sparkles />,
        title: "场景定制",
        text: "无论是工作专注、派对狂欢还是静心冥想，我们都能为您量身定制最适合的音乐氛围。"
      }
    ],
    features: {
      title: "高级功能",
      list: [
        {
          icon: <Mic />,
          title: "语音控制",
          text: "使用自然语音命令控制音乐体验"
        },
        {
          icon: <Share />,
          title: "跨平台同步",
          text: "在所有设备上无缝同步您的播放列表"
        },
        {
          icon: <Calendar />,
          title: "智能调度",
          text: "为不同时段安排不同的音乐氛围"
        },
        {
          icon: <Zap />,
          title: "实时分析",
          text: "获取音乐偏好的即时洞察"
        },
        {
          icon: <MessageCircle />,
          title: "实时聊天",
          text: "与其他音乐爱好者实时交流"
        },
        {
          icon: <Shield />,
          title: "隐私保护",
          text: "您的音乐偏好受到安全保护"
        }
      ]
    },
    mission: {
      title: "我们的使命",
      text: "我们相信音乐具有独特的力量，能够连接人心、激发灵感、创造美好时刻。AICO AI DJ致力于通过创新科技，让每个人都能轻松获得完美的音乐体验，让音乐真正融入生活的每个瞬间。"
    },
    testimonials: {
      title: "用户评价",
      list: [
        {
          text: "AICO AI DJ完全改变了我发现和享受音乐的方式。AI推荐非常准确！",
          author: "陈美玲",
          role: "音乐爱好者"
        },
        {
          text: "社交功能让与朋友分享音乐变得非常有趣。就像随身携带一个派对DJ。",
          author: "张明",
          role: "派对主持人"
        },
        {
          text: "非常适合我的工作环境。为一天中的不同时段创造合适的氛围。",
          author: "刘大伟",
          role: "办公室经理"
        }
      ]
    },
    cta: "开始体验"
  }
};

function AboutUs() {
  const [language, setLanguage] = useState('en');
  const t = content[language];
  const navigate = useNavigate();

  const handleStartExperience = () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
      // If logged in, go to profile
      navigate('/homepage');
    } else {
      // If not logged in, go to login page
      navigate('/homepage');
    }
  };

  return (
    <div className={styles.aboutContainer}>
      <div className={styles.langSwitch}>
        <button 
          className={`${styles.langButton} ${language === 'zh' ? styles.active : ''}`}
          onClick={() => setLanguage('zh')}
        >
          中文
        </button>
        <button 
          className={`${styles.langButton} ${language === 'en' ? styles.active : ''}`}
          onClick={() => setLanguage('en')}
        >
          EN
        </button>
      </div>

      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>
          {t.hero.title}
        </h1>
        <p className={styles.heroSubtitle}>
          {t.hero.subtitle}
        </p>
      </section>

      <div className={styles.valueGrid}>
        {t.values.map((value, index) => (
          <div key={index} className={styles.valueCard}>
            <div className={styles.cardIcon}>
              {value.icon}
            </div>
            <h3 className={styles.cardTitle}>{value.title}</h3>
            <p className={styles.cardText}>{value.text}</p>
          </div>
        ))}
      </div>

      <section className={styles.features}>
        <h2 className={styles.featuresTitle}>{t.features.title}</h2>
        <div className={styles.featuresList}>
          {t.features.list.map((feature, index) => (
            <div key={index} className={styles.featureItem}>
              <div className={styles.featureIcon}>
                {feature.icon}
              </div>
              <div className={styles.featureContent}>
                <h4>{feature.title}</h4>
                <p>{feature.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.mission}>
        <h2 className={styles.missionTitle}>{t.mission.title}</h2>
        <p className={styles.missionText}>{t.mission.text}</p>
      </section>

      <section className={styles.testimonials}>
        <h2 className={styles.testimonialsTitle}>{t.testimonials.title}</h2>
        <div className={styles.testimonialGrid}>
          {t.testimonials.list.map((testimonial, index) => (
            <div key={index} className={styles.testimonialCard}>
              <p className={styles.testimonialText}>{testimonial.text}</p>
              <div className={styles.testimonialAuthor}>
                <div className={styles.authorInfo}>
                  <h4>{testimonial.author}</h4>
                  <p>{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.cta}>
        <button className={styles.ctaButton} onClick={handleStartExperience}>
          {t.cta} <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}

export default AboutUs;