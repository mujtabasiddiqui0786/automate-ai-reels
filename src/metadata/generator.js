/**
 * Metadata generation module for platform-specific titles, descriptions, and captions
 * @module metadata/generator
 */

const { generateSeedValue } = require('../video/utils');

const THEMES = {
  default: {
    emojis: ['✨', '🎧', '🌀'],
    hashtags: ['satisfying', 'loop', 'calm', 'relaxing', 'asmr'],
    titleTemplates: [],
    captionTemplates: []
  },
  relax: {
    emojis: ['😌', '🌙', '🎧'],
    hashtags: ['relax', 'chill', 'calm', 'soothing', 'sleep'],
    titleTemplates: ['Relaxing night vibes', 'Calm beats for your mind', 'Deep calm loop'],
    captionTemplates: ['Relax and unwind with this calming loop', 'Night vibes for instant calm', 'Lo-fi chill loop for your mind']
  },
  study: {
    emojis: ['📚', '🎧', '🧠'],
    hashtags: ['studywithme', 'lofi', 'focus', 'deepwork', 'productivity'],
    titleTemplates: ['Lo-fi for deep focus', 'Study session background', 'Focus loop for productivity'],
    captionTemplates: ['Stay focused with this loop', 'Background vibes for deep work', 'Keep studying, we got the beats']
  },
  nature: {
    emojis: ['🌿', '🌊', '🌅'],
    hashtags: ['nature', 'calm', 'serene', 'ambient', 'green'],
    titleTemplates: ['Nature inspired calm loop', 'Serene ambient motion', 'Flowing nature vibes'],
    captionTemplates: ['Nature flow to calm your mind', 'Ambient greenery loop', 'Serene vibes on repeat']
  },
  tech: {
    emojis: ['💻', '🛰️', '🧬'],
    hashtags: ['tech', 'future', 'aesthetic', 'digital', 'synth'],
    titleTemplates: ['Futuristic loop aesthetic', 'Digital pulse loop', 'Tech-inspired visuals'],
    captionTemplates: ['Neon tech loop for your feed', 'Future aesthetic on repeat', 'Digital vibes rolling']
  },
  abstract: {
    emojis: ['🎨', '🌀', '🧊'],
    hashtags: ['abstract', 'art', 'motion', 'colors', 'aesthetic'],
    titleTemplates: ['Abstract motion art loop', 'Colorful infinite flow', 'Hypnotic abstract loop'],
    captionTemplates: ['Abstract art in motion', 'Colors that flow forever', 'Hypnotic shapes on repeat']
  }
};

function pickTheme(theme) {
  if (theme && THEMES[theme]) return THEMES[theme];
  return THEMES.default;
}

/**
 * Generates platform-specific metadata for videos
 * @param {Object} metaInput - Input metadata
 * @param {string} [metaInput.style] - Style identifier
 * @param {number} [metaInput.seed] - Seed for deterministic generation
 * @param {string} [metaInput.colorProfile] - Color profile description
 * @returns {Object} Object containing all platform-specific metadata
 */
function generateMetadata(metaInput = {}) {
  const {
    style = 'default',
    seed = Date.now(),
    colorProfile = 'vibrant',
    theme = 'default',
    keywords = [],
    variants = 1
  } = metaInput;

  const themeConfig = pickTheme(theme);

  // Title templates for YouTube
  const titleTemplates = [
    'Satisfying Loop Video #{num} - Infinity Loop',
    'Mesmerizing {style} Loop - Watch Again & Again',
    'Perfect {style} Infinity Loop - So Satisfying!',
    'Infinite {style} Loop - Never Ending Satisfaction',
    'Satisfying {style} Animation Loop - Relaxing',
    'Perfect Loop #{num} - {style} Style',
    'Infinity {style} Loop - Hypnotic & Satisfying'
  ];

  // Description templates for YouTube
  const descriptionTemplates = [
    `Watch this satisfying infinity loop video! Perfect for relaxation and stress relief.

This {style}-style loop creates a mesmerizing effect that you can watch over and over again.

#Satisfying #Loop #InfinityLoop #Relaxing #ASMR #SatisfyingVideos #LoopVideo #Meditation #Zen #Calm #Peaceful #Hypnotic #Mesmerizing #OddlySatisfying #SatisfyingLoop #InfiniteLoop #SatisfyingContent #RelaxingVideo #StressRelief #Mindfulness`,

    `Experience the perfect infinity loop! This {style} loop video is designed to be watched repeatedly.

The seamless loop creates a calming, hypnotic effect that helps you relax and unwind.

#Satisfying #InfinityLoop #Loop #Relaxing #ASMR #SatisfyingVideos #LoopVideo #Meditation #Zen #Calm #Peaceful #Hypnotic #Mesmerizing #OddlySatisfying #SatisfyingLoop #InfiniteLoop #SatisfyingContent #RelaxingVideo #StressRelief #Mindfulness #SatisfyingLoopVideo`,

    `This {style} infinity loop is incredibly satisfying to watch! The perfect loop creates an endless, mesmerizing experience.

Watch it again and again - you'll never get tired of this satisfying loop!

#Satisfying #Loop #InfinityLoop #Relaxing #ASMR #SatisfyingVideos #LoopVideo #Meditation #Zen #Calm #Peaceful #Hypnotic #Mesmerizing #OddlySatisfying #SatisfyingLoop #InfiniteLoop #SatisfyingContent #RelaxingVideo #StressRelief #Mindfulness`
  ];

  // Instagram caption templates
  const instagramCaptionTemplates = [
    `✨ Satisfying infinity loop ✨\n\nWatch this mesmerizing {style} loop over and over again! Perfect for relaxation and stress relief. 😌\n\n#Satisfying #InfinityLoop #Loop #Relaxing #ASMR #SatisfyingVideos #LoopVideo #Meditation #Zen #Calm #Peaceful #Hypnotic #Mesmerizing #OddlySatisfying #SatisfyingLoop #InfiniteLoop #SatisfyingContent #RelaxingVideo #StressRelief #Mindfulness`,

    `🎯 Perfect infinity loop!\n\nThis {style} loop creates a hypnotic, calming effect. Watch it again and again - you'll never get tired! 🔄\n\n#Satisfying #Loop #InfinityLoop #Relaxing #ASMR #SatisfyingVideos #LoopVideo #Meditation #Zen #Calm #Peaceful #Hypnotic #Mesmerizing #OddlySatisfying #SatisfyingLoop #InfiniteLoop #SatisfyingContent #RelaxingVideo #StressRelief #Mindfulness`,

    `🌀 Mesmerizing loop video 🌀\n\nExperience the perfect {style} infinity loop! So satisfying to watch! ✨\n\n#Satisfying #InfinityLoop #Loop #Relaxing #ASMR #SatisfyingVideos #LoopVideo #Meditation #Zen #Calm #Peaceful #Hypnotic #Mesmerizing #OddlySatisfying #SatisfyingLoop #InfiniteLoop #SatisfyingContent #RelaxingVideo #StressRelief #Mindfulness`
  ];

  // TikTok caption templates
  const tiktokCaptionTemplates = [
    `Satisfying infinity loop! Watch this {style} loop over and over 🔄 #satisfying #loop #infinityloop #relaxing #asmr #satisfyingvideos #loopvideo #meditation #zen #calm #peaceful #hypnotic #mesmerizing #oddlysatisfying #satisfyingloop #infiniteloop #satisfyingcontent #relaxingvideo #stressrelief #mindfulness`,

    `Perfect loop! This {style} infinity loop is so satisfying to watch ✨ #satisfying #loop #infinityloop #relaxing #asmr #satisfyingvideos #loopvideo #meditation #zen #calm #peaceful #hypnotic #mesmerizing #oddlysatisfying #satisfyingloop #infiniteloop #satisfyingcontent #relaxingvideo #stressrelief #mindfulness`,

    `Mesmerizing infinity loop! Watch it again and again 🌀 #satisfying #loop #infinityloop #relaxing #asmr #satisfyingvideos #loopvideo #meditation #zen #calm #peaceful #hypnotic #mesmerizing #oddlysatisfying #satisfyingloop #infiniteloop #satisfyingcontent #relaxingvideo #stressrelief #mindfulness`
  ];

  // Common tags for YouTube
  const tagSets = [
    ['satisfying', 'loop', 'infinity loop', 'relaxing', 'ASMR', 'satisfying videos', 'loop video', 'meditation', 'zen', 'calm', 'peaceful', 'hypnotic', 'mesmerizing', 'oddly satisfying', 'satisfying loop', 'infinite loop', 'satisfying content', 'relaxing video', 'stress relief', 'mindfulness'],
    ['satisfying', 'loop', 'infinity loop', 'relaxing', 'ASMR', 'satisfying videos', 'loop video', 'meditation', 'zen', 'calm', 'peaceful', 'hypnotic', 'mesmerizing', 'oddly satisfying', 'satisfying loop', 'infinite loop', 'satisfying content', 'relaxing video', 'stress relief', 'mindfulness', 'satisfying loop video', 'perfect loop'],
    ['satisfying', 'loop', 'infinity loop', 'relaxing', 'ASMR', 'satisfying videos', 'loop video', 'meditation', 'zen', 'calm', 'peaceful', 'hypnotic', 'mesmerizing', 'oddly satisfying', 'satisfying loop', 'infinite loop', 'satisfying content', 'relaxing video', 'stress relief', 'mindfulness', 'satisfying loop video', 'perfect loop', 'endless loop']
  ];

  function buildVariant(variantSeed) {
    // Select templates deterministically based on seed
    const titlePool = themeConfig.titleTemplates && themeConfig.titleTemplates.length > 0 ? themeConfig.titleTemplates : titleTemplates;
    const captionPoolIG = themeConfig.captionTemplates && themeConfig.captionTemplates.length > 0 ? themeConfig.captionTemplates : instagramCaptionTemplates;
    const captionPoolTT = themeConfig.captionTemplates && themeConfig.captionTemplates.length > 0 ? themeConfig.captionTemplates : tiktokCaptionTemplates;

    const titleIndex = generateSeedValue(variantSeed, 0, titlePool.length - 1);
    const descIndex = generateSeedValue(variantSeed + 1, 0, descriptionTemplates.length - 1);
    const instaIndex = generateSeedValue(variantSeed + 2, 0, captionPoolIG.length - 1);
    const tiktokIndex = generateSeedValue(variantSeed + 3, 0, captionPoolTT.length - 1);
    const tagIndex = generateSeedValue(variantSeed + 4, 0, tagSets.length - 1);
    const num = generateSeedValue(variantSeed + 5, 1, 999);

    const youtubeTitle = titlePool[titleIndex]
      .replace('{style}', style)
      .replace('{num}', num.toString());

    const youtubeDescription = descriptionTemplates[descIndex]
      .replace(/{style}/g, style);

    const baseTags = tagSets[tagIndex];
    const keywordTags = Array.isArray(keywords) ? keywords.map((k) => String(k).toLowerCase()) : [];
    const themeTags = themeConfig.hashtags || [];
    const youtubeTags = Array.from(new Set([...baseTags, ...themeTags, ...keywordTags]));

    const keywordHashtags = keywordTags.map((k) => `#${k.replace(/\\s+/g, '')}`);
    const themeHashtags = (themeConfig.hashtags || []).map((h) => (h.startsWith('#') ? h : `#${h}`));
    const combinedHashtags = Array.from(new Set([...themeHashtags, ...keywordHashtags]));
    const hashtagLine = combinedHashtags.length ? `\\n\\n${combinedHashtags.join(' ')}` : '';

    const emojiPrefix = (themeConfig.emojis || []).slice(0, 3).join(' ');

    const instagramCaption = `${emojiPrefix ? emojiPrefix + ' ' : ''}${captionPoolIG[instaIndex].replace(/{style}/g, style)}${hashtagLine}`;
    const tiktokCaption = `${emojiPrefix ? emojiPrefix + ' ' : ''}${captionPoolTT[tiktokIndex].replace(/{style}/g, style)}${hashtagLine}`;

    return {
      youtubeTitle,
      youtubeDescription,
      youtubeTags,
      instagramCaption,
      tiktokCaption
    };
  }

  const variantCount = Math.max(1, variants || 1);
  const variantList = [];
  for (let i = 0; i < variantCount; i += 1) {
    variantList.push(buildVariant(seed + i * 1000));
  }

  const selected = variantList[0];

  if (variantCount > 1) {
    return {
      ...selected,
      variants: variantList,
      selected
    };
  }

  return selected;
}

module.exports = {
  generateMetadata
};

